begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.story_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.story_node_kind as enum ('start', 'scene', 'ending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.game_status as enum ('draft', 'live', 'ended');
exception when duplicate_object then null; end $$;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  status public.story_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.story_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.story_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique(story_id, version_number)
);

create table if not exists public.story_nodes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.story_versions(id) on delete cascade,
  node_key text not null check (node_key ~ '^[a-zA-Z0-9_-]{1,80}$'),
  kind public.story_node_kind not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null default '' check (char_length(body) <= 10000),
  payload jsonb not null default '{}'::jsonb,
  unique(version_id, node_key)
);

create table if not exists public.story_choices (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.story_nodes(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 240),
  next_node_id uuid references public.story_nodes(id) on delete restrict,
  reward_points integer not null default 0 check (reward_points between 0 and 100000),
  sort_order integer not null default 0,
  unique(node_id, sort_order)
);

create table if not exists public.story_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_id uuid not null references public.story_versions(id) on delete restrict,
  current_node_id uuid not null references public.story_nodes(id) on delete restrict,
  state jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  started_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, version_id)
);

create table if not exists public.story_choice_events (
  id uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.story_progress(id) on delete cascade,
  choice_id uuid not null references public.story_choices(id) on delete restrict,
  request_key text not null check (char_length(trim(request_key)) between 8 and 200),
  created_at timestamptz not null default timezone('utc', now()),
  unique(request_key),
  unique(progress_id, choice_id)
);

create table if not exists public.game_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title text not null check (char_length(trim(title)) between 2 and 160),
  kind text not null check (kind in ('poll', 'quiz', 'riddle', 'challenge')),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.game_templates(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete set null,
  host_id uuid not null references public.profiles(id) on delete restrict,
  status public.game_status not null default 'draft',
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  prompt text not null check (char_length(trim(prompt)) between 1 and 2000),
  options jsonb not null default '[]'::jsonb,
  expected_answer text not null check (char_length(trim(expected_answer)) between 1 and 500),
  reward_points integer not null default 0 check (reward_points between 0 and 100000),
  status text not null default 'pending' check (status in ('pending', 'open', 'closed')),
  unique(session_id, round_number)
);

create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(trim(answer)) between 1 and 500),
  is_correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default timezone('utc', now()),
  unique(round_id, user_id)
);

create table if not exists public.reward_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance bigint not null default 0 check (points_balance >= 0),
  lifetime_points bigint not null default 0 check (lifetime_points >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_delta integer not null check (amount_delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null check (char_length(trim(reason)) between 2 and 120),
  reference_id uuid,
  idempotency_key text not null unique check (char_length(trim(idempotency_key)) between 8 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists story_versions_published_idx on public.story_versions(story_id, status, version_number desc);
create index if not exists story_nodes_version_idx on public.story_nodes(version_id, node_key);
create index if not exists story_progress_user_idx on public.story_progress(user_id, updated_at desc);
create index if not exists game_sessions_room_idx on public.game_sessions(room_id, status);
create index if not exists reward_ledger_user_idx on public.reward_ledger(user_id, created_at desc);

create or replace function public.start_story(p_version_id uuid)
returns public.story_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_progress public.story_progress;
  v_start public.story_nodes;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select n.* into v_start
  from public.story_nodes n
  join public.story_versions v on v.id = n.version_id
  join public.stories s on s.id = v.story_id
  where n.version_id = p_version_id and n.kind = 'start' and v.status = 'published' and s.status = 'published'
  limit 1;
  if not found then raise exception using errcode = '22023', message = 'Published story start node not found'; end if;
  insert into public.story_progress(user_id, version_id, current_node_id)
  values (v_user, p_version_id, v_start.id)
  on conflict (user_id, version_id) do update set updated_at = timezone('utc', now())
  returning * into v_progress;
  return v_progress;
end;
$$;

create or replace function public.choose_story_choice(
  p_progress_id uuid,
  p_choice_id uuid,
  p_request_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_progress public.story_progress;
  v_choice public.story_choices;
  v_next public.story_nodes;
  v_points integer := 0;
  v_balance bigint;
  v_inserted integer;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if char_length(trim(p_request_key)) < 8 then raise exception using errcode = '22023', message = 'Invalid request key'; end if;
  select * into v_progress from public.story_progress where id = p_progress_id and user_id = v_user for update;
  if not found then raise exception using errcode = '42501', message = 'Progress not found'; end if;
  select c.* into v_choice from public.story_choices c where c.id = p_choice_id and c.node_id = v_progress.current_node_id;
  if not found then raise exception using errcode = '22023', message = 'Choice is not available at current node'; end if;
  if exists (select 1 from public.story_choice_events where request_key = trim(p_request_key)) then
    return jsonb_build_object('progress_id', v_progress.id, 'current_node_id', v_progress.current_node_id, 'completed', v_progress.completed_at is not null, 'points_awarded', 0, 'idempotent', true);
  end if;
  if v_choice.next_node_id is null then raise exception using errcode = '22023', message = 'Choice has no valid destination'; end if;
  select * into v_next from public.story_nodes where id = v_choice.next_node_id;
  if not found then raise exception using errcode = '22023', message = 'Destination node not found'; end if;
  if v_next.version_id <> v_progress.version_id then raise exception using errcode = '22023', message = 'Cross-version transition rejected'; end if;
  insert into public.story_choice_events(progress_id, choice_id, request_key) values (v_progress.id, v_choice.id, trim(p_request_key)) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('progress_id', v_progress.id, 'current_node_id', v_progress.current_node_id, 'completed', v_progress.completed_at is not null, 'points_awarded', 0, 'idempotent', true); end if;
  v_points := v_choice.reward_points;
  update public.story_progress set current_node_id = v_next.id, completed_at = case when v_next.kind = 'ending' then timezone('utc', now()) else completed_at end, updated_at = timezone('utc', now()) where id = v_progress.id returning * into v_progress;
  if v_points > 0 then
    insert into public.reward_accounts(user_id) values (v_user) on conflict (user_id) do nothing;
    select points_balance into v_balance from public.reward_accounts where user_id = v_user for update;
    v_balance := v_balance + v_points;
    update public.reward_accounts set points_balance = v_balance, lifetime_points = lifetime_points + v_points, updated_at = timezone('utc', now()) where user_id = v_user;
    insert into public.reward_ledger(user_id, amount_delta, balance_after, reason, reference_id, idempotency_key, metadata)
    values (v_user, v_points, v_balance, 'story_choice', v_progress.id, 'story:' || v_progress.id::text || ':' || trim(p_request_key), jsonb_build_object('choice_id', p_choice_id));
  end if;
  return jsonb_build_object('progress_id', v_progress.id, 'current_node_id', v_progress.current_node_id, 'completed', v_progress.completed_at is not null, 'points_awarded', v_points, 'idempotent', false);
end;
$$;

create or replace function public.submit_game_answer(
  p_round_id uuid,
  p_user_id uuid,
  p_answer text,
  p_idempotency_key text
)
returns public.game_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.game_rounds;
  v_existing public.game_answers;
  v_answer public.game_answers;
  v_correct boolean;
  v_points integer;
  v_balance bigint;
begin
  if (select auth.role()) <> 'service_role' then raise exception using errcode = '42501', message = 'Trusted game backend required'; end if;
  select * into v_existing from public.game_answers where idempotency_key = trim(p_idempotency_key) or (round_id = p_round_id and user_id = p_user_id);
  if found then return v_existing; end if;
  if not exists (
    select 1 from public.game_rounds gr
    join public.game_sessions gs on gs.id = gr.session_id
    join public.room_members rm on rm.room_id = gs.room_id
    where gr.id = p_round_id and rm.user_id = p_user_id and rm.left_at is null
  ) then raise exception using errcode = '42501', message = 'Game membership required'; end if;
  select * into v_round from public.game_rounds where id = p_round_id and status = 'open' for update;
  if not found then raise exception using errcode = '22023', message = 'Game round is not open'; end if;
  v_correct := lower(trim(p_answer)) = lower(trim(v_round.expected_answer));
  v_points := case when v_correct then v_round.reward_points else 0 end;
  insert into public.game_answers(round_id, user_id, answer, is_correct, points_awarded, idempotency_key)
  values (p_round_id, p_user_id, trim(p_answer), v_correct, v_points, trim(p_idempotency_key)) returning * into v_answer;
  if v_points > 0 then
    insert into public.reward_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
    select points_balance into v_balance from public.reward_accounts where user_id = p_user_id for update;
    v_balance := v_balance + v_points;
    update public.reward_accounts set points_balance = v_balance, lifetime_points = lifetime_points + v_points, updated_at = timezone('utc', now()) where user_id = p_user_id;
    insert into public.reward_ledger(user_id, amount_delta, balance_after, reason, reference_id, idempotency_key, metadata)
    values (p_user_id, v_points, v_balance, 'game_answer', v_answer.id, 'game:' || trim(p_idempotency_key), jsonb_build_object('round_id', p_round_id));
  end if;
  return v_answer;
end;
$$;

alter table public.stories enable row level security;
alter table public.story_versions enable row level security;
alter table public.story_nodes enable row level security;
alter table public.story_choices enable row level security;
alter table public.story_progress enable row level security;
alter table public.story_choice_events enable row level security;
alter table public.game_templates enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_rounds enable row level security;
alter table public.game_answers enable row level security;
alter table public.reward_accounts enable row level security;
alter table public.reward_ledger enable row level security;

create policy stories_published_select on public.stories for select to anon, authenticated using (status = 'published' or creator_id = (select auth.uid()));
create policy story_versions_published_select on public.story_versions for select to anon, authenticated using (status = 'published');
create policy story_nodes_published_select on public.story_nodes for select to anon, authenticated using (exists (select 1 from public.story_versions v join public.stories s on s.id = v.story_id where v.id = version_id and v.status = 'published' and s.status = 'published'));
create policy story_choices_published_select on public.story_choices for select to anon, authenticated using (exists (select 1 from public.story_nodes n join public.story_versions v on v.id = n.version_id join public.stories s on s.id = v.story_id where n.id = node_id and v.status = 'published' and s.status = 'published'));
create policy story_progress_select_own on public.story_progress for select to authenticated using (user_id = (select auth.uid()));
create policy story_choice_events_select_own on public.story_choice_events for select to authenticated using (exists (select 1 from public.story_progress p where p.id = progress_id and p.user_id = (select auth.uid())));
create policy game_templates_enabled_select on public.game_templates for select to anon, authenticated using (enabled = true);
create policy game_sessions_host_select on public.game_sessions for select to authenticated using (host_id = (select auth.uid()));
create policy game_answers_own_select on public.game_answers for select to authenticated using (user_id = (select auth.uid()));
create policy reward_accounts_own_select on public.reward_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy reward_ledger_own_select on public.reward_ledger for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.game_rounds from anon, authenticated;
revoke all on public.game_answers from anon, authenticated;
revoke insert, update, delete on public.story_progress from anon, authenticated;
revoke insert, update, delete on public.reward_accounts from anon, authenticated;
revoke insert, update, delete on public.reward_ledger from anon, authenticated;
create or replace function public.get_active_game_round(p_room_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('session_id', gs.id, 'round_id', gr.id, 'round_number', gr.round_number, 'prompt', gr.prompt, 'options', gr.options)
  from public.game_sessions gs
  join public.game_rounds gr on gr.session_id = gs.id
  where gs.room_id = p_room_id
    and gs.status = 'live'
    and gr.status = 'open'
    and exists (select 1 from public.room_members rm where rm.room_id = p_room_id and rm.user_id = (select auth.uid()) and rm.left_at is null)
  order by gr.round_number desc
  limit 1;
$$;
revoke execute on function public.submit_game_answer(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_active_game_round(uuid) from public, anon;
grant execute on function public.start_story(uuid) to authenticated;
grant execute on function public.choose_story_choice(uuid, uuid, text) to authenticated;
grant execute on function public.submit_game_answer(uuid, uuid, text, text) to service_role;
grant execute on function public.get_active_game_round(uuid) to authenticated;

create trigger stories_set_updated_at before update on public.stories for each row execute function public.set_updated_at();
create trigger story_progress_set_updated_at before update on public.story_progress for each row execute function public.set_updated_at();

commit;
