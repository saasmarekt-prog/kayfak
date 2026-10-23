import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/tokens";
import { supabase } from "../../lib/supabase";

type Community = { id: string; name: string; slug: string; description: string | null; visibility: string };
type Post = { id: string; title: string; body: string; created_at: string; author_id: string };

export function CommunityPanel() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCommunities = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("communities").select("id, name, slug, description, visibility").eq("visibility", "public").order("created_at", { ascending: false }).limit(20);
    setCommunities((data ?? []) as Community[]);
  };
  const loadPosts = async (communityId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from("community_posts").select("id, title, body, created_at, author_id").eq("community_id", communityId).is("deleted_at", null).order("created_at", { ascending: false }).limit(10);
    setPosts((data ?? []) as Post[]);
  };
  useEffect(() => { loadCommunities(); }, []);

  const selectCommunity = async (community: Community) => { setSelected(community); setMessage(""); await loadPosts(community.id); };
  const join = async () => {
    if (!supabase || !selected) return;
    setBusy(true); const { error } = await supabase.rpc("request_community_membership", { p_community_id: selected.id }); setBusy(false);
    setMessage(error ? "تعذر الانضمام إلى المجتمع." : "تم إرسال طلب الانضمام أو تفعيل العضوية.");
  };
  const createPost = async () => {
    if (!supabase || !selected || title.trim().length < 2 || body.trim().length < 1) { setMessage("اكتب عنوان الموضوع ونصه."); return; }
    setBusy(true); const { error } = await supabase.rpc("create_community_post", { p_community_id: selected.id, p_title: title.trim(), p_body: body.trim() }); setBusy(false);
    if (error) { setMessage("يجب أن تكون عضوًا نشطًا للنشر."); return; }
    setTitle(""); setBody(""); setMessage("تم نشر الموضوع."); await loadPosts(selected.id);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.heading}><Text style={styles.title}>المجتمعات والمواضيع</Text><Text style={styles.hint}>نقاشات عربية منظمة</Text></View>
      {communities.length === 0 && <Text style={styles.empty}>لا توجد مجتمعات عامة بعد.</Text>}
      <View style={styles.communityRow}>{communities.map((community) => <Pressable key={community.id} onPress={() => selectCommunity(community)} style={[styles.communityChip, selected?.id === community.id && styles.selected]}><Text style={[styles.chipText, selected?.id === community.id && styles.selectedText]}>{community.name}</Text></Pressable>)}</View>
      {selected && <><Text style={styles.selectedTitle}>{selected.name}</Text><Text style={styles.description}>{selected.description ?? "مجتمع للنقاش والتعارف."}</Text><Pressable disabled={busy} onPress={join} style={styles.secondary}><Text style={styles.secondaryText}>انضمام إلى المجتمع</Text></Pressable><TextInput value={title} onChangeText={setTitle} placeholder="عنوان الموضوع" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" /><TextInput value={body} onChangeText={setBody} placeholder="اكتب موضوعًا جديدًا" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><Pressable disabled={busy} onPress={createPost} style={styles.primary}><Text style={styles.primaryText}>نشر الموضوع</Text></Pressable>{posts.map((post) => <View key={post.id} style={styles.post}><Text style={styles.postTitle}>{post.title}</Text><Text style={styles.postBody}>{post.body}</Text></View>)}</>}
      {message.length > 0 && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 10, marginTop: 18, padding: 16 }, heading: { gap: 3 }, title: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "right" }, hint: { color: colors.muted, fontSize: 12, textAlign: "right" }, communityRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, communityChip: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 }, selected: { backgroundColor: colors.gold, borderColor: colors.gold }, chipText: { color: colors.muted, fontSize: 12 }, selectedText: { color: "#101827", fontWeight: "800" }, selectedTitle: { color: colors.gold, fontSize: 16, fontWeight: "900", textAlign: "right" }, description: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: "right" }, input: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, minHeight: 44, paddingHorizontal: 12 }, multiline: { minHeight: 75, paddingTop: 11 }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 11, paddingVertical: 11 }, primaryText: { color: "#101827", fontWeight: "900" }, secondary: { alignItems: "center", borderColor: colors.border, borderRadius: 11, borderWidth: 1, paddingVertical: 10 }, secondaryText: { color: colors.text, fontWeight: "800" }, post: { backgroundColor: colors.surfaceRaised, borderRadius: 12, gap: 5, padding: 12 }, postTitle: { color: colors.text, fontSize: 14, fontWeight: "800", textAlign: "right" }, postBody: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "right" }, message: { color: "#F4DCA3", fontSize: 12, lineHeight: 18, textAlign: "right" }, empty: { color: colors.muted, fontSize: 12, textAlign: "right" },
});
