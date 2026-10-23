import { supabase } from "../../lib/supabase";
import type { RoomCategory, RoomPreview, RoomType } from "./previewRooms";

const accents: Record<RoomType, string> = {
  سوالف: "#D7AE52",
  قصص: "#A78BFA",
  ألعاب: "#55D6A4",
  مجتمع: "#67B7F7",
};

type DiscoveryRoomRow = {
  id: string;
  title: string;
  description: string | null;
  category: RoomType;
  host_display_name: string;
  listeners_count: number;
};

export async function discoverRooms(category: RoomCategory): Promise<{ data: RoomPreview[]; error: Error | null }> {
  if (!supabase) return { data: [], error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("discover_public_rooms", {
    p_category: category === "الكل" ? null : category,
    p_search: null,
    p_limit: 30,
    p_before: null,
  });
  if (result.error) return { data: [], error: result.error };
  const rows = (result.data ?? []) as DiscoveryRoomRow[];
  return {
    data: rows.map((room) => ({
      id: room.id,
      title: room.title,
      category: room.category,
      host: room.host_display_name,
      listeners: room.listeners_count,
      accent: accents[room.category],
      description: room.description ?? "غرفة صوتية عربية",
      isPreview: false,
    })),
    error: null,
  };
}
