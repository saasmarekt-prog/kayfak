import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import type { RoomPreview } from "../discovery/previewRooms";
import { endRoom, joinRoom, leaveRoom, requestLiveKitToken } from "../discovery/roomCommands";
import { LiveKitAudioRoom } from "./LiveKitAudioRoom";
import { GameRoundPanel } from "../games/GameRoundPanel";
import { ModeratorPanel } from "./ModeratorPanel";

type RoomScreenProps = { room: RoomPreview; isAuthenticated: boolean; onBack: () => void; onChanged: (message: string) => void };

export function RoomScreen({ room, isAuthenticated, onBack, onChanged }: RoomScreenProps) {
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioCredentials, setAudioCredentials] = useState<{ token: string; url: string } | null>(null);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<{ error: Error | null }>, success: string) => {
    if (!isAuthenticated) { setError("سجّل الدخول أولًا للانضمام إلى الغرفة."); return; }
    setBusy(true); setError(""); const result = await action(); setBusy(false);
    if (result.error) { setError("تعذر تنفيذ العملية. تأكد من تطبيق migrations وصلاحيات الحساب."); return; }
    onChanged(success);
  };

  const prepareAudio = async () => {
    if (!isAuthenticated) { setError("سجّل الدخول أولًا."); return; }
    setBusy(true); setError("");
    const result = await requestLiveKitToken(room.id);
    setBusy(false);
    if (result.error) { setError("تعذر إصدار رمز الصوت. تأكد من تشغيل Edge Function وإعداد LiveKit."); return; }
    if (result.data) setAudioCredentials(result.data);
    setAudioReady(Boolean(result.data));
    onChanged("تم تجهيز الاتصال الصوتي الحقيقي.");
  };

  return (
    <View style={styles.card}>
      <Pressable onPress={onBack}><Text style={styles.back}>← العودة للاكتشاف</Text></Pressable>
      <View style={[styles.accent, { backgroundColor: room.accent }]} />
      <Text style={styles.category}>{room.category}</Text>
      <Text style={styles.title}>{room.title}</Text>
      <Text style={styles.body}>{room.description}</Text>
      <Text style={styles.meta}>بواسطة {room.host} · {room.listeners} مستمعًا</Text>
      <ModeratorPanel roomId={room.id} isAuthenticated={isAuthenticated} />
      <View style={styles.notice}><Text style={styles.noticeText}>الصوت الحقيقي يحتاج مزودًا موثوقًا ورمز اتصال قصير العمر من backend. هذه الشاشة لا تنشئ اتصالًا وهميًا.</Text></View>
      {!joined ? <Pressable disabled={busy} onPress={() => run(async () => { const result = await joinRoom(room.id); if (!result.error) setJoined(true); return result; }, "تم الانضمام إلى الغرفة.")} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "جارٍ الانضمام..." : "انضمام إلى الغرفة"}</Text></Pressable> : <><Pressable disabled={busy || audioReady} onPress={prepareAudio} style={[styles.primary, (busy || audioReady) && styles.disabled]}><Text style={styles.primaryText}>{audioReady ? "الاتصال الصوتي جاهز" : busy ? "جارٍ تجهيز الصوت..." : "بدء الاتصال الصوتي"}</Text></Pressable>{audioCredentials && <LiveKitAudioRoom token={audioCredentials.token} serverUrl={audioCredentials.url} />}<GameRoundPanel roomId={room.id} /><View style={styles.row}><Pressable disabled={busy} onPress={() => run(async () => { const result = await leaveRoom(room.id); if (!result.error) { setJoined(false); setAudioReady(false); setAudioCredentials(null); } return result; }, "تمت مغادرة الغرفة.")} style={styles.secondary}><Text style={styles.secondaryText}>مغادرة</Text></Pressable><Pressable disabled={busy} onPress={() => run(() => endRoom(room.id), "تم إنهاء الغرفة.")} style={styles.danger}><Text style={styles.dangerText}>إنهاء</Text></Pressable></View></>}
      {error.length > 0 && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 12, padding: 20 }, back: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "right" }, accent: { borderRadius: 5, height: 6, width: 54 }, category: { color: colors.muted, fontSize: 12, textAlign: "right" }, title: { color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "right" }, body: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: "right" }, meta: { color: "#C0CBDA", fontSize: 12, textAlign: "right" }, notice: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder, borderRadius: 13, borderWidth: 1, padding: 12 }, noticeText: { color: "#F4DCA3", fontSize: 12, lineHeight: 20, textAlign: "right" }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 13, paddingVertical: 13 }, primaryText: { color: "#101827", fontSize: 14, fontWeight: "900" }, row: { flexDirection: "row-reverse", gap: 8 }, secondary: { alignItems: "center", borderColor: colors.border, borderRadius: 13, borderWidth: 1, flex: 1, paddingVertical: 13 }, secondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" }, danger: { alignItems: "center", backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder, borderRadius: 13, borderWidth: 1, flex: 1, paddingVertical: 13 }, dangerText: { color: "#F4B4A3", fontSize: 14, fontWeight: "800" }, error: { color: "#F4B4A3", fontSize: 12, lineHeight: 19, textAlign: "right" }, disabled: { opacity: 0.55 },
});
