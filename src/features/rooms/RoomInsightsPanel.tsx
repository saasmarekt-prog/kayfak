import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { ActivityEvent, getRoomInsights, listRoomActivity, RoomInsights } from "./insightsRepository";

const eventLabels: Record<string, string> = { kick: "طرد عضو", ban: "حظر عضو", unban: "إلغاء حظر", role_change: "تغيير دور", speaker_request: "طلب تحدث", speaker_review: "مراجعة طلب" };

export function RoomInsightsPanel({ roomId, isAuthenticated }: { roomId: string; isAuthenticated: boolean }) {
  const [insights, setInsights] = useState<RoomInsights | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    const [stats, events] = await Promise.all([getRoomInsights(roomId), listRoomActivity(roomId)]);
    setLoading(false);
    if (stats.error || events.error) { setError(""); return; }
    setInsights(stats.data); setActivity(events.data);
  }, [isAuthenticated, roomId]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
  if (!insights) return null;

  const cards = [["الأعضاء الآن", insights.activeMembers], ["المتحدثون", insights.speakers], ["المستمعون", insights.listeners], ["طلبات التحدث", insights.pendingRequests], ["طرد خلال 24س", insights.kicks24h], ["حظر خلال 24س", insights.bans24h]] as const;
  return <View style={styles.panel}><View style={styles.header}><Text style={styles.title}>إحصائيات ونشاط الغرفة</Text><Pressable disabled={loading} onPress={() => { setLoading(true); void load(); }}><Text style={styles.refresh}>تحديث</Text></Pressable></View><View style={styles.grid}>{cards.map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View><Text style={styles.section}>آخر النشاطات ({insights.activity24h} خلال 24 ساعة)</Text>{activity.length === 0 && <Text style={styles.muted}>لا توجد نشاطات مسجلة بعد.</Text>}{activity.slice(0, 8).map((event) => <View key={event.id} style={styles.event}><View style={styles.eventDot} /><View style={styles.eventBody}><Text style={styles.eventTitle}>{eventLabels[event.eventType] ?? event.eventType}</Text><Text style={styles.eventMeta}>{event.actorName ?? "النظام"}{event.targetName ? ` ← ${event.targetName}` : ""}</Text></View><Text style={styles.eventTime}>{new Date(event.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</Text></View>)}{error.length > 0 && <Text style={styles.error}>{error}</Text>}</View>;
}

const styles = StyleSheet.create({ panel: { backgroundColor: "#0F1A2A", borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 12, padding: 15 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, title: { color: colors.text, fontSize: 17, fontWeight: "900", textAlign: "right" }, refresh: { color: colors.gold, fontSize: 11, fontWeight: "800" }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, stat: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexGrow: 1, minWidth: "28%", padding: 10 }, statValue: { color: colors.gold, fontSize: 20, fontWeight: "900", textAlign: "right" }, statLabel: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: "right" }, section: { color: colors.gold, fontSize: 13, fontWeight: "900", marginTop: 4, textAlign: "right" }, event: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, eventDot: { backgroundColor: colors.green, borderRadius: 4, height: 8, width: 8 }, eventBody: { flex: 1 }, eventTitle: { color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "right" }, eventMeta: { color: colors.muted, fontSize: 10, marginTop: 2, textAlign: "right" }, eventTime: { color: colors.muted, fontSize: 10 }, muted: { color: colors.muted, fontSize: 11, textAlign: "right" }, error: { color: "#F4B4A3", fontSize: 11, textAlign: "right" },
});
