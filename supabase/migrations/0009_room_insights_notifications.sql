begin;

create table if not exists public.room_activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('kick', 'ban', 'unban', 'role_change', 'speaker_request', 'speaker_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists room_activity_events_room_idx on public.room_activity_events(room_id, created_at desc);

create or replace function public.record_moderation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_activity_events(room_id, actor_user_id, target_user_id, event_type, metadata)
  values (new.room_id, new.actor_user_id, new.target_user_id, new.action, jsonb_build_object('reason', new.reason));
  return new;
end;
$$;

drop trigger if exists room_moderation_activity_trigger on public.room_moderation_actions;
create trigger room_moderation_activity_trigger after insert on public.room_moderation_actions for each row execute function public.record_moderation_activity();

create or replace function public.notify_moderation_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := case when new.action = 'ban' then 'تم حظرك من الغرفة' when new.action = 'kick' then 'تم طردك من الغرفة' else 'تم إلغاء حظرك من الغرفة' end;
  v_body text := case when trim(new.reason) = '' then 'اتخذ المشرف إجراءً أمنيًا على حسابك.' else new.reason end;
begin
  if new.target_user_id is not null then
    insert into public.notifications(user_id, actor_id, kind, title, body, entity_id) values (new.target_user_id, new.actor_user_id, 'moderation', v_title, v_body, new.room_id);
  end if;
  insert into public.notifications(user_id, actor_id, kind, title, body, entity_id)
  select distinct recipients.user_id, new.actor_user_id, 'moderation', case when new.action = 'ban' then 'تم حظر عضو من الغرفة' when new.action = 'kick' then 'تم طرد عضو من الغرفة' else 'تم إلغاء حظر عضو' end, 'تم تنفيذ إجراء إشرافي داخل غرفتك.', new.room_id
  from (
    select r.owner_id as user_id from public.rooms r where r.id = new.room_id
    union
    select rm.user_id from public.room_moderators rm where rm.room_id = new.room_id
  ) recipients
  where recipients.user_id <> new.target_user_id;
  return new;
end;
$$;

drop trigger if exists room_moderation_notification_trigger on public.room_moderation_actions;
create trigger room_moderation_notification_trigger after insert on public.room_moderation_actions for each row execute function public.notify_moderation_action();

create or replace function public.notify_speaker_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(user_id, actor_id, kind, title, body, entity_id)
  select distinct recipients.user_id, new.user_id, 'room', 'طلب تحدث جديد', 'طلب عضو التحدث داخل الغرفة.', new.room_id
  from (
    select r.owner_id as user_id from public.rooms r where r.id = new.room_id
    union
    select rm.user_id from public.room_moderators rm where rm.room_id = new.room_id
  ) recipients
  where recipients.user_id <> new.user_id;
  insert into public.room_activity_events(room_id, actor_user_id, target_user_id, event_type) values (new.room_id, new.user_id, new.user_id, 'speaker_request');
  return new;
end;
$$;

drop trigger if exists speaker_request_notification_trigger on public.room_speaker_requests;
create trigger speaker_request_notification_trigger after insert on public.room_speaker_requests for each row when (new.status = 'pending') execute function public.notify_speaker_request();

create or replace function public.notify_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    insert into public.notifications(user_id, kind, title, body, entity_id) values (new.user_id, 'moderation', 'تم تحديث دورك', 'تم تغيير دورك في الغرفة إلى ' || new.role::text || '.', new.room_id);
    insert into public.room_activity_events(room_id, target_user_id, event_type, metadata) values (new.room_id, new.user_id, 'role_change', jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end;
$$;

drop trigger if exists room_member_role_notification_trigger on public.room_members;
create trigger room_member_role_notification_trigger after update of role on public.room_members for each row execute function public.notify_role_change();

create or replace function public.get_room_insights(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (select 1 from public.rooms r where r.id = p_room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(p_room_id))) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  select jsonb_build_object(
    'active_members', count(*) filter (where rm.left_at is null),
    'speakers', count(*) filter (where rm.left_at is null and rm.role = 'speaker'),
    'listeners', count(*) filter (where rm.left_at is null and rm.role = 'listener'),
    'pending_requests', (select count(*) from public.room_speaker_requests sr where sr.room_id = p_room_id and sr.status = 'pending'),
    'kicks_24h', (select count(*) from public.room_moderation_actions ma where ma.room_id = p_room_id and ma.action = 'kick' and ma.created_at > timezone('utc', now()) - interval '24 hours'),
    'bans_24h', (select count(*) from public.room_moderation_actions ma where ma.room_id = p_room_id and ma.action = 'ban' and ma.created_at > timezone('utc', now()) - interval '24 hours'),
    'activity_24h', (select count(*) from public.room_activity_events ae where ae.room_id = p_room_id and ae.created_at > timezone('utc', now()) - interval '24 hours')
  ) into v_result from public.room_members rm where rm.room_id = p_room_id;
  return v_result;
end;
$$;

create or replace function public.list_room_activity(p_room_id uuid, p_limit integer default 30)
returns table(id uuid, event_type text, actor_name text, target_name text, metadata jsonb, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rooms r where r.id = p_room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(p_room_id))) then raise exception using errcode = '42501', message = 'Moderator permission required'; end if;
  return query select ae.id, ae.event_type, actor.display_name, target.display_name, ae.metadata, ae.created_at from public.room_activity_events ae left join public.profiles actor on actor.id = ae.actor_user_id left join public.profiles target on target.id = ae.target_user_id where ae.room_id = p_room_id order by ae.created_at desc limit least(greatest(p_limit, 1), 100);
end;
$$;

alter table public.room_activity_events enable row level security;
create policy room_activity_select_moderator on public.room_activity_events for select to authenticated using (exists (select 1 from public.rooms r where r.id = room_id and (r.owner_id = (select auth.uid()) or public.is_room_moderator(room_id))));
revoke insert, update, delete on public.room_activity_events from anon, authenticated;
revoke execute on function public.get_room_insights(uuid) from public, anon;
revoke execute on function public.list_room_activity(uuid, integer) from public, anon;
grant execute on function public.get_room_insights(uuid) to authenticated;
grant execute on function public.list_room_activity(uuid, integer) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
