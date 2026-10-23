import { supabase } from "../../lib/supabase";

export type SpeakerRequest = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export async function getRoomModerationState(roomId: string): Promise<{ canManage: boolean; error: Error | null }> {
  if (!supabase) return { canManage: false, error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("get_room_moderation_state", { p_room_id: roomId });
  if (result.error) return { canManage: false, error: result.error };
  return { canManage: Boolean((result.data as { can_manage?: boolean } | null)?.can_manage), error: null };
}

export async function listPendingSpeakerRequests(roomId: string): Promise<{ data: SpeakerRequest[]; error: Error | null }> {
  if (!supabase) return { data: [], error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("list_pending_speaker_requests", { p_room_id: roomId });
  if (result.error) return { data: [], error: result.error };
  const rows = (result.data ?? []) as Array<{ id: string; user_id: string; display_name: string; avatar_url: string | null; created_at: string }>;
  return { data: rows.map((row) => ({ id: row.id, userId: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url, createdAt: row.created_at })), error: null };
}

export async function reviewSpeakerRequest(requestId: string, approve: boolean): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("review_speaker_request", { p_request_id: requestId, p_approve: approve });
  return { error: result.error ?? null };
}
