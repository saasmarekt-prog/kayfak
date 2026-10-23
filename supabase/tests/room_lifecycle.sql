begin;
select plan(10);

select ok(to_regclass('public.room_moderators') is not null, 'room_moderators table exists');
select ok(to_regclass('public.room_invites') is not null, 'room_invites table exists');
select ok(to_regclass('public.room_audio_sessions') is not null, 'room_audio_sessions table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.room_moderators'::regclass), 'room_moderators has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.room_invites'::regclass), 'room_invites has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.room_audio_sessions'::regclass), 'room_audio_sessions has RLS');
select ok(to_regprocedure('public.create_room(text,text,text,public.room_visibility,integer,uuid)') is not null, 'create_room RPC exists');
select ok(to_regprocedure('public.invite_user_to_room(uuid,uuid)') is not null, 'invite RPC exists');
select ok(to_regprocedure('public.end_room(uuid)') is not null, 'end_room RPC exists');
select ok(has_function_privilege('service_role', 'public.register_audio_session(uuid,text,text,public.audio_session_status,text)', 'EXECUTE'), 'only the trusted audio role receives audio registration execution');

select * from finish();
rollback;
