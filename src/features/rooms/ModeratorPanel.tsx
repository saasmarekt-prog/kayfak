import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { getRoomModerationState, listActiveRoomMembers, listPendingSpeakerRequests, reviewSpeakerRequest, RoomMember, setRoomMemberRole, SpeakerRequest } from "./moderatorRepository";

type ModeratorPanelProps = { roomId: string; isAuthenticated: boolean };

const roleLabel: Record<RoomMember["role"], string> = { host: "مالك الغرفة", speaker: "متحدث", listener: "مستمع" };

export function ModeratorPanel({ roomId, isAuthenticated }: ModeratorPanelProps) {
  const [canManage, setCanManage] = useState(false);
  const [requests, setRequests] = useState<SpeakerRequest[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPanel = useCallback(async (showSpinner = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    if (showSpinner) setLoading(true);
    const permission = await getRoomModerationState(roomId);
    if (permission.error || !permission.canManage) { setCanManage(false); setLoading(false); return; }
    setCanManage(true);
    const [requestResult, membersResult] = await Promise.all([listPendingSpeakerRequests(roomId), listActiveRoomMembers(roomId)]);
    setLoading(false);
    if (requestResult.error || membersResult.error) { setError("تعذر تحميل بيانات الإدارة."); return; }
    setError(""); setRequests(requestResult.data); setMembers(membersResult.data);
  }, [isAuthenticated, roomId]);

  useEffect(() => {
    void loadPanel(true);
    const timer = setInterval(() => { void loadPanel(false); }, 10000);
    return () => clearInterval(timer);
  }, [loadPanel]);

  const review = async (request: SpeakerRequest, approve: boolean) => {
    setBusyId(request.id); setError(""); setNotice("");
    const result = await reviewSpeakerRequest(request.id, approve);
    setBusyId("");
    if (result.error) { setError("تعذر حفظ القرار. ربما عالج مشرف آخر الطلب."); return; }
    setRequests((current) => current.filter((item) => item.id !== request.id));
    if (approve) setMembers((current) => current.map((member) => member.userId === request.userId ? { ...member, role: "speaker" } : member));
    setNotice(approve ? `تم قبول ${request.displayName} كمتحدث.` : `تم رفض طلب ${request.displayName}.`);
  };

  const changeRole = async (member: RoomMember, role: "listener" | "speaker") => {
    setBusyId(member.userId); setError(""); setNotice("");
    const result = await setRoomMemberRole(roomId, member.userId, role);
    setBusyId("");
    if (result.error) { setError("تعذر تغيير الدور. تحقق من صلاحياتك أو حالة العضو."); return; }
    setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, role } : item));
    setNotice(`تم تحديث دور ${member.displayName} إلى ${roleLabel[role]}.`);
  };

  if (!canManage) return null;

  return (
    <View style={styles.panel} accessibilityLabel="لوحة مشرفي الغرفة">
      <View style={styles.header}><View><Text style={styles.title}>إدارة الغرفة</Text><Text style={styles.subtitle}>الطلبات والأدوار · تحديث تلقائي كل 10 ثوانٍ</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{requests.length}</Text></View></View>
      <Text style={styles.sectionTitle}>طلبات التحدث</Text>
      {loading && <Text style={styles.muted}>جارٍ تحميل بيانات الإدارة...</Text>}
      {!loading && requests.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد طلبات معلقة</Text><Text style={styles.muted}>ستظهر هنا طلبات الأعضاء الراغبين في التحدث.</Text></View>}
      {requests.map((request) => <View key={request.id} style={styles.request}><View style={styles.avatar}><Text style={styles.avatarText}>{request.displayName.slice(0, 1)}</Text></View><View style={styles.requestBody}><Text style={styles.name}>{request.displayName}</Text><Text style={styles.time}>طلب التحدث الآن</Text></View><View style={styles.actions}><Pressable disabled={busyId.length > 0} onPress={() => review(request, true)} style={[styles.approve, busyId.length > 0 && styles.disabled]}><Text style={styles.approveText}>{busyId === request.id ? "..." : "قبول"}</Text></Pressable><Pressable disabled={busyId.length > 0} onPress={() => review(request, false)} style={[styles.reject, busyId.length > 0 && styles.disabled]}><Text style={styles.rejectText}>رفض</Text></Pressable></View></View>)}
      <Text style={styles.sectionTitle}>أعضاء الغرفة والأدوار</Text>
      {members.length === 0 && <Text style={styles.muted}>لا يوجد أعضاء نشطون حاليًا.</Text>}
      {members.map((member) => <View key={member.userId} style={styles.member}><View style={styles.memberIdentity}><View style={styles.smallAvatar}><Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text></View><View><Text style={styles.name}>{member.displayName}</Text><Text style={member.role === "host" ? styles.hostRole : styles.role}>{roleLabel[member.role]}</Text></View></View>{member.role === "host" ? <Text style={styles.protected}>محمي</Text> : <View style={styles.roleActions}>{member.role === "listener" ? <Pressable disabled={busyId.length > 0} onPress={() => changeRole(member, "speaker")} style={[styles.approve, busyId.length > 0 && styles.disabled]}><Text style={styles.approveText}>ترقية</Text></Pressable> : <Pressable disabled={busyId.length > 0} onPress={() => changeRole(member, "listener")} style={[styles.demote, busyId.length > 0 && styles.disabled]}><Text style={styles.demoteText}>تخفيض</Text></Pressable>}</View>}</View>)}
      <Pressable disabled={loading} onPress={() => void loadPanel(true)} style={styles.refresh}><Text style={styles.refreshText}>تحديث البيانات</Text></Pressable>
      {notice.length > 0 && <Text style={styles.success}>{notice}</Text>}
      {error.length > 0 && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#0F1A2A", borderColor: colors.gold, borderRadius: 18, borderWidth: 1, gap: 12, padding: 15 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, title: { color: colors.text, fontSize: 17, fontWeight: "900", textAlign: "right" }, subtitle: { color: colors.muted, fontSize: 10, marginTop: 3, textAlign: "right" }, badge: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 16, height: 32, justifyContent: "center", width: 32 }, badgeText: { color: "#101827", fontSize: 14, fontWeight: "900" }, sectionTitle: { color: colors.gold, fontSize: 13, fontWeight: "900", marginTop: 4, textAlign: "right" }, request: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, padding: 10 }, avatar: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, smallAvatar: { alignItems: "center", backgroundColor: colors.surfaceRaised, borderRadius: 15, height: 30, justifyContent: "center", width: 30 }, avatarText: { color: colors.gold, fontSize: 14, fontWeight: "900" }, requestBody: { flex: 1, gap: 3 }, name: { color: colors.text, fontSize: 13, fontWeight: "800", textAlign: "right" }, time: { color: colors.muted, fontSize: 10, textAlign: "right" }, actions: { flexDirection: "row-reverse", gap: 6 }, approve: { backgroundColor: colors.green, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, approveText: { color: "#08151C", fontSize: 11, fontWeight: "900" }, reject: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 8 }, rejectText: { color: "#F4B4A3", fontSize: 11, fontWeight: "800" }, member: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 10 }, memberIdentity: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, roleActions: { flexDirection: "row-reverse" }, demote: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, demoteText: { color: colors.text, fontSize: 11, fontWeight: "800" }, role: { color: colors.muted, fontSize: 10, marginTop: 2, textAlign: "right" }, hostRole: { color: colors.gold, fontSize: 10, marginTop: 2, textAlign: "right" }, protected: { color: colors.gold, fontSize: 10, fontWeight: "800" }, empty: { backgroundColor: colors.surface, borderRadius: 12, gap: 5, padding: 13 }, emptyTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textAlign: "right" }, muted: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: "right" }, refresh: { alignItems: "center", borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingVertical: 9 }, refreshText: { color: colors.gold, fontSize: 11, fontWeight: "800" }, success: { color: colors.green, fontSize: 11, lineHeight: 18, textAlign: "right" }, error: { color: "#F4B4A3", fontSize: 11, lineHeight: 18, textAlign: "right" }, disabled: { opacity: 0.5 },
});
