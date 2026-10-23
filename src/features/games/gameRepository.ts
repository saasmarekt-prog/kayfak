import { supabase } from "../../lib/supabase";

export type ActiveGameRound = {
  sessionId: string;
  roundId: string;
  roundNumber: number;
  prompt: string;
  options: string[];
};

export async function getActiveGameRound(roomId: string): Promise<{ data: ActiveGameRound | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const result = await supabase.rpc("get_active_game_round", { p_room_id: roomId });
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: null };
  const row = result.data as { session_id: string; round_id: string; round_number: number; prompt: string; options: unknown };
  const options = Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === "string") : [];
  return { data: { sessionId: row.session_id, roundId: row.round_id, roundNumber: row.round_number, prompt: row.prompt, options }, error: null };
}

export async function submitGameAnswer(roundId: string, answer: string): Promise<{ correct: boolean; pointsAwarded: number; error: Error | null }> {
  if (!supabase) return { correct: false, pointsAwarded: 0, error: new Error("Supabase is not configured") };
  const result = await supabase.functions.invoke("submit-game-answer", { body: { round_id: roundId, answer, idempotency_key: `${roundId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}` } });
  if (result.error) return { correct: false, pointsAwarded: 0, error: result.error };
  const answerResult = result.data?.answer as { is_correct?: boolean; points_awarded?: number } | undefined;
  return { correct: Boolean(answerResult?.is_correct), pointsAwarded: answerResult?.points_awarded ?? 0, error: null };
}
