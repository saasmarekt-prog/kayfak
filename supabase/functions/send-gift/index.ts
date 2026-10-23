import { withSupabase } from "npm:@supabase/server@1";

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => null) as { receiver_id?: string; gift_code?: string; coin_cost?: number; idempotency_key?: string } | null;
    const senderId = ctx.userClaims?.id;
    const receiverId = body?.receiver_id?.trim();
    const giftCode = body?.gift_code?.trim();
    const idempotencyKey = body?.idempotency_key?.trim();
    const coinCost = body?.coin_cost;
    if (!senderId || !receiverId || !giftCode || !idempotencyKey || typeof coinCost !== "number" || !Number.isSafeInteger(coinCost) || coinCost <= 0 || coinCost > 1000000) {
      return Response.json({ error: "Invalid gift request" }, { status: 400 });
    }

    const { data, error } = await ctx.supabaseAdmin.rpc("record_gift", { p_sender_id: senderId, p_receiver_id: receiverId, p_gift_code: giftCode, p_coin_cost: coinCost, p_idempotency_key: idempotencyKey });
    if (error) return Response.json({ error: "Gift could not be settled" }, { status: 400 });
    return Response.json({ gift: data });
  }),
);
