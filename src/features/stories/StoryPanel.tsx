import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { supabase } from "../../lib/supabase";
import { chooseStoryChoice, listPublishedStories, loadStoryNode, startStory, StoryCard, StoryNode } from "./storyRepository";

export function StoryPanel() {
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [node, setNode] = useState<StoryNode | null>(null);
  const [progressId, setProgressId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listPublishedStories().then((result) => {
      if (cancelled) return;
      if (result.error) setError(supabase ? "تعذر تحميل القصص المنشورة." : "اربط Supabase ثم طبّق migration القصص لعرض المحتوى الفعلي.");
      setStories(result.data);
    });
    return () => { cancelled = true; };
  }, []);

  const begin = async (story: StoryCard) => {
    setBusy(true); setError(""); setNotice("");
    const started = await startStory(story.versionId);
    if (started.error || !started.data) { setBusy(false); setError("تعذر بدء القصة. تأكد من تسجيل الدخول ونشر نسخة القصة."); return; }
    const loaded = await loadStoryNode(started.data.currentNodeId);
    setBusy(false);
    if (loaded.error || !loaded.data) { setError("تعذر تحميل المشهد الحالي."); return; }
    setProgressId(started.data.progressId); setNode(loaded.data);
  };

  const choose = async (choiceId: string) => {
    if (!node || !progressId) return;
    setBusy(true); setError("");
    const result = await chooseStoryChoice(progressId, choiceId);
    if (result.error || !result.data) { setBusy(false); setError("تعذر حفظ الاختيار. لم يتغير تقدمك."); return; }
    const loaded = await loadStoryNode(result.data.currentNodeId);
    setBusy(false);
    if (loaded.error || !loaded.data) { setError("تم حفظ الاختيار لكن تعذر تحميل المشهد التالي."); return; }
    setNode(loaded.data);
    if (result.data.pointsAwarded > 0) setNotice(`حصلت على ${result.data.pointsAwarded} نقطة مكافأة.`);
  };

  if (node) return (
    <View style={styles.card}>
      <Pressable onPress={() => { setNode(null); setProgressId(""); }}><Text style={styles.back}>← العودة إلى القصص</Text></Pressable>
      <Text style={styles.kicker}>{node.kind === "ending" ? "نهاية القصة" : "المشهد الحالي"}</Text>
      <Text style={styles.title}>{node.title}</Text>
      <Text style={styles.body}>{node.body}</Text>
      {node.kind === "ending" && <Text style={styles.success}>اكتملت القصة، وتقدمك محفوظ على الخادم.</Text>}
      {node.choices.map((choice) => <Pressable key={choice.id} disabled={busy} onPress={() => choose(choice.id)} style={[styles.choice, busy && styles.disabled]}><Text style={styles.choiceText}>{choice.label}</Text>{choice.rewardPoints > 0 && <Text style={styles.reward}>+{choice.rewardPoints} نقطة</Text>}</Pressable>)}
      {notice.length > 0 && <Text style={styles.success}>{notice}</Text>}
      {error.length > 0 && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.heading}><Text style={styles.headingTitle}>قصص تفاعلية</Text><Text style={styles.headingHint}>تقدمك محفوظ</Text></View>
      {stories.length === 0 && <View style={styles.empty}><Text style={styles.kicker}>المحرك جاهز</Text><Text style={styles.emptyTitle}>لا توجد قصص منشورة بعد</Text><Text style={styles.body}>{error || "أنشئ قصة ونسخة منشورة ومشاهد مترابطة من لوحة الإدارة أو seed التطوير."}</Text></View>}
      {stories.map((story) => <View key={`${story.id}-${story.versionId}`} style={styles.storyCard}><Text style={styles.storyTitle}>{story.title}</Text><Text style={styles.body}>{story.description}</Text><Text style={styles.version}>الإصدار {story.versionNumber}</Text><Pressable disabled={busy} onPress={() => begin(story)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "جارٍ التحميل..." : "ابدأ أو استأنف القصة"}</Text></Pressable></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 14 }, heading: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }, headingTitle: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "right" }, headingHint: { color: colors.muted, fontSize: 11 }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 12, padding: 20 }, storyCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 9, padding: 16 }, empty: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 9, padding: 18 }, back: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "right" }, kicker: { color: colors.gold, fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "right" }, storyTitle: { color: colors.text, fontSize: 19, fontWeight: "900", textAlign: "right" }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "right" }, body: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "right" }, version: { color: colors.muted, fontSize: 11, textAlign: "right" }, choice: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 14, gap: 5 }, choiceText: { color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "right" }, reward: { color: colors.gold, fontSize: 11, textAlign: "right" }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 13, paddingVertical: 13 }, primaryText: { color: "#101827", fontSize: 13, fontWeight: "900" }, success: { color: colors.green, fontSize: 12, lineHeight: 19, textAlign: "right" }, error: { color: "#F4B4A3", fontSize: 12, lineHeight: 19, textAlign: "right" }, disabled: { opacity: 0.55 },
});
