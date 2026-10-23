import { supabase } from "../../lib/supabase";

export type RoomInsights = { activeMembers: number; speakers: number; listeners: number; pendingRequests: number; kicks24h: number; bans24h: number; activity24h: number };
export type ActivityEvent = { id: string; eventType: string; actorName: string | null; targetName: string | null; metadata: Record<string, unknown>; createdAt: string };

export async function getRoomInsights(roomId: string): Promise<{ data: RoomInsights | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("get_room_insights", { p_room_id: roomId });
  if (result.error) return { data: null, error: result.error };
  const row = result.data as Record<string, number>;
  return { data: { activeMembers: row.active_members ?? 0, speakers: row.speakers ?? 0, listeners: row.listeners ?? 0, pendingRequests: row.pending_requests ?? 0, kicks24h: row.kicks_24h ?? 0, bans24h: row.bans_24h ?? 0, activity24h: row.activity_24h ?? 0 }, error: null };
}

export async function listRoomActivity(roomId: string): Promise<{ data: ActivityEvent[]; error: Error | null }> {
  if (!supabase) return { data: [], error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("list_room_activity", { p_room_id: roomId, p_limit: 30 });
  if (result.error) return { data: [], error: result.error };
  const rows = (result.data ?? []) as Array<{ id: string; event_type: string; actor_name: string | null; target_name: string | null; metadata: Record<string, unknown>; created_at: string }>;
  return { data: rows.map((row) => ({ id: row.id, eventType: row.event_type, actorName: row.actor_name, targetName: row.target_name, metadata: row.metadata, createdAt: row.created_at })), error: null };
}
