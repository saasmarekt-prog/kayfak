import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme/tokens";

type NotificationItem = { id: string; title: string; body: string | null; kind: string; read_at: string | null; created_at: string };

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const unread = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    if (!supabase) return undefined;
    const client = supabase;
    let channel: RealtimeChannel | null = null;
    let active = true;
    const setup = async () => {
      const { data: userResult } = await client.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId || !active) return;
      const result = await client.from("notifications").select("id,title,body,kind,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
      if (active) { setItems((result.data ?? []) as NotificationItem[]); setReady(true); }
      channel = client.channel(`notifications:${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => { if (active) setItems((current) => [payload.new as NotificationItem, ...current].slice(0, 30)); }).subscribe();
    };
    void setup();
    return () => { active = false; if (channel) void client.removeChannel(channel); };
  }, []);

  const markRead = async (item: NotificationItem) => {
    if (!supabase || item.read_at) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id);
  };

  if (!supabase) return null;
  return <View style={styles.wrap}><Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" onPress={() => setOpen((value) => !value)} style={styles.button}><Text style={styles.icon}>♧</Text>{unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>}</Pressable>{open && <View style={styles.dropdown}><View style={styles.dropdownHeader}><Text style={styles.dropdownTitle}>الإشعارات</Text><Text style={styles.dropdownHint}>{ready ? `${unread} غير مقروء` : "جارٍ التحميل"}</Text></View>{items.length === 0 && <Text style={styles.empty}>لا توجد إشعارات جديدة.</Text>}{items.slice(0, 8).map((item) => <Pressable key={item.id} onPress={() => void markRead(item)} style={[styles.item, !item.read_at && styles.unreadItem]}><Text style={styles.itemTitle}>{item.title}</Text>{item.body && <Text style={styles.itemBody}>{item.body}</Text>}<Text style={styles.itemTime}>{new Date(item.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</Text></Pressable>)}</View>}</View>;
}

const styles = StyleSheet.create({ wrap: { position: "relative", zIndex: 20 }, button: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, icon: { color: colors.text, fontSize: 23 }, badge: { alignItems: "center", backgroundColor: "#D96B62", borderColor: colors.background, borderRadius: 10, borderWidth: 2, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 3, position: "absolute", right: -5, top: -5 }, badgeText: { color: "#FFF", fontSize: 9, fontWeight: "900" }, dropdown: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, elevation: 8, gap: 8, padding: 12, position: "absolute", right: 0, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, top: 52, width: 290 }, dropdownHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, dropdownTitle: { color: colors.text, fontSize: 15, fontWeight: "900" }, dropdownHint: { color: colors.gold, fontSize: 10 }, item: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 3, paddingBottom: 8, paddingTop: 5 }, unreadItem: { backgroundColor: "#18273A", borderRadius: 8, paddingHorizontal: 6 }, itemTitle: { color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "right" }, itemBody: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: "right" }, itemTime: { color: colors.muted, fontSize: 9, textAlign: "right" }, empty: { color: colors.muted, fontSize: 11, paddingVertical: 14, textAlign: "right" },
});
