import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AudioSession } from "@livekit/react-native";
import { ConnectionState, Participant, Room, RoomEvent } from "livekit-client";
import { colors } from "../../theme/tokens";

type LiveKitAudioRoomProps = {
  token: string;
  serverUrl: string;
  onStateChange?: (state: "connecting" | "connected" | "reconnecting" | "disconnected" | "error") => void;
};

export function LiveKitAudioRoom({ token, serverUrl, onStateChange }: LiveKitAudioRoomProps) {
  const room = useMemo(() => new Room({ adaptiveStream: false, dynacast: false }), []);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [micEnabled, setMicEnabled] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    let active = true;
    const syncParticipants = () => {
      if (!active) return;
      setParticipants(Array.from(room.remoteParticipants.values()));
    };
    const connect = async () => {
      try {
        setState(ConnectionState.Connecting); onStateChange?.("connecting");
        await AudioSession.startAudioSession();
        await room.connect(serverUrl, token, { autoSubscribe: true });
        if (!active) return;
        await room.localParticipant.setMicrophoneEnabled(true);
        setMicEnabled(true); setState(room.state); onStateChange?.("connected"); syncParticipants();
      } catch (connectionError) {
        if (!active) return;
        setError(connectionError instanceof Error ? connectionError.message : "تعذر الاتصال الصوتي");
        setState(ConnectionState.Disconnected); onStateChange?.("error");
      }
    };
    const onConnected = () => { setState(ConnectionState.Connected); onStateChange?.("connected"); syncParticipants(); };
    const onReconnecting = () => { setState(ConnectionState.Reconnecting); onStateChange?.("reconnecting"); };
    const onReconnected = () => { setState(ConnectionState.Connected); onStateChange?.("connected"); syncParticipants(); };
    const onDisconnected = () => { setState(ConnectionState.Disconnected); onStateChange?.("disconnected"); syncParticipants(); };
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, syncParticipants);
    room.on(RoomEvent.TrackUnsubscribed, syncParticipants);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    connect();
    return () => {
      active = false;
      room.removeAllListeners();
      room.disconnect();
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [onStateChange, room, serverUrl, token]);

  const toggleMicrophone = async () => {
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  if (Platform.OS === "web") return <Text style={styles.info}>الصوت الحقيقي متاح في Android وiOS عبر development build فقط.</Text>;

  return (
    <View style={styles.panel}>
      <View style={styles.header}><Text style={styles.title}>الصوت المباشر</Text><Text style={styles.status}>{state === ConnectionState.Connected ? "متصل" : state === ConnectionState.Reconnecting ? "يعاد الاتصال" : state === ConnectionState.Connecting ? "جارٍ الاتصال" : "غير متصل"}</Text></View>
      <Text style={styles.meta}>{participants.length + 1} مشارك صوتي · يدير المضيف صلاحيات التحدث من الخادم</Text>
      <Pressable onPress={toggleMicrophone} style={[styles.micButton, !micEnabled && styles.micOff]}><Text style={styles.micText}>{micEnabled ? "كتم الميكروفون" : "تشغيل الميكروفون"}</Text></Pressable>
      {participants.map((participant) => <View key={participant.identity} style={styles.participant}><View style={styles.dot} /><Text style={styles.participantText}>{participant.name || participant.identity}</Text><Text style={styles.role}>{participant.isSpeaking ? "يتحدث الآن" : "مستمع"}</Text></View>)}
      {error.length > 0 && <Text style={styles.error}>فشل اتصال الصوت: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "#101C2D", borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 10, padding: 14 }, header: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" }, title: { color: colors.text, fontSize: 16, fontWeight: "900" }, status: { color: colors.green, fontSize: 12, fontWeight: "800" }, meta: { color: colors.muted, fontSize: 11, textAlign: "right" }, micButton: { alignItems: "center", backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 11 }, micOff: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder, borderWidth: 1 }, micText: { color: "#101827", fontSize: 12, fontWeight: "900" }, participant: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, dot: { backgroundColor: colors.green, borderRadius: 4, height: 8, width: 8 }, participantText: { color: colors.text, flex: 1, fontSize: 12, textAlign: "right" }, role: { color: colors.muted, fontSize: 11 }, info: { color: colors.gold, fontSize: 12, lineHeight: 20, textAlign: "right" }, error: { color: "#F4B4A3", fontSize: 11, lineHeight: 18, textAlign: "right" },
});
