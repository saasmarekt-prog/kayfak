begin;

-- Audio state is metadata only. Provider secrets and connection tokens never enter Postgres.
do $$ begin
  create type public.audio_session_status as enum ('starting', 'active', 'ended', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.room_moderators (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id),
  constraint room_moderators_not_owner check (user_id <> granted_by)
);

create table if not exists public.room_invites (
  room_id uuid not null references public.rooms(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  revoked_at timestamptz,
  primary key (room_id, invitee_id),
  constraint room_invites_not_self check (invitee_id <> invited_by),
  constraint room_invites_dates_ordered check (revoked_at is null or revoked_at >= created_at)
);

create table if not exists public.room_audio_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  provider text not null check (provider in ('livekit')),
  provider_room_id text not null check (char_length(trim(provider_room_id)) between 1 and 200),
  status public.audio_session_status not null default 'starting',
  started_at timestamptz,
  ended_at timestamptz,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (room_id, provider_room_id),
  constraint audio_session_dates_ordered check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint active_audio_has_started_at check (status <> 'active' or started_at is not null)
);

create unique index if not exists one_active_audio_session_per_room
  on public.room_audio_sessions(room_id) where status in ('starting', 'active');
create index if not exists room_moderators_user_idx on public.room_moderators(user_id);
create index if not exists room_invites_user_idx on public.room_invites(invitee_id, revoked_at);
create index if not exists room_audio_sessions_room_idx on public.room_audio_sessions(room_id, created_at desc);

create or replace function public.is_room_moderator(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_moderators rm
    where rm.room_id = p_room_id and rm.user_id = (select auth.uid())
  );
$$;

-- Client entry point for room creation. It always starts as draft; audio/backend state
-- cannot be asserted by a mobile client.
create or replace function public.create_room(
  p_title text,
  p_description text,
  p_category text,
  p_visibility public.room_visibility default 'public',
  p_capacity integer default 50,
  p_community_id uuid default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if p_category not in ('سوالف', 'قصص', 'ألعاب', 'مجتمع') then raise exception using errcode = '22023', message = 'Invalid room category'; end if;
  if p_community_id is not null and not public.is_community_member(p_community_id) then raise exception using errcode = '42501', message = 'Community membership required'; end if;

  insert into public.rooms (owner_id, community_id, title, description, category, visibility, status, capacity)
  values (v_user_id, p_community_id, trim(p_title), nullif(trim(p_description), ''), p_category, p_visibility, 'draft', least(greatest(coalesce(p_capacity, 50), 2), 10000))
  returning * into v_room;
  return v_room;
end;
$$;

-- Replace the initial implementation so private rooms require a non-revoked invite.
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
  v_has_invite boolean;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.status <> 'live' then raise exception using errcode = '22023', message = 'Room is not available'; end if;

  select exists (
    select 1 from public.room_invites ri
    where ri.room_id = p_room_id and ri.invitee_id = v_user_id and ri.revoked_at is null
  ) into v_has_invite;
  if v_room.visibility = 'private' and v_room.owner_id <> v_user_id and not public.is_room_moderator(p_room_id) and not v_has_invite then
    raise exception using errcode = '42501', message = 'Private room invitation required';
  end if;

  select count(*)::integer into v_active_count from public.room_members where room_id = p_room_id and left_at is null;
  if v_active_count >= v_room.capacity and not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user_id and left_at is null) then
    raise exception using errcode = '54000', message = 'Room capacity reached';
  end if;

  insert into public.room_members (room_id, user_id, role, joined_at, left_at)
  values (p_room_id, v_user_id, 'listener', timezone('utc', now()), null)
  on conflict (room_id, user_id) do update set left_at = null, joined_at = timezone('utc', now());
  update public.room_invites set accepted_at = coalesce(accepted_at, timezone('utc', now())) where room_id = p_room_id and invitee_id = v_user_id;
  select * into v_member from public.room_members where room_id = p_room_id and user_id = v_user_id;
  return v_member;
end;
$$;

create or replace function public.invite_user_to_room(p_room_id uuid, p_invitee_id uuid)
returns public.room_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.room_invites;
  v_room public.rooms;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found or (v_room.owner_id <> v_user_id and not public.is_room_moderator(p_room_id)) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  if p_invitee_id = v_user_id then raise exception using errcode = '22023', message = 'Cannot invite yourself'; end if;

  insert into public.room_invites (room_id, invitee_id, invited_by, revoked_at)
  values (p_room_id, p_invitee_id, v_user_id, null)
  on conflict (room_id, invitee_id) do update set invited_by = v_user_id, created_at = timezone('utc', now()), accepted_at = null, revoked_at = null
  returning * into v_invite;
  return v_invite;
end;
$$;

create or replace function public.end_room(p_room_id uuid)
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
  if not exists (select 1 from public.rooms r where r.id = p_room_id and (r.owner_id = v_user_id or public.is_room_moderator(p_room_id))) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  update public.rooms set status = 'ended', ended_at = coalesce(ended_at, timezone('utc', now())) where id = p_room_id and status <> 'ended';
  get diagnostics v_updated = row_count;
  update public.room_members set left_at = coalesce(left_at, timezone('utc', now())) where room_id = p_room_id and left_at is null;
  return v_updated = 1;
end;
$$;

-- Only a trusted server-side audio integration may mark a provider session active.
-- It must create the provider room and validate its result before calling this function.
create or replace function public.register_audio_session(
  p_room_id uuid,
  p_provider text,
  p_provider_room_id text,
  p_status public.audio_session_status default 'active',
  p_failure_reason text default null
)
returns public.room_audio_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.room_audio_sessions;
  v_started_at timestamptz := case when p_status = 'active' then timezone('utc', now()) else null end;
  v_ended_at timestamptz := case when p_status in ('ended', 'failed') then timezone('utc', now()) else null end;
begin
  if (select auth.role()) <> 'service_role' then raise exception using errcode = '42501', message = 'Trusted audio backend required'; end if;
  if p_provider <> 'livekit' then raise exception using errcode = '22023', message = 'Unsupported audio provider'; end if;

  insert into public.room_audio_sessions (room_id, provider, provider_room_id, status, started_at, ended_at, failure_reason)
  values (p_room_id, p_provider, trim(p_provider_room_id), p_status, v_started_at, v_ended_at, nullif(trim(p_failure_reason), ''))
  on conflict (room_id, provider_room_id) do update set status = excluded.status, started_at = coalesce(public.room_audio_sessions.started_at, excluded.started_at), ended_at = excluded.ended_at, failure_reason = excluded.failure_reason, updated_at = timezone('utc', now())
  returning * into v_session;

  if p_status = 'active' then
    update public.rooms set status = 'live', started_at = coalesce(started_at, timezone('utc', now())), ended_at = null where id = p_room_id;
  elsif p_status in ('ended', 'failed') then
    update public.rooms set status = 'ended', ended_at = coalesce(ended_at, timezone('utc', now())) where id = p_room_id;
  end if;
  return v_session;
end;
$$;

-- Close client-controlled room state transitions from migration 0001.
drop policy if exists rooms_insert_self on public.rooms;
drop policy if exists rooms_update_owner on public.rooms;
drop policy if exists rooms_delete_owner on public.rooms;
drop policy if exists room_members_select_allowed on public.room_members;
create policy room_members_select_allowed on public.room_members for select to authenticated using (
  user_id = (select auth.uid()) or public.is_room_member(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid()))
);

alter table public.room_moderators enable row level security;
alter table public.room_invites enable row level security;
alter table public.room_audio_sessions enable row level security;

create policy room_moderators_select_allowed on public.room_moderators for select to authenticated using (
  user_id = (select auth.uid()) or public.is_room_member(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid()))
);
create policy room_invites_select_involved on public.room_invites for select to authenticated using (
  invitee_id = (select auth.uid()) or invited_by = (select auth.uid()) or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid()))
);
create policy room_invites_delete_involved on public.room_invites for delete to authenticated using (invitee_id = (select auth.uid()) or invited_by = (select auth.uid()));
create policy room_audio_sessions_select_members on public.room_audio_sessions for select to authenticated using (public.is_room_member(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = (select auth.uid())));

revoke execute on function public.is_room_moderator(uuid) from public;
revoke execute on function public.create_room(text, text, text, public.room_visibility, integer, uuid) from public;
revoke execute on function public.invite_user_to_room(uuid, uuid) from public;
revoke execute on function public.end_room(uuid) from public;
revoke execute on function public.register_audio_session(uuid, text, text, public.audio_session_status, text) from public;
grant execute on function public.create_room(text, text, text, public.room_visibility, integer, uuid) to authenticated;
grant execute on function public.invite_user_to_room(uuid, uuid) to authenticated;
grant execute on function public.end_room(uuid) to authenticated;
grant execute on function public.register_audio_session(uuid, text, text, public.audio_session_status, text) to service_role;

create trigger room_audio_sessions_set_updated_at before update on public.room_audio_sessions for each row execute function public.set_updated_at();

commit;
