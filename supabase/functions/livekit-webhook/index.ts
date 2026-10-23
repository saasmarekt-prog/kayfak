import { withSupabase } from "npm:@supabase/server@1";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.19.2";

Deno.serve(
  withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!apiKey || !apiSecret) return Response.json({ error: "LiveKit webhook is not configured" }, { status: 503 });

    const rawBody = await req.text();
    const authorization = req.headers.get("authorization") ?? "";
    let event: { event?: string; room?: { name?: string } };
    try {
      event = await new WebhookReceiver(apiKey, apiSecret).receive(rawBody, authorization) as unknown as { event?: string; room?: { name?: string } };
    } catch (_error) {
      return Response.json({ error: "Invalid LiveKit webhook signature" }, { status: 401 });
    }

    const providerRoomId = event.room?.name;
    if (!providerRoomId) return Response.json({ received: true });
    const { data: audioSession } = await ctx.supabaseAdmin.from("room_audio_sessions").select("room_id").eq("provider_room_id", providerRoomId).maybeSingle();
    if (!audioSession) return Response.json({ received: true });

    if (event.event === "room_started") {
      await ctx.supabaseAdmin.rpc("register_audio_session", { p_room_id: audioSession.room_id, p_provider: "livekit", p_provider_room_id: providerRoomId, p_status: "active", p_failure_reason: null });
    } else if (event.event === "room_finished") {
      await ctx.supabaseAdmin.rpc("register_audio_session", { p_room_id: audioSession.room_id, p_provider: "livekit", p_provider_room_id: providerRoomId, p_status: "ended", p_failure_reason: null });
    }
    return Response.json({ received: true });
  }),
);
