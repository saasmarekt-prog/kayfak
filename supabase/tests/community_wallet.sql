begin;
select plan(14);

select ok(to_regclass('public.community_posts') is not null, 'community_posts table exists');
select ok(to_regclass('public.community_post_reactions') is not null, 'community_post_reactions table exists');
select ok(to_regclass('public.wallet_accounts') is not null, 'wallet_accounts table exists');
select ok(to_regclass('public.ledger_entries') is not null, 'ledger_entries table exists');
select ok(to_regclass('public.gifts') is not null, 'gifts table exists');
select ok(to_regclass('public.purchases') is not null, 'purchases table exists');
select ok(to_regclass('public.subscriptions') is not null, 'subscriptions table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.ledger_entries'::regclass), 'ledger_entries has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.purchases'::regclass), 'purchases has RLS');
select ok(to_regprocedure('public.create_community(text,text,text,public.community_visibility,boolean)') is not null, 'create community RPC exists');
select ok(to_regprocedure('public.create_community_post(uuid,text,text)') is not null, 'create topic RPC exists');
select ok(to_regprocedure('public.record_gift(uuid,uuid,text,bigint,text)') is not null, 'gift settlement RPC exists');
select ok(to_regprocedure('public.record_purchase_credit(uuid,text,text,text,bigint,text,jsonb)') is not null, 'purchase settlement RPC exists');
select ok(has_function_privilege('service_role', 'public.record_purchase_credit(uuid,text,text,text,bigint,text,jsonb)', 'EXECUTE'), 'billing settlement is service-only');

select * from finish();
rollback;
