import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { getActiveGameRound, submitGameAnswer, ActiveGameRound } from "./gameRepository";

export function GameRoundPanel({ roomId }: { roomId: string }) {
  const [round, setRound] = useState<ActiveGameRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    let cancelled = false;
    getActiveGameRound(roomId).then((response) => { if (!cancelled && !response.error) setRound(response.data); });
    return () => { cancelled = true; };
  }, [roomId]);

  if (!round) return null;
  const answer = async (value: string) => {
    setBusy(true); setResult("");
    const response = await submitGameAnswer(round.roundId, value);
    setBusy(false);
    if (response.error) { setResult("تعذر حفظ الإجابة."); return; }
    setResult(response.correct ? `إجابة صحيحة +${response.pointsAwarded} نقطة` : "إجابة غير صحيحة، حاول في الجولة القادمة.");
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}><Text style={styles.kicker}>جولة {round.roundNumber}</Text><Text style={styles.title}>تحدي مباشر</Text></View>
      <Text style={styles.prompt}>{round.prompt}</Text>
      <View style={styles.options}>{round.options.map((option) => <Pressable key={option} disabled={busy} onPress={() => answer(option)} style={[styles.option, busy && styles.disabled]}><Text style={styles.optionText}>{option}</Text></Pressable>)}</View>
      {result.length > 0 && <Text style={styles.result}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ card: { backgroundColor: "#142338", borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 11, padding: 15 }, header: { flexDirection: "row-reverse", justifyContent: "space-between" }, kicker: { color: colors.gold, fontSize: 11, fontWeight: "800" }, title: { color: colors.text, fontSize: 15, fontWeight: "900" }, prompt: { color: colors.text, fontSize: 16, fontWeight: "800", lineHeight: 24, textAlign: "right" }, options: { gap: 8 }, option: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 11, borderWidth: 1, padding: 11 }, optionText: { color: colors.text, fontSize: 12, textAlign: "right" }, result: { color: colors.green, fontSize: 12, fontWeight: "800", textAlign: "right" }, disabled: { opacity: 0.55 } });
