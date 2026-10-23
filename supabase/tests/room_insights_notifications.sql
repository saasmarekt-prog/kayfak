begin;

select plan(10);
select has_table('public', 'room_activity_events', 'room activity table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_column('public', 'room_activity_events', 'event_type', 'activity records event type');
select has_column('public', 'room_activity_events', 'metadata', 'activity records metadata');
select function_privilege_is('public', 'get_room_insights(uuid)', 'authenticated', 'EXECUTE', true, 'moderators can read room insights');
select function_privilege_is('public', 'list_room_activity(uuid,integer)', 'authenticated', 'EXECUTE', true, 'moderators can read room activity');
select function_privilege_is('public', 'get_room_insights(uuid)', 'anon', 'EXECUTE', false, 'anonymous users cannot read room insights');
select function_privilege_is('public', 'list_room_activity(uuid,integer)', 'anon', 'EXECUTE', false, 'anonymous users cannot read room activity');
select has_index('public', 'room_activity_events_room_idx', 'room activity is indexed by room and time');
select has_index('public', 'notifications_user_idx', 'notifications are indexed by user');
select * from finish();
rollback;
