begin;

select plan(8);
select has_table('public', 'room_bans', 'room bans table exists');
select has_table('public', 'room_moderation_actions', 'moderation audit table exists');
select has_column('public', 'room_bans', 'expires_at', 'room bans support expiration');
select has_column('public', 'room_moderation_actions', 'action', 'moderation actions record action');
select function_privilege_is('public', 'moderate_room_member(uuid,uuid,text,text)', 'authenticated', 'EXECUTE', true, 'authenticated clients use guarded moderation RPC');
select function_privilege_is('public', 'moderate_room_member(uuid,uuid,text,text)', 'anon', 'EXECUTE', false, 'anonymous clients cannot moderate');
select function_privilege_is('public', 'join_room(uuid)', 'authenticated', 'EXECUTE', true, 'join path remains available for ban enforcement');
select has_index('public', 'active_room_ban_unique', 'active room bans are unique');
select * from finish();
rollback;
