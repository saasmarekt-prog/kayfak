import { supabase } from "../../lib/supabase";
import type { RoomCategory, RoomPreview, RoomType } from "./previewRooms";

export type CreatedRoom = {
  id: string;
  title: string;
  description: string | null;
  category: RoomType;
  visibility: "public" | "private";
  status: "draft" | "live" | "ended";
};

export async function createRoom(input: {
  title: string;
  description: string;
  category: RoomType;
  visibility: "public" | "private";
  capacity: number;
}): Promise<{ data: CreatedRoom | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("create_room", {
    p_title: input.title,
    p_description: input.description || null,
    p_category: input.category,
    p_visibility: input.visibility,
    p_capacity: input.capacity,
    p_community_id: null,
  });
  if (result.error) return { data: null, error: result.error };
  return { data: result.data as CreatedRoom, error: null };
}

export async function joinRoom(roomId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("join_room", { p_room_id: roomId });
  return { error: result.error ?? null };
}

export async function leaveRoom(roomId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("leave_room", { p_room_id: roomId });
  return { error: result.error ?? null };
}

export async function endRoom(roomId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("end_room", { p_room_id: roomId });
  return { error: result.error ?? null };
}

export async function requestLiveKitToken(roomId: string): Promise<{ data: { token: string; url: string } | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.functions.invoke("livekit-token", { body: { room_id: roomId } });
  if (result.error) return { data: null, error: result.error };
  return { data: result.data as { token: string; url: string }, error: null };
}

export function createdRoomToPreview(room: CreatedRoom): RoomPreview {
  return {
    id: room.id,
    title: room.title,
    category: room.category,
    host: "أنت",
    listeners: 1,
    accent: room.category === "سوالف" ? "#D7AE52" : room.category === "قصص" ? "#A78BFA" : room.category === "ألعاب" ? "#55D6A4" : "#67B7F7",
    description: room.description ?? "غرفة صوتية عربية",
    isPreview: false,
  };
}

export function isSupportedRoomCategory(value: RoomCategory): value is RoomType {
  return value !== "الكل";
}
