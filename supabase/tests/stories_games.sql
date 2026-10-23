begin;

select plan(14);

select has_table('public', 'stories', 'stories table exists');
select has_table('public', 'story_versions', 'story versions table exists');
select has_table('public', 'story_nodes', 'story nodes table exists');
select has_table('public', 'story_choices', 'story choices table exists');
select has_table('public', 'story_progress', 'story progress table exists');
select has_table('public', 'game_templates', 'game templates table exists');
select has_table('public', 'game_sessions', 'game sessions table exists');
select has_table('public', 'game_rounds', 'game rounds table exists');
select has_table('public', 'game_answers', 'game answers table exists');
select has_table('public', 'reward_accounts', 'reward accounts table exists');
select has_table('public', 'reward_ledger', 'reward ledger table exists');
select function_privilege_is('public', 'choose_story_choice(uuid,uuid,text)', 'authenticated', 'EXECUTE', true, 'authenticated users can advance their own story progress through guarded RPC');
select function_privilege_is('public', 'submit_game_answer(uuid,uuid,text,text)', 'authenticated', 'EXECUTE', false, 'clients cannot call the trusted game settlement RPC');
select function_privilege_is('public', 'get_active_game_round(uuid)', 'authenticated', 'EXECUTE', true, 'members can request a sanitized active round');

select * from finish();
rollback;
