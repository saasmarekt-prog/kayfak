import React, { useEffect, useState } from "react";
import {
  I18nManager,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ar } from "./src/localization/ar";
import { categories, previewRooms, RoomCategory, RoomPreview } from "./src/features/discovery/previewRooms";
import { colors, spacing } from "./src/theme/tokens";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./src/features/auth/AuthScreen";
import { supabase } from "./src/lib/supabase";
import { discoverRooms } from "./src/features/discovery/roomRepository";
import { RoomCreateScreen } from "./src/features/rooms/RoomCreateScreen";
import { RoomScreen } from "./src/features/rooms/RoomScreen";
import { CommunityPanel } from "./src/features/communities/CommunityPanel";
import { StoryPanel } from "./src/features/stories/StoryPanel";
import { registerGlobals } from "@livekit/react-native";
import { NotificationCenter } from "./src/features/notifications/NotificationCenter";

I18nManager.allowRTL(true);
if (Platform.OS !== "web") registerGlobals();

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function RoomCard({ room, onPress }: { room: RoomPreview; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`فتح غرفة ${room.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}
    >
      <View style={[styles.roomAccent, { backgroundColor: room.accent }]} />
      <View style={styles.roomContent}>
        <View style={styles.roomTopRow}>
          <View style={styles.categoryTag}><Text style={styles.categoryText}>{room.category}</Text></View>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{room.isPreview ? ar.previewLive : "مباشر"}</Text>
        </View>
        <Text style={styles.roomTitle}>{room.title}</Text>
        <Text style={styles.roomDescription}>{room.description}</Text>
        <View style={styles.roomBottomRow}>
          <Text style={styles.hostText}>{ar.byHost} {room.host}</Text>
          <Text style={styles.listenersText}>◉ {room.listeners} {ar.listeners}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function App() {
  const [category, setCategory] = useState<RoomCategory>("الكل");
  const [activeTab, setActiveTab] = useState<"اكتشف" | "قصصي" | "حسابي">("اكتشف");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [rooms, setRooms] = useState<RoomPreview[]>(supabase ? [] : previewRooms);
  const [isLoadingRooms, setIsLoadingRooms] = useState(Boolean(supabase));
  const [roomsError, setRoomsError] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<RoomPreview | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setRooms(category === "الكل" ? previewRooms : previewRooms.filter((room) => room.category === category));
      setIsLoadingRooms(false);
      return () => { cancelled = true; };
    }
    setIsLoadingRooms(true);
    setRoomsError("");
    discoverRooms(category).then(({ data, error }) => {
      if (cancelled) return;
      setIsLoadingRooms(false);
      if (error) {
        setRooms([]);
        setRoomsError("تعذر تحميل الغرف من الخادم. حاول مرة أخرى.");
        return;
      }
      setRooms(data);
    });
    return () => { cancelled = true; };
  }, [category]);

  const showNotice = (message: string) => setNotice(message);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ExpoStatusBar style="light" />
      <View style={styles.page}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{ar.eyebrow}</Text>
              <Text style={styles.logo}>{ar.brand}<Text style={styles.logoDot}>.</Text></Text>
            </View>
            <NotificationCenter />
          </View>

          {showCreateRoom && <RoomCreateScreen onCancel={() => setShowCreateRoom(false)} onCreated={(message) => { setShowCreateRoom(false); showNotice(message); }} />}
          {!showCreateRoom && selectedRoom && <RoomScreen room={selectedRoom} isAuthenticated={Boolean(session)} onBack={() => setSelectedRoom(null)} onChanged={showNotice} />}
          {!showCreateRoom && !selectedRoom && activeTab === ar.tabs.account && <AuthScreen session={session} onSessionChange={setSession} />}
          {!showCreateRoom && !selectedRoom && activeTab === ar.tabs.stories && (
            <StoryPanel />
          )}
          {!showCreateRoom && !selectedRoom && activeTab === ar.tabs.discover && <>
          <View style={styles.hero}>
            <View style={styles.heroOrbOne} /><View style={styles.heroOrbTwo} />
            <Text style={styles.heroKicker}>{ar.heroKicker}</Text>
            <Text style={styles.heroTitle}>{ar.heroTitle}</Text>
            <Text style={styles.heroBody}>{ar.heroBody}</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => { setCategory("الكل"); setActiveTab("اكتشف"); showNotice(ar.notice.chooseRoom); }}
            >
              <Text style={styles.primaryButtonText}>{ar.discoverRooms}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowCreateRoom(true)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>إنشاء غرفة</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{ar.roomsHeading}</Text>
            <Text style={styles.sectionHint}>{ar.previewLabel}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {categories.map((item) => <Pill key={item} label={item} selected={category === item} onPress={() => { setCategory(item); setNotice(""); }} />)}
          </ScrollView>

          <View style={styles.roomsList}>
            {isLoadingRooms && <Text style={styles.emptyText}>جارٍ تحميل الغرف...</Text>}
            {!isLoadingRooms && roomsError.length > 0 && <Text style={styles.errorText}>{roomsError}</Text>}
            {!isLoadingRooms && roomsError.length === 0 && rooms.map((room) => <RoomCard key={room.id} room={room} onPress={() => room.isPreview ? showNotice(ar.notice.preview(room.title)) : setSelectedRoom(room)} />)}
            {!isLoadingRooms && roomsError.length === 0 && rooms.length === 0 && <Text style={styles.emptyText}>{ar.emptyRooms}</Text>}
          </View>
          {supabase && <CommunityPanel />}

          {notice.length > 0 && (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
              <Pressable accessibilityRole="button" onPress={() => setNotice("")}><Text style={styles.dismissText}>{ar.close}</Text></Pressable>
            </View>
          )}
          <View style={styles.disclaimer}><Text style={styles.disclaimerTitle}>{ar.disclaimer.title}</Text><Text style={styles.disclaimerBody}>{ar.disclaimer.body}</Text></View>
          </>}
        </ScrollView>

        <View style={styles.tabBar}>
          {([ar.tabs.discover, ar.tabs.stories, ar.tabs.account] as const).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === tab }}
              onPress={() => { setActiveTab(tab); setSelectedRoom(null); setShowCreateRoom(false); if (tab === ar.tabs.discover) setNotice(""); else showNotice(tab === ar.tabs.stories ? ar.notice.stories : ar.notice.account); }}
              style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
            >
              <Text style={[styles.tabIcon, activeTab === tab && styles.tabIconActive]}>{tab === ar.tabs.discover ? "⌕" : tab === ar.tabs.stories ? "◇" : "○"}</Text>
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.page, paddingTop: 10, paddingBottom: 24 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  eyebrow: { color: colors.muted, fontSize: 12, textAlign: "right", marginBottom: 2 }, logo: { color: colors.text, fontSize: 30, fontWeight: "900", textAlign: "right" }, logoDot: { color: colors.gold },
  notificationButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, notificationIcon: { color: colors.text, fontSize: 23 },
  hero: { overflow: "hidden", borderRadius: 26, padding: 22, backgroundColor: colors.hero, borderWidth: 1, borderColor: colors.heroBorder, marginBottom: 27 },
  heroOrbOne: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "#253C59", top: -80, left: -45, opacity: 0.8 }, heroOrbTwo: { position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: "#52617A", top: -26, left: 30, opacity: 0.45 },
  heroKicker: { color: colors.gold, fontSize: 13, fontWeight: "700", textAlign: "right" }, heroTitle: { color: colors.text, fontSize: 27, lineHeight: 38, fontWeight: "900", textAlign: "right", marginTop: 12 }, heroBody: { color: "#C3CDDC", fontSize: 14, lineHeight: 23, textAlign: "right", marginTop: 10, marginBottom: 18 },
  primaryButton: { alignSelf: "flex-end", borderRadius: 14, backgroundColor: colors.gold, paddingVertical: 12, paddingHorizontal: 16 }, primaryButtonText: { color: "#101827", fontSize: 14, fontWeight: "900" }, secondaryButton: { alignSelf: "flex-end", borderColor: colors.border, borderRadius: 14, borderWidth: 1, marginTop: 10, paddingHorizontal: 16, paddingVertical: 11 }, secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "right" }, sectionHint: { color: colors.muted, fontSize: 11 }, filters: { flexDirection: "row-reverse", gap: 8, paddingBottom: 18 },
  pill: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pillSelected: { backgroundColor: colors.gold, borderColor: colors.gold }, pillText: { color: colors.muted, fontSize: 13, fontWeight: "600" }, pillTextSelected: { color: "#101827", fontWeight: "900" }, pressed: { opacity: 0.78 },
  roomsList: { gap: 12 }, roomCard: { flexDirection: "row-reverse", overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 142 }, roomAccent: { width: 4 }, roomContent: { flex: 1, padding: 14 }, roomTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 7 }, categoryTag: { borderRadius: 8, backgroundColor: colors.surfaceRaised, paddingHorizontal: 9, paddingVertical: 4 }, categoryText: { color: colors.muted, fontSize: 11 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green }, liveText: { color: colors.green, fontSize: 11 }, roomTitle: { color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "right", marginTop: 11 }, roomDescription: { color: colors.muted, fontSize: 12, textAlign: "right", marginTop: 6, lineHeight: 19 }, roomBottomRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 12 }, hostText: { color: "#C0CBDA", fontSize: 11, flexShrink: 1 }, listenersText: { color: colors.muted, fontSize: 11 }, emptyText: { color: colors.muted, textAlign: "center", padding: 25 },
  notice: { marginTop: 15, borderRadius: 14, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface, padding: 13, gap: 8 }, noticeText: { color: "#F4DCA3", fontSize: 12, lineHeight: 20, textAlign: "right" }, errorText: { color: "#F4B4A3", textAlign: "center", padding: 25, lineHeight: 20 }, dismissText: { color: colors.gold, textAlign: "right", fontWeight: "700", fontSize: 12 }, disclaimer: { marginTop: 24, padding: 15, borderRadius: 16, backgroundColor: "#0F1928", borderWidth: 1, borderColor: "#202D40" }, disclaimerTitle: { color: colors.gold, fontSize: 13, fontWeight: "800", textAlign: "right" }, disclaimerBody: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 7 },
  comingSoon: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 10, padding: 20 }, kicker: { color: colors.gold, fontSize: 13, fontWeight: "800", textAlign: "right" }, comingSoonTitle: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "right" }, comingSoonBody: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "right" },
  tabBar: { flexDirection: "row-reverse", paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "#0E1726" }, tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }, tabIcon: { color: "#6D7B91", fontSize: 23, height: 25 }, tabIconActive: { color: colors.gold }, tabLabel: { color: "#6D7B91", fontSize: 11 }, tabLabelActive: { color: colors.text, fontWeight: "800" },
});
