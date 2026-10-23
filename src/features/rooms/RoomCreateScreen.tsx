import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/tokens";
import { categories, RoomType } from "../discovery/previewRooms";
import { createRoom } from "../discovery/roomCommands";

type RoomCreateScreenProps = {
  onCancel: () => void;
  onCreated: (message: string) => void;
};

export function RoomCreateScreen({ onCancel, onCreated }: RoomCreateScreenProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoomType>("سوالف");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [capacity, setCapacity] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (title.trim().length < 2) {
      setError("اكتب اسمًا للغرفة من حرفين على الأقل.");
      return;
    }
    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 2 || parsedCapacity > 10000) {
      setError("السعة يجب أن تكون رقمًا بين 2 و10000.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await createRoom({ title: title.trim(), description: description.trim(), category, visibility, capacity: parsedCapacity });
    setBusy(false);
    if (result.error) {
      setError("تعذر إنشاء الغرفة. تأكد من تسجيل الدخول وتطبيق migrations.");
      return;
    }
    onCreated("تم إنشاء الغرفة كمسودة. لن تظهر مباشرة حتى ينجح ربط مزود الصوت الموثوق.");
  };

  return (
    <View style={styles.card}>
      <View style={styles.heading}><Text style={styles.kicker}>غرفة جديدة</Text><Pressable onPress={onCancel}><Text style={styles.link}>إلغاء</Text></Pressable></View>
      <Text style={styles.title}>أنشئ مساحة للسوالف</Text>
      <Text style={styles.body}>تبدأ الغرفة كمسودة، ولا تصبح مباشرة إلا بعد تأكيد backend لمزود الصوت.</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="اسم الغرفة" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" maxLength={120} />
      <TextInput value={description} onChangeText={setDescription} placeholder="وصف مختصر (اختياري)" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline maxLength={500} />
      <Text style={styles.label}>التصنيف</Text>
      <View style={styles.row}>{categories.filter((item): item is RoomType => item !== "الكل").map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipSelected]}><Text style={[styles.chipText, category === item && styles.chipTextSelected]}>{item}</Text></Pressable>)}</View>
      <Text style={styles.label}>نوع الغرفة</Text>
      <View style={styles.row}>{(["public", "private"] as const).map((item) => <Pressable key={item} onPress={() => setVisibility(item)} style={[styles.chip, visibility === item && styles.chipSelected]}><Text style={[styles.chipText, visibility === item && styles.chipTextSelected]}>{item === "public" ? "عامة" : "خاصة"}</Text></Pressable>)}</View>
      <TextInput value={capacity} onChangeText={setCapacity} placeholder="السعة" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} textAlign="right" />
      <Pressable disabled={busy} onPress={submit} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "جارٍ الإنشاء..." : "إنشاء المسودة"}</Text></Pressable>
      {error.length > 0 && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: 12, padding: 20 },
  heading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, kicker: { color: colors.gold, fontSize: 13, fontWeight: "800", textAlign: "right" }, title: { color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "right" }, body: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "right" }, label: { color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "right" }, input: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: 14 }, multiline: { minHeight: 80, paddingTop: 12 }, row: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, chip: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 }, chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold }, chipText: { color: colors.muted, fontSize: 12 }, chipTextSelected: { color: "#101827", fontWeight: "800" }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 13, paddingVertical: 13 }, primaryText: { color: "#101827", fontSize: 14, fontWeight: "900" }, link: { color: colors.gold, fontSize: 12, fontWeight: "700" }, error: { color: "#F4B4A3", fontSize: 12, lineHeight: 19, textAlign: "right" }, disabled: { opacity: 0.55 },
});
