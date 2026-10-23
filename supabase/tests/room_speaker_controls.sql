begin;

select plan(9);
select has_table('public', 'room_speaker_requests', 'speaker request table exists');
select has_column('public', 'room_speaker_requests', 'status', 'speaker requests have status');
select has_column('public', 'room_speaker_requests', 'reviewed_by', 'speaker requests keep reviewer');
select function_privilege_is('public', 'request_to_speak(uuid)', 'authenticated', 'EXECUTE', true, 'members can request to speak through guarded RPC');
select function_privilege_is('public', 'review_speaker_request(uuid,boolean)', 'authenticated', 'EXECUTE', true, 'moderators can review speaker requests through guarded RPC');
select function_privilege_is('public', 'set_room_member_role(uuid,uuid,public.room_member_role)', 'authenticated', 'EXECUTE', true, 'moderators can change room roles through guarded RPC');
select has_column('public', 'room_speaker_requests', 'reviewed_at', 'speaker requests keep review time');
select function_privilege_is('public', 'get_room_moderation_state(uuid)', 'authenticated', 'EXECUTE', true, 'clients can ask for sanitized moderation state');
select function_privilege_is('public', 'list_pending_speaker_requests(uuid)', 'authenticated', 'EXECUTE', true, 'moderators can load pending speaker requests');
select * from finish();
rollback;
