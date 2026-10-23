import { supabase } from "../../lib/supabase";

export type StoryCard = {
  id: string;
  versionId: string;
  title: string;
  description: string;
  versionNumber: number;
};

export type StoryChoice = {
  id: string;
  label: string;
  rewardPoints: number;
  nextNodeId: string | null;
};

export type StoryNode = {
  id: string;
  versionId: string;
  kind: "start" | "scene" | "ending";
  title: string;
  body: string;
  choices: StoryChoice[];
};

export type StoryProgress = {
  progressId: string;
  currentNodeId: string;
  completed: boolean;
  pointsAwarded: number;
};

export async function listPublishedStories(): Promise<{ data: StoryCard[]; error: Error | null }> {
  if (!supabase) return { data: [], error: new Error("Supabase is not configured") };
  const result = await supabase
    .from("stories")
    .select("id,title,description,story_versions!inner(id,version_number,status)")
    .eq("status", "published")
    .eq("story_versions.status", "published")
    .order("created_at", { ascending: false });
  if (result.error) return { data: [], error: result.error };
  const data = (result.data ?? []).flatMap((row) => {
    const versions = Array.isArray(row.story_versions) ? row.story_versions : [row.story_versions];
    return versions.map((version) => ({
      id: row.id as string,
      versionId: (version as { id: string }).id,
      title: row.title as string,
      description: row.description as string,
      versionNumber: (version as { version_number: number }).version_number,
    }));
  });
  return { data, error: null };
}

export async function loadStoryNode(nodeId: string): Promise<{ data: StoryNode | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.from("story_nodes").select("id,version_id,kind,title,body,story_choices(id,label,reward_points,next_node_id,sort_order)").eq("id", nodeId).single();
  if (result.error) return { data: null, error: result.error };
  const row = result.data as unknown as { id: string; version_id: string; kind: StoryNode["kind"]; title: string; body: string; story_choices?: Array<{ id: string; label: string; reward_points: number; next_node_id: string | null; sort_order: number }> };
  return {
    data: {
      id: row.id,
      versionId: row.version_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      choices: (row.story_choices ?? []).sort((a, b) => a.sort_order - b.sort_order).map((choice) => ({ id: choice.id, label: choice.label, rewardPoints: choice.reward_points, nextNodeId: choice.next_node_id })),
    },
    error: null,
  };
}

export async function startStory(versionId: string): Promise<{ data: StoryProgress | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("start_story", { p_version_id: versionId });
  if (result.error) return { data: null, error: result.error };
  const row = result.data as { id: string; current_node_id: string; completed_at: string | null };
  return { data: { progressId: row.id, currentNodeId: row.current_node_id, completed: Boolean(row.completed_at), pointsAwarded: 0 }, error: null };
}

export async function chooseStoryChoice(progressId: string, choiceId: string): Promise<{ data: StoryProgress | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const requestKey = `${progressId}:${choiceId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const result = await supabase.rpc("choose_story_choice", { p_progress_id: progressId, p_choice_id: choiceId, p_request_key: requestKey });
  if (result.error) return { data: null, error: result.error };
  const row = result.data as { progress_id: string; current_node_id: string; completed: boolean; points_awarded: number };
  return { data: { progressId: row.progress_id, currentNodeId: row.current_node_id, completed: row.completed, pointsAwarded: row.points_awarded }, error: null };
}
