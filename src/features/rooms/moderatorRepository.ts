import { supabase } from "../../lib/supabase";

export type SpeakerRequest = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type RoomMemberRole = "listener" | "speaker" | "host";

export type RoomMember = {
  userId: string;
  displayName: string;
  role: RoomMemberRole;
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

export async function listActiveRoomMembers(roomId: string): Promise<{ data: RoomMember[]; error: Error | null }> {
  if (!supabase) return { data: [], error: new Error("Supabase is not configured") };
  const result = await supabase.from("room_members").select("user_id,role,profiles(display_name)").eq("room_id", roomId).is("left_at", null).order("joined_at", { ascending: true });
  if (result.error) return { data: [], error: result.error };
  const rows = (result.data ?? []) as Array<{ user_id: string; role: RoomMemberRole; profiles: { display_name: string } | Array<{ display_name: string }> | null }>;
  return { data: rows.map((row) => { const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles; return { userId: row.user_id, displayName: profile?.display_name ?? "مستخدم", role: row.role }; }), error: null };
}

export async function setRoomMemberRole(roomId: string, userId: string, role: Exclude<RoomMemberRole, "host">): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("set_room_member_role", { p_room_id: roomId, p_user_id: userId, p_role: role });
  return { error: result.error ?? null };
}

export async function moderateRoomMember(roomId: string, userId: string, action: "kick" | "ban", reason: string): Promise<{ error: Error | null; warning?: string }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.functions.invoke("moderate-room-member", { body: { room_id: roomId, target_user_id: userId, action, reason } });
  if (result.error) return { error: result.error };
  return { error: null, warning: typeof result.data?.warning === "string" ? result.data.warning : undefined };
}
