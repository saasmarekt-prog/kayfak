import { withSupabase } from "npm:@supabase/server@1";
import { RoomServiceClient } from "npm:livekit-server-sdk@2.19.2";

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const body = await req.json().catch(() => null) as { room_id?: string; target_user_id?: string; action?: string; reason?: string } | null;
    const roomId = body?.room_id?.trim();
    const targetUserId = body?.target_user_id?.trim();
    const action = body?.action?.trim();
    const reason = body?.reason?.trim() ?? "";
    if (!roomId || !targetUserId || !action || !["kick", "ban", "unban"].includes(action) || reason.length > 500) return Response.json({ error: "Invalid moderation request" }, { status: 400 });

    const { data, error } = await ctx.supabase.rpc("moderate_room_member", { p_room_id: roomId, p_target_user_id: targetUserId, p_action: action, p_reason: reason });
    if (error) return Response.json({ error: "Moderation action was rejected" }, { status: 403 });

    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const providerRoomId = (data as { provider_room_id?: string } | null)?.provider_room_id;
    if (providerRoomId && livekitUrl && livekitKey && livekitSecret && (action === "kick" || action === "ban")) {
      try {
        const roomService = new RoomServiceClient(livekitUrl, livekitKey, livekitSecret);
        await roomService.removeParticipant(providerRoomId, targetUserId);
      } catch (livekitError) {
        console.error("LiveKit participant removal failed", livekitError);
        return Response.json({ action: data, warning: "Database action succeeded but LiveKit removal could not be confirmed" }, { status: 202 });
      }
    }
    return Response.json({ action: data, livekit_removed: Boolean(providerRoomId && livekitUrl && livekitKey && livekitSecret && (action === "kick" || action === "ban")) });
  }),
);
