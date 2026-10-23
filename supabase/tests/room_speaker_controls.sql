begin;

select plan(7);
select has_table('public', 'room_speaker_requests', 'speaker request table exists');
select has_column('public', 'room_speaker_requests', 'status', 'speaker requests have status');
select has_column('public', 'room_speaker_requests', 'reviewed_by', 'speaker requests keep reviewer');
select function_privilege_is('public', 'request_to_speak(uuid)', 'authenticated', 'EXECUTE', true, 'members can request to speak through guarded RPC');
select function_privilege_is('public', 'review_speaker_request(uuid,boolean)', 'authenticated', 'EXECUTE', true, 'moderators can review speaker requests through guarded RPC');
select function_privilege_is('public', 'set_room_member_role(uuid,uuid,public.room_member_role)', 'authenticated', 'EXECUTE', true, 'moderators can change room roles through guarded RPC');
select has_column('public', 'room_speaker_requests', 'reviewed_at', 'speaker requests keep review time');
select * from finish();
rollback;
