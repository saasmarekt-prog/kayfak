begin;

do $$ begin
  create type public.wallet_entry_type as enum ('purchase', 'gift_sent', 'gift_received', 'refund', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gift_status as enum ('pending', 'settled', 'reversed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_status as enum ('pending', 'active', 'paused', 'canceled', 'expired', 'refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coin_balance bigint not null default 0 check (coin_balance >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_user_id uuid not null references public.wallet_accounts(user_id) on delete restrict,
  amount_delta bigint not null check (amount_delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  entry_type public.wallet_entry_type not null,
  reference_id uuid,
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  receiver_id uuid not null references public.profiles(id) on delete restrict,
  gift_code text not null check (char_length(trim(gift_code)) between 1 and 80),
  coin_cost bigint not null check (coin_cost > 0),
  status public.gift_status not null default 'pending',
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default timezone('utc', now()),
  settled_at timestamptz,
  constraint gifts_not_self check (sender_id <> receiver_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('apple', 'google', 'stripe')),
  provider_purchase_id text not null,
  product_id text not null,
  coin_amount bigint not null check (coin_amount > 0),
  status public.billing_status not null default 'pending',
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  settled_at timestamptz,
  unique(provider, provider_purchase_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('apple', 'google', 'stripe')),
  provider_subscription_id text not null,
  plan_id text not null,
  status public.billing_status not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(provider, provider_subscription_id)
);

create index if not exists ledger_entries_user_idx on public.ledger_entries(wallet_user_id, created_at desc);
create index if not exists gifts_sender_idx on public.gifts(sender_id, created_at desc);
create index if not exists gifts_receiver_idx on public.gifts(receiver_id, created_at desc);
create index if not exists purchases_user_idx on public.purchases(user_id, created_at desc);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, status);

create or replace function public.ensure_wallet_account(p_user_id uuid)
returns public.wallet_accounts
language plpgsql
security definer
set search_path = public
as $$
declare v_account public.wallet_accounts;
begin
  insert into public.wallet_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_account from public.wallet_accounts where user_id = p_user_id;
  return v_account;
end;
$$;

create or replace function public.record_gift(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_gift_code text,
  p_coin_cost bigint,
  p_idempotency_key text
)
returns public.gifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender public.wallet_accounts;
  v_gift public.gifts;
  v_existing public.gifts;
  v_sender_balance bigint;
begin
  if (select auth.role()) <> 'service_role' then raise exception using errcode = '42501', message = 'Trusted billing backend required'; end if;
  select * into v_existing from public.gifts where idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;
  if p_sender_id = p_receiver_id or p_coin_cost <= 0 then raise exception using errcode = '22023', message = 'Invalid gift'; end if;

  perform public.ensure_wallet_account(p_sender_id);
  perform public.ensure_wallet_account(p_receiver_id);
  -- Lock both accounts in a deterministic order to avoid sender/receiver deadlocks.
  perform 1 from public.wallet_accounts where user_id in (p_sender_id, p_receiver_id) order by user_id for update;
  select * into v_sender from public.wallet_accounts where user_id = p_sender_id for update;
  if v_sender.coin_balance < p_coin_cost then raise exception using errcode = '22003', message = 'Insufficient coin balance'; end if;
  v_sender_balance := v_sender.coin_balance - p_coin_cost;
  update public.wallet_accounts set coin_balance = v_sender_balance, updated_at = timezone('utc', now()) where user_id = p_sender_id;
  update public.wallet_accounts set coin_balance = coin_balance + p_coin_cost, updated_at = timezone('utc', now()) where user_id = p_receiver_id;

  insert into public.gifts(sender_id, receiver_id, gift_code, coin_cost, status, idempotency_key, settled_at)
  values (p_sender_id, p_receiver_id, trim(p_gift_code), p_coin_cost, 'settled', p_idempotency_key, timezone('utc', now()))
  returning * into v_gift;
  insert into public.ledger_entries(wallet_user_id, amount_delta, balance_after, entry_type, reference_id, idempotency_key, metadata)
  values (p_sender_id, -p_coin_cost, v_sender_balance, 'gift_sent', v_gift.id, p_idempotency_key || ':sender', jsonb_build_object('gift_code', p_gift_code));
  insert into public.ledger_entries(wallet_user_id, amount_delta, balance_after, entry_type, reference_id, idempotency_key, metadata)
  values (p_receiver_id, p_coin_cost, (select coin_balance from public.wallet_accounts where user_id = p_receiver_id), 'gift_received', v_gift.id, p_idempotency_key || ':receiver', jsonb_build_object('gift_code', p_gift_code));
  return v_gift;
end;
$$;

create or replace function public.record_purchase_credit(
  p_user_id uuid,
  p_provider text,
  p_provider_purchase_id text,
  p_product_id text,
  p_coin_amount bigint,
  p_idempotency_key text,
  p_raw_event jsonb default '{}'::jsonb
)
returns public.purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.purchases;
  v_purchase public.purchases;
  v_balance bigint;
begin
  if (select auth.role()) <> 'service_role' then raise exception using errcode = '42501', message = 'Trusted billing backend required'; end if;
  select * into v_existing from public.purchases where idempotency_key = p_idempotency_key or (provider = p_provider and provider_purchase_id = p_provider_purchase_id);
  if found then return v_existing; end if;
  if p_coin_amount <= 0 or p_provider not in ('apple', 'google', 'stripe') then raise exception using errcode = '22023', message = 'Invalid purchase'; end if;
  perform public.ensure_wallet_account(p_user_id);
  select coin_balance into v_balance from public.wallet_accounts where user_id = p_user_id for update;
  v_balance := v_balance + p_coin_amount;
  update public.wallet_accounts set coin_balance = v_balance, updated_at = timezone('utc', now()) where user_id = p_user_id;
  insert into public.purchases(user_id, provider, provider_purchase_id, product_id, coin_amount, status, idempotency_key, raw_event, settled_at)
  values (p_user_id, p_provider, p_provider_purchase_id, p_product_id, p_coin_amount, 'active', p_idempotency_key, coalesce(p_raw_event, '{}'::jsonb), timezone('utc', now()))
  returning * into v_purchase;
  insert into public.ledger_entries(wallet_user_id, amount_delta, balance_after, entry_type, reference_id, idempotency_key, metadata)
  values (p_user_id, p_coin_amount, v_balance, 'purchase', v_purchase.id, p_idempotency_key || ':credit', jsonb_build_object('product_id', p_product_id, 'provider', p_provider));
  return v_purchase;
end;
$$;

alter table public.wallet_accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.gifts enable row level security;
alter table public.purchases enable row level security;
alter table public.subscriptions enable row level security;

create policy wallet_accounts_select_self on public.wallet_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy ledger_entries_select_self on public.ledger_entries for select to authenticated using (wallet_user_id = (select auth.uid()));
create policy gifts_select_involved on public.gifts for select to authenticated using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
create policy purchases_select_self on public.purchases for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_select_self on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

revoke execute on function public.ensure_wallet_account(uuid) from public;
revoke execute on function public.record_gift(uuid, uuid, text, bigint, text) from public;
revoke execute on function public.record_purchase_credit(uuid, text, text, text, bigint, text, jsonb) from public;
grant execute on function public.record_gift(uuid, uuid, text, bigint, text) to service_role;
grant execute on function public.record_purchase_credit(uuid, text, text, text, bigint, text, jsonb) to service_role;

create or replace function public.create_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallet_accounts(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_wallet on public.profiles;
create trigger profiles_create_wallet after insert on public.profiles for each row execute function public.create_wallet_for_profile();

create trigger wallet_accounts_set_updated_at before update on public.wallet_accounts for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

commit;
