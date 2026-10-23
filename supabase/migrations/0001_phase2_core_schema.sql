begin;

create extension if not exists pgcrypto;

-- Enumerations are intentionally small and explicit. Add values through reviewed migrations.
do $$ begin
  create type public.profile_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.community_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('pending', 'active', 'rejected', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.community_role as enum ('member', 'moderator', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_visibility as enum ('public', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_status as enum ('draft', 'live', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_member_role as enum ('listener', 'speaker', 'host');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_target_type as enum ('profile', 'community', 'room', 'post');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text,
  visibility public.profile_visibility not null default 'public',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-zA-Z0-9_]{3,30}$'
  )
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  visibility public.community_visibility not null default 'public',
  requires_approval boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.community_role not null default 'member',
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (community_id, user_id),
  constraint active_members_have_joined_at check (status <> 'active' or joined_at is not null)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  community_id uuid references public.communities(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  category text not null check (category in ('سوالف', 'قصص', 'ألعاب', 'مجتمع')),
  visibility public.room_visibility not null default 'public',
  status public.room_status not null default 'draft',
  capacity integer not null default 50 check (capacity between 2 and 10000),
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint room_times_are_ordered check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint live_room_has_started_at check (status <> 'live' or started_at is not null)
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.room_member_role not null default 'listener',
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id),
  constraint room_members_times_are_ordered check (left_at is null or left_at >= joined_at)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('follow', 'community', 'room', 'moderation', 'system')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text check (body is null or char_length(body) <= 500),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
create index if not exists communities_owner_idx on public.communities(owner_id);
create index if not exists community_members_user_idx on public.community_members(user_id, status);
create index if not exists rooms_discovery_idx on public.rooms(status, visibility, created_at desc);
create index if not exists rooms_community_idx on public.rooms(community_id, created_at desc);
create index if not exists room_members_active_idx on public.room_members(room_id) where left_at is null;
create index if not exists reports_queue_idx on public.reports(status, created_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'مستخدم'), '@', 1)), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_members (community_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'owner', 'active', timezone('utc', now()))
  on conflict (community_id, user_id) do update
    set role = 'owner', status = 'active', joined_at = coalesce(public.community_members.joined_at, excluded.joined_at), updated_at = timezone('utc', now());
  return new;
end;
$$;

 drop trigger if exists on_community_created on public.communities;
create trigger on_community_created
after insert on public.communities
for each row execute function public.add_owner_membership();

create or replace function public.add_room_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.owner_id, 'host')
  on conflict (room_id, user_id) do update set role = 'host', left_at = null;
  return new;
end;
$$;

 drop trigger if exists on_room_created on public.rooms;
create trigger on_room_created
after insert on public.rooms
for each row execute function public.add_room_owner();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger communities_set_updated_at before update on public.communities for each row execute function public.set_updated_at();
create trigger community_members_set_updated_at before update on public.community_members for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at before update on public.rooms for each row execute function public.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();

create or replace function public.is_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
  );
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = (select auth.uid())
      and rm.left_at is null
  );
$$;

create or replace function public.join_room(p_room_id uuid)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
  v_active_count integer;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.status <> 'live' then raise exception using errcode = '22023', message = 'Room is not available'; end if;
  if v_room.visibility = 'private' and not public.is_room_member(p_room_id) then
    raise exception using errcode = '42501', message = 'Private room access denied';
  end if;

  select count(*)::integer into v_active_count from public.room_members where room_id = p_room_id and left_at is null;
  if v_active_count >= v_room.capacity and not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user_id and left_at is null) then
    raise exception using errcode = '54000', message = 'Room capacity reached';
  end if;

  insert into public.room_members (room_id, user_id, role, joined_at, left_at)
  values (p_room_id, v_user_id, 'listener', timezone('utc', now()), null)
  on conflict (room_id, user_id) do update set left_at = null, joined_at = timezone('utc', now());
  select * into v_member from public.room_members where room_id = p_room_id and user_id = v_user_id;
  return v_member;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_updated integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  update public.room_members
    set left_at = coalesce(left_at, timezone('utc', now()))
  where room_id = p_room_id and user_id = v_user_id and left_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_visible on public.profiles for select to authenticated using (
  id = (select auth.uid()) or visibility = 'public'
);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_self on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy follows_select_involved on public.follows for select to authenticated using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
create policy follows_insert_self on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_delete_self on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy blocks_select_self on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert_self on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete_self on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create policy communities_select_allowed on public.communities for select to authenticated using (
  visibility = 'public' or owner_id = (select auth.uid()) or public.is_community_member(id)
);
create policy communities_insert_self on public.communities for insert to authenticated with check (owner_id = (select auth.uid()));
create policy communities_update_owner on public.communities for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy communities_delete_owner on public.communities for delete to authenticated using (owner_id = (select auth.uid()));

create policy community_members_select_allowed on public.community_members for select to authenticated using (
  user_id = (select auth.uid()) or public.is_community_member(community_id) or exists (select 1 from public.communities c where c.id = community_id and c.owner_id = (select auth.uid()))
);
create policy community_members_insert_self on public.community_members for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')
  and role = 'member'
  and status = case when (select c.requires_approval from public.communities c where c.id = community_id) then 'pending'::public.membership_status else 'active'::public.membership_status end
);
create policy community_members_delete_self on public.community_members for delete to authenticated using (user_id = (select auth.uid()) and role <> 'owner');

create policy rooms_select_allowed on public.rooms for select to authenticated using (
  (visibility = 'public' and status <> 'draft') or owner_id = (select auth.uid()) or public.is_room_member(id)
);
create policy rooms_insert_self on public.rooms for insert to authenticated with check (owner_id = (select auth.uid()));
create policy rooms_update_owner on public.rooms for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy rooms_delete_owner on public.rooms for delete to authenticated using (owner_id = (select auth.uid()));

create policy room_members_select_allowed on public.room_members for select to authenticated using (
  user_id = (select auth.uid()) or public.is_room_member(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid()))
);

create policy reports_insert_self on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_select_self on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

create policy notifications_select_self on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_self on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke execute on function public.is_community_member(uuid) from public;
revoke execute on function public.is_room_member(uuid) from public;
revoke execute on function public.join_room(uuid) from public;
revoke execute on function public.leave_room(uuid) from public;
grant execute on function public.join_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

do $$ begin
  alter default privileges in schema public revoke all on tables from anon;
  alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
exception when insufficient_privilege then null; end $$;

commit;
