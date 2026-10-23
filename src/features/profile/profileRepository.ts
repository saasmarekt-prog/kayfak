import { supabase } from "../../lib/supabase";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  visibility: "public" | "private";
};

export async function getMyProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.from("profiles").select("id, username, display_name, bio, avatar_url, visibility").eq("id", userId).maybeSingle();
  if (result.error) return { data: null, error: result.error };
  return { data: result.data as Profile | null, error: null };
}

export async function updateMyProfile(
  userId: string,
  changes: Pick<Profile, "username" | "display_name" | "bio" | "avatar_url" | "visibility">,
): Promise<{ data: Profile | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.from("profiles").update(changes).eq("id", userId).select("id, username, display_name, bio, avatar_url, visibility").single();
  if (result.error) return { data: null, error: result.error };
  return { data: result.data as Profile, error: null };
}
