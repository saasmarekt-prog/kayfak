import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { ar } from "../../localization/ar";
import { colors } from "../../theme/tokens";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getMyProfile, Profile, updateMyProfile } from "../profile/profileRepository";

type AuthMode = "signIn" | "signUp";

type AuthScreenProps = {
  session: Session | null;
  onSessionChange: (session: Session | null) => void;
};

export function AuthScreen({ session, onSessionChange }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      onSessionChange(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [onSessionChange]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    getMyProfile(session.user.id).then(({ data }) => {
      setProfile(data);
      setProfileName(data?.display_name ?? "");
      setProfileBio(data?.bio ?? "");
    });
  }, [session]);

  const submit = async () => {
    if (!supabase) {
      setMessage("أضف متغيرات Supabase في ملف .env لتفعيل الحسابات.");
      return;
    }
    if (!email.trim() || password.length < 8 || (mode === "signUp" && !displayName.trim())) {
      setMessage("أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل، والاسم عند التسجيل.");
      return;
    }

    setIsBusy(true);
    setMessage("");
    const result = mode === "signIn"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() } } });
    setIsBusy(false);

    if (result.error) {
      setMessage("تعذر إتمام العملية. تحقق من البيانات أو إعدادات Supabase.");
      return;
    }
    setMessage(mode === "signUp" ? "تم إنشاء الحساب. تحقق من بريدك إذا كان التحقق مفعّلًا." : "تم تسجيل الدخول.");
  };

  const resetPassword = async () => {
    if (!supabase || !email.trim()) {
      setMessage("أدخل بريدك الإلكتروني أولًا.");
      return;
    }
    setIsBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setIsBusy(false);
    setMessage(error ? "تعذر إرسال رسالة الاستعادة." : "تم إرسال تعليمات استعادة كلمة المرور إذا كان البريد مسجلًا.");
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    onSessionChange(null);
  };

  const saveProfile = async () => {
    if (!session || profileName.trim().length < 1) return;
    setIsSavingProfile(true);
    const result = await updateMyProfile(session.user.id, { username: profile?.username ?? null, display_name: profileName.trim(), bio: profileBio.trim() || null, avatar_url: profile?.avatar_url ?? null, visibility: profile?.visibility ?? "public" });
    setIsSavingProfile(false);
    if (result.error) {
      setMessage("تعذر حفظ الملف الشخصي.");
      return;
    }
    setProfile(result.data);
    setMessage("تم حفظ الملف الشخصي.");
  };

  if (!isSupabaseConfigured) {
    return <SetupNotice />;
  }

  if (session) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>الحساب</Text>
        <Text style={styles.title}>أهلًا {profile?.display_name ?? "بك"}</Text>
        <Text style={styles.body}>{session.user.email}</Text>
        <TextInput value={profileName} onChangeText={setProfileName} placeholder="الاسم الظاهر" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" maxLength={80} />
        <TextInput value={profileBio} onChangeText={setProfileBio} placeholder="نبذة قصيرة" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline maxLength={500} />
        <Pressable disabled={isSavingProfile} accessibilityRole="button" onPress={saveProfile} style={[styles.primaryButton, isSavingProfile && styles.disabled]}><Text style={styles.primaryButtonText}>{isSavingProfile ? "جارٍ الحفظ..." : "حفظ الملف الشخصي"}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>تسجيل الخروج</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>الحساب</Text>
      <Text style={styles.title}>{mode === "signIn" ? "تسجيل الدخول" : "إنشاء حساب"}</Text>
      <Text style={styles.body}>سيتم ربط حسابك بملفك الشخصي مع تطبيق سياسات الوصول من قاعدة البيانات.</Text>
      {mode === "signUp" && <TextInput value={displayName} onChangeText={setDisplayName} placeholder="الاسم الظاهر" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" />}
      <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} textAlign="right" />
      <TextInput value={password} onChangeText={setPassword} placeholder="كلمة المرور" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} textAlign="right" />
      <Pressable disabled={isBusy} accessibilityRole="button" onPress={submit} style={[styles.primaryButton, isBusy && styles.disabled]}>
        <Text style={styles.primaryButtonText}>{isBusy ? "جارٍ التنفيذ..." : mode === "signIn" ? "دخول" : "إنشاء الحساب"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setMessage(""); }}>
        <Text style={styles.link}>{mode === "signIn" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب؟ سجّل الدخول"}</Text>
      </Pressable>
      {mode === "signIn" && <Pressable accessibilityRole="button" onPress={resetPassword}><Text style={styles.link}>نسيت كلمة المرور؟</Text></Pressable>}
      {message.length > 0 && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    </View>
  );
}

function SetupNotice() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>إعداد الحساب</Text>
      <Text style={styles.title}>الحسابات غير مفعّلة بعد</Text>
      <Text style={styles.body}>أضف EXPO_PUBLIC_SUPABASE_URL وEXPO_PUBLIC_SUPABASE_ANON_KEY إلى بيئة التشغيل بعد إنشاء مشروع Supabase. لا تضع service_role في التطبيق.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, padding: 20, gap: 12 },
  kicker: { color: colors.gold, fontSize: 13, fontWeight: "800", textAlign: "right" },
  title: { color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "right" },
  body: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: "right" },
  input: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, minHeight: 48, paddingHorizontal: 14 }, multiline: { minHeight: 80, paddingTop: 12 },
  primaryButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 13, paddingVertical: 13 },
  primaryButtonText: { color: "#101827", fontSize: 14, fontWeight: "900" },
  secondaryButton: { alignItems: "center", borderColor: colors.border, borderRadius: 13, borderWidth: 1, paddingVertical: 13 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  link: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "right" },
  message: { color: "#F4DCA3", fontSize: 12, lineHeight: 19, textAlign: "right" },
  disabled: { opacity: 0.55 },
});
