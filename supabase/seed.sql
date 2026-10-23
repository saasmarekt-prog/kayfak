-- Safe local/staging seed. It never creates auth users or embeds secrets.
-- Create one local user first with `supabase auth admin create-user`, then rerun `supabase db reset`.

begin;

insert into public.game_templates (code, title, kind, config, enabled)
values
  ('quick-quiz', 'اختبار سريع', 'quiz', '{"max_rounds": 5, "answer_mode": "single"}'::jsonb, true),
  ('room-poll', 'تصويت الغرفة', 'poll', '{"max_options": 4}'::jsonb, true)
on conflict (code) do update set title = excluded.title, config = excluded.config, enabled = excluded.enabled;

do $$
declare
  v_creator uuid;
  v_story_id uuid;
  v_version_id uuid;
  v_start_id uuid;
  v_scene_id uuid;
  v_end_id uuid;
begin
  select id into v_creator from public.profiles order by created_at limit 1;
  if v_creator is null then
    raise notice 'No profile exists; game templates were seeded, story demo waits for a local profile.';
    return;
  end if;

  insert into public.stories (creator_id, slug, title, description, status)
  values (v_creator, 'welcome-to-kayfak', 'بداية كيفك', 'قصة قصيرة للتحقق من تدفق المشاهد والاختيارات والمكافآت.', 'published')
  on conflict (slug) do update set title = excluded.title, description = excluded.description, status = excluded.status
  returning id into v_story_id;

  insert into public.story_versions (story_id, version_number, status, published_at)
  values (v_story_id, 1, 'published', timezone('utc', now()))
  on conflict (story_id, version_number) do update set status = excluded.status, published_at = excluded.published_at
  returning id into v_version_id;

  insert into public.story_nodes (version_id, node_key, kind, title, body)
  values (v_version_id, 'start', 'start', 'أول خطوة', 'وجدت غرفة هادئة وبدأت رحلة جديدة. ماذا ستفعل؟')
  on conflict (version_id, node_key) do update set title = excluded.title, body = excluded.body
  returning id into v_start_id;

  insert into public.story_nodes (version_id, node_key, kind, title, body)
  values (v_version_id, 'scene-one', 'scene', 'اختيارك الأول', 'أحسنت. قرارك فتح لك طريقًا جديدًا داخل المجتمع.')
  on conflict (version_id, node_key) do update set title = excluded.title, body = excluded.body
  returning id into v_scene_id;

  insert into public.story_nodes (version_id, node_key, kind, title, body)
  values (v_version_id, 'ending', 'ending', 'نهاية البداية', 'اكتملت التجربة التجريبية وحُفظ تقدمك.')
  on conflict (version_id, node_key) do update set title = excluded.title, body = excluded.body
  returning id into v_end_id;

  insert into public.story_choices (node_id, label, next_node_id, reward_points, sort_order)
  values
    (v_start_id, 'أشارك في الحديث', v_scene_id, 10, 1),
    (v_scene_id, 'أكمل التجربة', v_end_id, 20, 1)
  on conflict (node_id, sort_order) do update set label = excluded.label, next_node_id = excluded.next_node_id, reward_points = excluded.reward_points;
end $$;

commit;
