import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

type RoomCategory = "الكل" | "سوالف" | "قصص" | "ألعاب" | "مجتمع";

type RoomPreview = {
  id: string;
  title: string;
  category: Exclude<RoomCategory, "الكل">;
  host: string;
  listeners: number;
  accent: string;
  description: string;
};

const COLORS = {
  background: "#0B1220",
  surface: "#121D2E",
  surfaceRaised: "#19263A",
  border: "#26354B",
  text: "#F5F7FB",
  muted: "#A8B4C7",
  gold: "#D7AE52",
  green: "#55D6A4",
};

const CATEGORIES: RoomCategory[] = ["الكل", "سوالف", "قصص", "ألعاب", "مجتمع"];

// Local preview content only. Replace with Supabase data in the next integration step.
const PREVIEW_ROOMS: RoomPreview[] = [
  {
    id: "room-1",
    title: "قهوة آخر الليل ☕",
    category: "سوالف",
    host: "مجلس الأصدقاء",
    listeners: 28,
    accent: "#D7AE52",
    description: "مساحة هادئة للتعارف والسوالف باحترام",
  },
  {
    id: "room-2",
    title: "اختَر نهاية الحكاية",
    category: "قصص",
    host: "حكّاؤون",
    listeners: 16,
    accent: "#A78BFA",
    description: "كل قرار منكم يغيّر مجرى القصة",
  },
  {
    id: "room-3",
    title: "تحدّي الألغاز 🧩",
    category: "ألعاب",
    host: "فريق الذكاء",
    listeners: 12,
    accent: "#55D6A4",
    description: "ألغاز سريعة وتحديات جماعية",
  },
  {
    id: "room-4",
    title: "مجتمع صُنّاع الأفكار",
    category: "مجتمع",
    host: "مساحة الإبداع",
    listeners: 9,
    accent: "#67B7F7",
    description: "شارك فكرة، تعلّم شيئًا، وتعرّف على أشخاص جدد",
  },
];

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected && styles.pillSelected]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RoomCard({ room, onPress }: { room: RoomPreview; onPress: () => void }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`فتح غرفة ${room.title}`}
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.roomCard}
    >
      <View style={[styles.roomAccent, { backgroundColor: room.accent }]} />
      <View style={styles.roomContent}>
        <View style={styles.roomTopRow}>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{room.category}</Text>
          </View>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>مباشر تجريبيًا</Text>
        </View>
        <Text style={styles.roomTitle}>{room.title}</Text>
        <Text style={styles.roomDescription}>{room.description}</Text>
        <View style={styles.roomBottomRow}>
          <Text style={styles.hostText}>بواسطة {room.host}</Text>
          <Text style={styles.listenersText}>◉ {room.listeners} مستمعًا</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function App() {
  const [category, setCategory] = useState<RoomCategory>("الكل");
  const [activeTab, setActiveTab] = useState<"اكتشف" | "قصصي" | "حسابي">("اكتشف");
  const [notice, setNotice] = useState("");

  const visibleRooms = useMemo(
    () =>
      category === "الكل"
        ? PREVIEW_ROOMS
        : PREVIEW_ROOMS.filter((room) => room.category === category),
    [category]
  );

  const openRoom = (room: RoomPreview) => {
    setNotice(
      `هذه معاينة لواجهة «${room.title}». لم يتم ربط الصوت أو قاعدة البيانات بعد.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ExpoStatusBar style="light" />
      <View style={styles.page}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>مساحتك، على كيفك</Text>
              <Text style={styles.logo}>كيفك<Text style={styles.logoDot}>.</Text></Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="الإشعارات"
              style={styles.notificationButton}
              onPress={() => setNotice("ستُضاف الإشعارات بعد إعداد الحسابات والخلفية.")}
            >
              <Text style={styles.notificationIcon}>♧</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroOrbOne} />
            <View style={styles.heroOrbTwo} />
            <Text style={styles.heroKicker}>هنا تبدأ الحكاية</Text>
            <Text style={styles.heroTitle}>غرف تجمعك،{`\n`}وقصص تصنعها مع الناس.</Text>
            <Text style={styles.heroBody}>
              ادخل للسوالف، شارك في لغز، أو خلّ قرارك يغيّر نهاية القصة.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setCategory("الكل");
                setActiveTab("اكتشف");
                setNotice("اختر غرفة من القائمة لاستعراض تجربة الواجهة.");
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>اكتشف الغرف  ←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>غرف تناسب مزاجك</Text>
            <Text style={styles.sectionHint}>معاينة أولية</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {CATEGORIES.map((item) => (
              <Pill
                key={item}
                label={item}
                selected={category === item}
                onPress={() => {
                  setCategory(item);
                  setNotice("");
                }}
              />
            ))}
          </ScrollView>

          <View style={styles.roomsList}>
            {visibleRooms.map((room) => (
              <RoomCard key={room.id} room={room} onPress={() => openRoom(room)} />
            ))}
            {visibleRooms.length === 0 && (
              <Text style={styles.emptyText}>لا توجد غرف في هذا التصنيف حاليًا.</Text>
            )}
          </View>

          {notice.length > 0 && (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
              <TouchableOpacity onPress={() => setNotice("")}>
                <Text style={styles.dismissText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerTitle}>نسخة البناء الأولى</Text>
            <Text style={styles.disclaimerBody}>
              هذه واجهة قابلة للتشغيل للمراجعة. الغرف المعروضة بيانات محلية تجريبية،
              ولا يوجد تسجيل دخول أو صوت مباشر أو تخزين سحابي في هذه المرحلة.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.tabBar}>
          {(["اكتشف", "قصصي", "حسابي"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === tab }}
              onPress={() => {
                setActiveTab(tab);
                if (tab !== "اكتشف") {
                  setNotice(
                    tab === "قصصي"
                      ? "ستُبنى مساحة القصص بعد ربط قاعدة البيانات ومحرك القرارات."
                      : "سيُفعّل الحساب بعد إعداد Supabase Auth."
                  );
                } else {
                  setNotice("");
                }
              }}
              style={styles.tabItem}
            >
              <Text style={[styles.tabIcon, activeTab === tab && styles.tabIconActive]}>
                {tab === "اكتشف" ? "⌕" : tab === "قصصي" ? "◇" : "○"}
              </Text>
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24 },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  eyebrow: { color: COLORS.muted, fontSize: 12, textAlign: "right", marginBottom: 2 },
  logo: { color: COLORS.text, fontSize: 30, fontWeight: "900", textAlign: "right" },
  logoDot: { color: COLORS.gold },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIcon: { color: COLORS.text, fontSize: 23 },
  hero: {
    overflow: "hidden",
    borderRadius: 26,
    padding: 22,
    backgroundColor: "#17253A",
    borderWidth: 1,
    borderColor: "#30415B",
    marginBottom: 27,
  },
  heroOrbOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#253C59",
    top: -80,
    left: -45,
    opacity: 0.8,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#52617A",
    top: -26,
    left: 30,
    opacity: 0.45,
  },
  heroKicker: { color: COLORS.gold, fontSize: 13, fontWeight: "700", textAlign: "right" },
  heroTitle: {
    color: COLORS.text,
    fontSize: 27,
    lineHeight: 38,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 12,
  },
  heroBody: {
    color: "#C3CDDC",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "right",
    marginTop: 10,
    marginBottom: 18,
  },
  primaryButton: {
    alignSelf: "flex-end",
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#101827", fontSize: 14, fontWeight: "900" },
  sectionHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { color: COLORS.text, fontSize: 19, fontWeight: "800", textAlign: "right" },
  sectionHint: { color: COLORS.muted, fontSize: 11 },
  filters: { flexDirection: "row-reverse", gap: 8, paddingBottom: 18 },
  pill: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  pillText: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },
  pillTextSelected: { color: "#101827", fontWeight: "900" },
  roomsList: { gap: 12 },
  roomCard: {
    flexDirection: "row-reverse",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minHeight: 142,
  },
  roomAccent: { width: 4 },
  roomContent: { flex: 1, padding: 14 },
  roomTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  categoryTag: {
    borderRadius: 8,
    backgroundColor: COLORS.surfaceRaised,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  categoryText: { color: COLORS.muted, fontSize: 11 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  liveText: { color: COLORS.green, fontSize: 11 },
  roomTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", textAlign: "right", marginTop: 11 },
  roomDescription: { color: COLORS.muted, fontSize: 12, textAlign: "right", marginTop: 6, lineHeight: 19 },
  roomBottomRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  hostText: { color: "#C0CBDA", fontSize: 11, flexShrink: 1 },
  listenersText: { color: COLORS.muted, fontSize: 11 },
  emptyText: { color: COLORS.muted, textAlign: "center", padding: 25 },
  notice: {
    marginTop: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6B592F",
    backgroundColor: "#2B261A",
    padding: 13,
    gap: 8,
  },
  noticeText: { color: "#F4DCA3", fontSize: 12, lineHeight: 20, textAlign: "right" },
  dismissText: { color: COLORS.gold, textAlign: "right", fontWeight: "700", fontSize: 12 },
  disclaimer: {
    marginTop: 24,
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#0F1928",
    borderWidth: 1,
    borderColor: "#202D40",
  },
  disclaimerTitle: { color: COLORS.gold, fontSize: 13, fontWeight: "800", textAlign: "right" },
  disclaimerBody: { color: COLORS.muted, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 7 },
  tabBar: {
    flexDirection: "row-reverse",
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: "#0E1726",
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  tabIcon: { color: "#6D7B91", fontSize: 23, height: 25 },
  tabIconActive: { color: COLORS.gold },
  tabLabel: { color: "#7E8BA0", fontSize: 11 },
  tabLabelActive: { color: COLORS.gold, fontWeight: "800" },
});
