import { withSupabase } from "npm:@supabase/server@1";

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => null) as { round_id?: string; answer?: string; idempotency_key?: string } | null;
    const userId = ctx.userClaims?.id;
    const roundId = body?.round_id?.trim();
    const answer = body?.answer?.trim();
    const idempotencyKey = body?.idempotency_key?.trim();
    if (!userId || !roundId || !answer || answer.length > 500 || !idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return Response.json({ error: "Invalid answer request" }, { status: 400 });
    }
    const { data, error } = await ctx.supabaseAdmin.rpc("submit_game_answer", {
      p_round_id: roundId,
      p_user_id: userId,
      p_answer: answer,
      p_idempotency_key: idempotencyKey,
    });
    if (error) return Response.json({ error: "Answer could not be settled" }, { status: 400 });
    return Response.json({ answer: data });
  }),
);
