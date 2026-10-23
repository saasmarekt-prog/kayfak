begin;

create table if not exists public.room_bans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 500),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint room_bans_dates_ordered check (expires_at is null or expires_at > created_at)
);

create unique index if not exists active_room_ban_unique on public.room_bans(room_id, user_id) where revoked_at is null;
create index if not exists room_bans_user_idx on public.room_bans(user_id, revoked_at);

create table if not exists public.room_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('kick', 'ban', 'unban')),
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_moderation_actions_room_idx on public.room_moderation_actions(room_id, created_at desc);

create or replace function public.moderate_room_member(
  p_room_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_room public.rooms;
  v_provider_room_id text;
  v_existing public.room_bans;
  v_clean_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if p_action not in ('kick', 'ban', 'unban') then raise exception using errcode = '22023', message = 'Invalid moderation action'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found or (v_room.owner_id <> v_actor and not public.is_room_moderator(p_room_id)) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  if p_target_user_id = v_room.owner_id then raise exception using errcode = '22023', message = 'Room owner cannot be moderated'; end if;
  if p_action in ('kick', 'ban') and not exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_target_user_id and left_at is null) then raise exception using errcode = '22023', message = 'Active room member not found'; end if;
  select provider_room_id into v_provider_room_id from public.room_audio_sessions where room_id = p_room_id and status in ('starting', 'active') order by created_at desc limit 1;

  if p_action = 'kick' then
    update public.room_members set left_at = coalesce(left_at, timezone('utc', now())) where room_id = p_room_id and user_id = p_target_user_id and left_at is null;
  elsif p_action = 'ban' then
    update public.room_bans set revoked_at = timezone('utc', now()) where room_id = p_room_id and user_id = p_target_user_id and revoked_at is null;
    insert into public.room_bans(room_id, user_id, banned_by, reason) values (p_room_id, p_target_user_id, v_actor, v_clean_reason) returning * into v_existing;
    update public.room_members set left_at = coalesce(left_at, timezone('utc', now())) where room_id = p_room_id and user_id = p_target_user_id and left_at is null;
  else
    update public.room_bans set revoked_at = coalesce(revoked_at, timezone('utc', now())) where room_id = p_room_id and user_id = p_target_user_id and revoked_at is null;
  end if;

  insert into public.room_moderation_actions(room_id, target_user_id, actor_user_id, action, reason) values (p_room_id, p_target_user_id, v_actor, p_action, v_clean_reason);
  return jsonb_build_object('action', p_action, 'room_id', p_room_id, 'target_user_id', p_target_user_id, 'provider_room_id', v_provider_room_id);
end;
$$;

-- Replace the membership entry point so active bans cannot rejoin, including private rooms.
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
  if exists (select 1 from public.room_bans b where b.room_id = p_room_id and b.user_id = v_user_id and b.revoked_at is null and (b.expires_at is null or b.expires_at > timezone('utc', now()))) then raise exception using errcode = '42501', message = 'You are banned from this room'; end if;
  if v_room.visibility = 'private' and not public.is_room_member(p_room_id) then raise exception using errcode = '42501', message = 'Private room access denied'; end if;
  select count(*)::integer into v_active_count from public.room_members where room_id = p_room_id and left_at is null;
  if v_active_count >= v_room.capacity and not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user_id and left_at is null) then raise exception using errcode = '54000', message = 'Room capacity reached'; end if;
  insert into public.room_members (room_id, user_id, role, joined_at, left_at) values (p_room_id, v_user_id, 'listener', timezone('utc', now()), null) on conflict (room_id, user_id) do update set left_at = null, joined_at = timezone('utc', now());
  select * into v_member from public.room_members where room_id = p_room_id and user_id = v_user_id;
  return v_member;
end;
$$;

alter table public.room_bans enable row level security;
alter table public.room_moderation_actions enable row level security;
create policy room_bans_select_moderator on public.room_bans for select to authenticated using (banned_by = (select auth.uid()) or exists (select 1 from public.rooms r where r.id = room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(room_id))));
create policy moderation_actions_select_moderator on public.room_moderation_actions for select to authenticated using (actor_user_id = (select auth.uid()) or exists (select 1 from public.rooms r where r.id = room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(room_id))));
revoke insert, update, delete on public.room_bans from anon, authenticated;
revoke insert, update, delete on public.room_moderation_actions from anon, authenticated;
revoke execute on function public.moderate_room_member(uuid, uuid, text, text) from public, anon;
grant execute on function public.moderate_room_member(uuid, uuid, text, text) to authenticated;

commit;
