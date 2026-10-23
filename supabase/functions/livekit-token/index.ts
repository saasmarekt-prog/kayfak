import { withSupabase } from "npm:@supabase/server@1";
import { AccessToken } from "npm:livekit-server-sdk@2.19.2";

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => null) as { room_id?: string } | null;
    const roomId = body?.room_id?.trim();
    const userId = ctx.userClaims?.id;
    if (!roomId || !userId) return Response.json({ error: "room_id and authentication are required" }, { status: 400 });

    const [{ data: session, error: sessionError }, { data: membership, error: membershipError }] = await Promise.all([
      ctx.supabase.from("room_audio_sessions").select("provider, provider_room_id, status").eq("room_id", roomId).eq("status", "active").maybeSingle(),
      ctx.supabase.from("room_members").select("role").eq("room_id", roomId).eq("user_id", userId).is("left_at", null).maybeSingle(),
    ]);
    if (sessionError || membershipError || !session || !membership || session.provider !== "livekit") {
      return Response.json({ error: "Active audio membership not found" }, { status: 403 });
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !livekitUrl) return Response.json({ error: "LiveKit is not configured" }, { status: 503 });

    const token = new AccessToken(apiKey, apiSecret, { identity: userId, ttl: "10m" });
    token.addGrant({ roomJoin: true, room: session.provider_room_id, canSubscribe: true, canPublish: membership.role !== "listener" });
    return Response.json({ token: await token.toJwt(), url: livekitUrl, expires_in: 600 });
  }),
);
