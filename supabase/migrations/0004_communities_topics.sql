begin;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  is_pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'helpful', 'celebrate')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, user_id)
);

create index if not exists community_posts_feed_idx on public.community_posts(community_id, created_at desc) where deleted_at is null;
create index if not exists community_posts_author_idx on public.community_posts(author_id, created_at desc);

create or replace function public.is_community_moderator(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and cm.role in ('owner', 'moderator')
  );
$$;

create or replace function public.create_community(
  p_slug text,
  p_name text,
  p_description text,
  p_visibility public.community_visibility default 'public',
  p_requires_approval boolean default false
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_community public.communities;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  insert into public.communities(owner_id, slug, name, description, visibility, requires_approval)
  values (v_user_id, lower(trim(p_slug)), trim(p_name), nullif(trim(p_description), ''), p_visibility, coalesce(p_requires_approval, false))
  returning * into v_community;
  return v_community;
end;
$$;

create or replace function public.request_community_membership(p_community_id uuid)
returns public.community_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_requires_approval boolean;
  v_member public.community_members;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select requires_approval into v_requires_approval from public.communities where id = p_community_id and visibility = 'public';
  if not found then raise exception using errcode = '42501', message = 'Community is not joinable'; end if;
  insert into public.community_members(community_id, user_id, role, status, joined_at)
  values (p_community_id, v_user_id, 'member', case when v_requires_approval then 'pending' else 'active' end, case when v_requires_approval then null else timezone('utc', now()) end)
  on conflict (community_id, user_id) do update set status = excluded.status, joined_at = excluded.joined_at, updated_at = timezone('utc', now())
  returning * into v_member;
  return v_member;
end;
$$;

create or replace function public.create_community_post(p_community_id uuid, p_title text, p_body text)
returns public.community_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_post public.community_posts;
begin
  if v_user_id is null or not public.is_community_member(p_community_id) then raise exception using errcode = '42501', message = 'Active community membership required'; end if;
  insert into public.community_posts(community_id, author_id, title, body)
  values (p_community_id, v_user_id, trim(p_title), trim(p_body))
  returning * into v_post;
  return v_post;
end;
$$;

alter table public.community_posts enable row level security;
alter table public.community_post_reactions enable row level security;

create policy community_posts_select_allowed on public.community_posts for select to authenticated using (
  deleted_at is null and (public.is_community_member(community_id) or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public'))
);
create policy community_posts_update_allowed on public.community_posts for update to authenticated using (
  author_id = (select auth.uid()) or public.is_community_moderator(community_id)
) with check (author_id = (select auth.uid()) or public.is_community_moderator(community_id));
create policy community_posts_delete_allowed on public.community_posts for delete to authenticated using (
  author_id = (select auth.uid()) or public.is_community_moderator(community_id)
);
create policy community_post_reactions_select_allowed on public.community_post_reactions for select to authenticated using (
  exists (select 1 from public.community_posts p where p.id = post_id and (public.is_community_member(p.community_id) or exists (select 1 from public.communities c where c.id = p.community_id and c.visibility = 'public')))
);
create policy community_post_reactions_insert_self on public.community_post_reactions for insert to authenticated with check (user_id = (select auth.uid()));
create policy community_post_reactions_update_self on public.community_post_reactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy community_post_reactions_delete_self on public.community_post_reactions for delete to authenticated using (user_id = (select auth.uid()));

-- Creation and membership requests go through validated RPCs, not direct table writes.
drop policy if exists communities_insert_self on public.communities;
drop policy if exists community_members_insert_self on public.community_members;

revoke execute on function public.is_community_moderator(uuid) from public;
revoke execute on function public.create_community(text, text, text, public.community_visibility, boolean) from public;
revoke execute on function public.request_community_membership(uuid) from public;
revoke execute on function public.create_community_post(uuid, text, text) from public;
grant execute on function public.create_community(text, text, text, public.community_visibility, boolean) to authenticated;
grant execute on function public.request_community_membership(uuid) to authenticated;
grant execute on function public.create_community_post(uuid, text, text) to authenticated;

create trigger community_posts_set_updated_at before update on public.community_posts for each row execute function public.set_updated_at();

commit;
