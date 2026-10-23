import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/tokens";
import { supabase } from "../../lib/supabase";

type WalletPanelProps = { userId: string };

type WalletState = { coin_balance: number };
type SubscriptionState = { plan_id: string; status: string; current_period_end: string | null };

export function WalletPanel({ userId }: WalletPanelProps) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [receiverId, setReceiverId] = useState("");
  const [giftCode, setGiftCode] = useState("نجمة");
  const [coinCost, setCoinCost] = useState("10");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabase) return;
    const [{ data: walletData }, { data: subscriptionData }] = await Promise.all([
      supabase.from("wallet_accounts").select("coin_balance").eq("user_id", userId).maybeSingle(),
      supabase.from("subscriptions").select("plan_id, status, current_period_end").eq("user_id", userId).in("status", ["active", "paused"]).order("current_period_end", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setWallet(walletData as WalletState | null);
    setSubscription(subscriptionData as SubscriptionState | null);
  };

  useEffect(() => { load(); }, [userId]);

  const sendGift = async () => {
    if (!supabase || !receiverId.trim() || !giftCode.trim()) { setMessage("أدخل معرّف المستلم ونوع الهدية."); return; }
    const cost = Number(coinCost);
    if (!Number.isSafeInteger(cost) || cost <= 0) { setMessage("قيمة الهدية غير صحيحة."); return; }
    setBusy(true); setMessage("");
    const result = await supabase.functions.invoke("send-gift", { body: { receiver_id: receiverId.trim(), gift_code: giftCode.trim(), coin_cost: cost, idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}` } });
    setBusy(false);
    if (result.error) { setMessage("تعذر إرسال الهدية. تحقق من الرصيد وإعداد Edge Function."); return; }
    setMessage("تم إرسال الهدية.");
    setReceiverId("");
    await load();
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>المحفظة والهدايا</Text>
      <Text style={styles.balance}>{wallet?.coin_balance ?? 0} عملة</Text>
      <Text style={styles.hint}>الرصيد يُحدّث من الخادم ولا يمكن تعديله من التطبيق.</Text>
      <TextInput value={receiverId} onChangeText={setReceiverId} placeholder="معرّف المستلم" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" autoCapitalize="none" />
      <View style={styles.row}><TextInput value={giftCode} onChangeText={setGiftCode} placeholder="الهدية" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} textAlign="right" /><TextInput value={coinCost} onChangeText={setCoinCost} placeholder="العملات" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.input, styles.half]} textAlign="right" /></View>
      <Pressable disabled={busy} onPress={sendGift} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "جارٍ الإرسال..." : "إرسال هدية"}</Text></Pressable>
      <Text style={styles.subscription}>الاشتراك: {subscription ? `${subscription.plan_id} · ${subscription.status}` : "لا يوجد اشتراك نشط"}</Text>
      {message.length > 0 && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 17, borderWidth: 1, gap: 10, padding: 15 }, heading: { color: colors.gold, fontSize: 14, fontWeight: "900", textAlign: "right" }, balance: { color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "right" }, hint: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: "right" }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, minHeight: 44, paddingHorizontal: 12 }, row: { flexDirection: "row-reverse", gap: 8 }, half: { flex: 1 }, primary: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 11, paddingVertical: 11 }, primaryText: { color: "#101827", fontSize: 13, fontWeight: "900" }, subscription: { color: "#C0CBDA", fontSize: 12, textAlign: "right" }, message: { color: "#F4DCA3", fontSize: 12, lineHeight: 18, textAlign: "right" }, disabled: { opacity: 0.55 },
});
