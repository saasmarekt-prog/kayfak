begin;

do $$ begin
  create type public.speaker_request_status as enum ('pending', 'approved', 'rejected', 'canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.room_speaker_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.speaker_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  unique(room_id, user_id, status)
);

create index if not exists room_speaker_requests_queue_idx on public.room_speaker_requests(room_id, status, created_at);

create or replace function public.request_to_speak(p_room_id uuid)
returns public.room_speaker_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_request public.room_speaker_requests;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user and left_at is null) then raise exception using errcode = '42501', message = 'Active room membership required'; end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user and role in ('speaker', 'host') and left_at is null) then raise exception using errcode = '22023', message = 'Already a speaker'; end if;
  insert into public.room_speaker_requests(room_id, user_id, status) values (p_room_id, v_user, 'pending')
  on conflict (room_id, user_id, status) do update set created_at = timezone('utc', now())
  returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.review_speaker_request(p_request_id uuid, p_approve boolean)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_request public.room_speaker_requests;
  v_room public.rooms;
  v_member public.room_members;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_request from public.room_speaker_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception using errcode = '22023', message = 'Speaker request is not pending'; end if;
  select * into v_room from public.rooms where id = v_request.room_id;
  if v_room.owner_id <> v_user and not public.is_room_moderator(v_request.room_id) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  update public.room_speaker_requests set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = v_user, reviewed_at = timezone('utc', now()) where id = p_request_id;
  if not p_approve then return null; end if;
  update public.room_members set role = 'speaker' where room_id = v_request.room_id and user_id = v_request.user_id and left_at is null returning * into v_member;
  if not found then raise exception using errcode = '22023', message = 'Active member not found'; end if;
  return v_member;
end;
$$;

create or replace function public.set_room_member_role(p_room_id uuid, p_user_id uuid, p_role public.room_member_role)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_room public.rooms;
  v_member public.room_members;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_room from public.rooms where id = p_room_id;
  if not found or (v_room.owner_id <> v_user and not public.is_room_moderator(p_room_id)) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  if p_user_id = v_room.owner_id and p_role <> 'host' then raise exception using errcode = '22023', message = 'Room owner cannot be demoted'; end if;
  update public.room_members set role = p_role where room_id = p_room_id and user_id = p_user_id and left_at is null returning * into v_member;
  if not found then raise exception using errcode = '22023', message = 'Active member not found'; end if;
  return v_member;
end;
$$;

create or replace function public.get_room_moderation_state(p_room_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_owner', r.owner_id = (select auth.uid()),
    'is_moderator', public.is_room_moderator(p_room_id),
    'can_manage', r.owner_id = (select auth.uid()) or public.is_room_moderator(p_room_id)
  )
  from public.rooms r
  where r.id = p_room_id;
$$;

create or replace function public.list_pending_speaker_requests(p_room_id uuid)
returns table(id uuid, user_id uuid, display_name text, avatar_url text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms r where r.id = p_room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(p_room_id))) then
    raise exception using errcode = '42501', message = 'Moderator permission required';
  end if;
  return query
    select sr.id, sr.user_id, p.display_name, p.avatar_url, sr.created_at
    from public.room_speaker_requests sr
    join public.profiles p on p.id = sr.user_id
    where sr.room_id = p_room_id and sr.status = 'pending'
    order by sr.created_at asc;
end;
$$;

alter table public.room_speaker_requests enable row level security;
create policy speaker_requests_select_own_or_moderator on public.room_speaker_requests for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.rooms r where r.id = room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(room_id))));
revoke insert, update, delete on public.room_speaker_requests from anon, authenticated;
grant execute on function public.request_to_speak(uuid) to authenticated;
grant execute on function public.review_speaker_request(uuid, boolean) to authenticated;
grant execute on function public.set_room_member_role(uuid, uuid, public.room_member_role) to authenticated;
grant execute on function public.get_room_moderation_state(uuid) to authenticated;
grant execute on function public.list_pending_speaker_requests(uuid) to authenticated;

commit;
