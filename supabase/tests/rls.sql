-- Run with `supabase test db` after applying migrations.
-- This file intentionally focuses on negative access paths. Positive paths should be
-- covered by the same fixtures when the auth/profile seed strategy is finalized.

begin;
select plan(12);

-- The migration must have RLS enabled on all phase-two tables.
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.communities'::regclass), 'communities has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.community_members'::regclass), 'community_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.rooms'::regclass), 'rooms has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.room_members'::regclass), 'room_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'reports has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'notifications has RLS enabled');

-- The direct room membership insert path must not be available to authenticated clients;
-- membership is created through join_room() so capacity and authorization are checked.
select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'room_members' and cmd = 'INSERT'
), 'room_members has no direct INSERT policy');
select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'room_members' and cmd = 'UPDATE'
), 'room_members has no direct UPDATE policy');
select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'room_members' and cmd = 'DELETE'
), 'room_members has no direct DELETE policy');
select ok(to_regprocedure('public.discover_public_rooms(text,text,integer,timestamptz)') is not null, 'room discovery RPC exists');
select ok(has_function_privilege('anon', 'public.discover_public_rooms(text,text,integer,timestamptz)', 'EXECUTE'), 'anon can execute public room discovery only');

select * from finish();
rollback;
