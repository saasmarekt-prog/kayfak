begin;

-- Search remains deliberately small and bounded until a measured full-text strategy is needed.
create index if not exists profiles_display_name_lower_idx on public.profiles (lower(display_name));
create index if not exists rooms_live_public_category_idx on public.rooms (category, created_at desc) where status = 'live' and visibility = 'public';

create or replace function public.discover_public_rooms(
  p_category text default null,
  p_search text default null,
  p_limit integer default 30,
  p_before timestamptz default null
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  host_display_name text,
  listeners_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if p_category is not null and p_category not in ('سوالف', 'قصص', 'ألعاب', 'مجتمع') then
    raise exception using errcode = '22023', message = 'Invalid room category';
  end if;

  return query
  select
    r.id,
    r.title,
    r.description,
    r.category,
    coalesce(p.display_name, 'مستخدم') as host_display_name,
    count(rm.user_id)::integer as listeners_count,
    r.created_at
  from public.rooms r
  join public.profiles p on p.id = r.owner_id
  left join public.room_members rm on rm.room_id = r.id and rm.left_at is null
  where r.status = 'live'
    and r.visibility = 'public'
    and (p_category is null or r.category = p_category)
    and (p_before is null or r.created_at < p_before)
    and (
      v_search is null
      or r.title ilike '%' || replace(replace(replace(v_search, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
      or coalesce(r.description, '') ilike '%' || replace(replace(replace(v_search, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
    )
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = r.owner_id
    )
  group by r.id, p.display_name
  order by r.created_at desc
  limit v_limit;
end;
$$;

revoke execute on function public.discover_public_rooms(text, text, integer, timestamptz) from public;
grant execute on function public.discover_public_rooms(text, text, integer, timestamptz) to anon;
grant execute on function public.discover_public_rooms(text, text, integer, timestamptz) to authenticated;

commit;
