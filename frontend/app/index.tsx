import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import {
  GroupRideCard,
  Rider,
  IntercomMode,
} from "@/src/components/GroupRideCard";
import { NowStreamingCard } from "@/src/components/NowStreamingCard";
import {
  DuckSystemCard,
  DuckDepth,
  DUCK_SCALE,
} from "@/src/components/DuckSystemCard";
import { RiderNameModal } from "@/src/components/RiderNameModal";
import { RideConnectSheet } from "@/src/components/RideConnectSheet";
import { QrScanSheet } from "@/src/components/QrScanSheet";
import {
  useTrackPlayer,
  type LocalTrack,
} from "@/src/hooks/useTrackPlayer";
import { useVoxMeter } from "@/src/hooks/useVoxMeter";
import { usePttRecorder } from "@/src/hooks/usePttRecorder";
import { useDeviceId } from "@/src/hooks/useDeviceId";
import { useRideConnection } from "@/src/hooks/useRideConnection";

const ALBUM_ART =
  "https://images.unsplash.com/photo-1753170351064-6dd30ef64099?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwc3ludGh3YXZlJTIwYWxidW0lMjBjb3ZlciUyMGFydHxlbnwwfHx8fDE3Nzk1MTgzMjB8MA&ixlib=rb-4.1.0&q=85";

const TRACKS: LocalTrack[] = [
  {
    title: "Neon Highway",
    artist: "SoundHelix Demo",
    album: "Asphalt Pulse",
    art: ALBUM_ART,
    source: require("../assets/audio/sample1.mp3"),
  },
  {
    title: "Pedal Sequence",
    artist: "SoundHelix Demo",
    album: "Cadence",
    art: ALBUM_ART,
    source: require("../assets/audio/sample2.mp3"),
  },
  {
    title: "Headwind Hymn",
    artist: "SoundHelix Demo",
    album: "Slipstream",
    art: ALBUM_ART,
    source: require("../assets/audio/sample3.mp3"),
  },
];

// AsyncStorage keys.
const K_VOLUME = "velo.volume";
const K_VOX = "velo.vox";
const K_DUCK_DEPTH = "velo.duck_depth";
const K_MODE = "velo.mode";
const K_MIC_VOX = "velo.mic_vox";
const K_RIDER_NAME = "velo.rider_name";

const MIC_SUPPORTED = Platform.OS !== "web";

export default function VeloVoiceProDashboard() {
  // ----- Identity -----
  const deviceId = useDeviceId();
  const [riderName, setRiderName] = useState<string>("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // ----- UI sheets -----
  const [showConnectSheet, setShowConnectSheet] = useState(false);
  const [showQrScan, setShowQrScan] = useState(false);

  // ----- Intercom + media + duck state -----
  const [mode, setMode] = useState<IntercomMode>("open");
  const [pttHeldByMe, setPttHeldByMe] = useState(false);

  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(65);

  const [vox, setVox] = useState(50);
  const [duckDepth, setDuckDepth] = useState<DuckDepth>("deep");
  const [localSpeaking, setLocalSpeaking] = useState(false); // me speaking (mic or PTT)
  const [simulatedSpeakerId, setSimulatedSpeakerId] = useState<string | null>(
    null,
  );
  const [micVoxEnabled, setMicVoxEnabled] = useState(false);
  const [micLevelPct, setMicLevelPct] = useState(0);

  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulateCycleRef = useRef(0);

  // ----- Boot: load persisted settings + rider name -----
  useEffect(() => {
    (async () => {
      const v = await storage.getItem<number>(K_VOLUME, 65);
      const vx = await storage.getItem<number>(K_VOX, 50);
      const dd = await storage.getItem<string>(K_DUCK_DEPTH, "deep");
      const md = await storage.getItem<string>(K_MODE, "open");
      const mv = await storage.getItem<boolean>(K_MIC_VOX, false);
      const rn = await storage.getItem<string>(K_RIDER_NAME, "");
      if (typeof v === "number") setVolume(v);
      if (typeof vx === "number") setVox(vx);
      if (dd === "light" || dd === "deep" || dd === "mute") setDuckDepth(dd);
      if (md === "open" || md === "ptt") setMode(md);
      if (typeof mv === "boolean") setMicVoxEnabled(mv && MIC_SUPPORTED);

      const initial =
        (typeof rn === "string" && rn.trim()) ||
        (Constants.deviceName ?? "").split(/[''']s? /)[0]?.slice(0, 20) ||
        "";
      if (initial && typeof rn === "string" && rn) {
        setRiderName(initial);
        setShowNameModal(false);
      } else {
        setRiderName(initial);
        setShowNameModal(true);
      }
      setNameLoaded(true);
    })();
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    };
  }, []);

  // ----- Ride connection (WebSocket) -----
  const ride = useRideConnection({
    deviceId: deviceId ?? "",
    name: riderName || "Rider",
  });

  // Remote music event handler — apply incoming play/pause/skip to local state.
  useEffect(() => {
    ride.setOnRemoteMusic((_action, music) => {
      setPlaying(music.playing);
      setTrackIndex(music.trackIndex % TRACKS.length);
    });
    ride.setOnRemoteVolume((vol) => {
      setVolume(vol);
      storage.setItem(K_VOLUME, vol);
    });
  }, [ride]);

  // Whenever local speaking flips, tell the room.
  useEffect(() => {
    if (!ride.isConnected) return;
    ride.sendSpeaking(localSpeaking);
  }, [localSpeaking, ride]);

  // Push rename when name changes after connect.
  useEffect(() => {
    if (ride.isConnected && riderName) ride.sendRename(riderName);
  }, [riderName, ride]);

  // ----- Compute "is anyone speaking" → drives the music duck -----
  const remoteSpeaker = useMemo(
    () => ride.otherRiders.find((r) => r.speaking),
    [ride.otherRiders],
  );
  const ducked = localSpeaking || remoteSpeaker !== undefined;
  const duckFactor = ducked ? DUCK_SCALE[duckDepth] : 1.0;

  // ----- Real audio playback (bundled MP3s) -----
  useTrackPlayer(TRACKS, trackIndex, volume, duckFactor, playing);

  // ----- Real mic VOX -----
  const onVoxActiveChange = useCallback((active: boolean) => {
    setLocalSpeaking(active);
  }, []);
  const onVoxSample = useCallback((pct: number) => {
    setMicLevelPct(pct);
  }, []);
  useVoxMeter({
    enabled: micVoxEnabled && mode === "open" && !pttHeldByMe,
    thresholdPct: vox,
    onActiveChange: onVoxActiveChange,
    onSample: onVoxSample,
  });

  // ----- Real PTT recorder -----
  const ptt = usePttRecorder();

  // ----- Handlers: connection -----
  const openConnect = useCallback(() => {
    if (!riderName) {
      // Need a name before connecting.
      setShowNameModal(true);
      return;
    }
    setShowConnectSheet(true);
  }, [riderName]);

  const handleQrScanned = useCallback(
    (code: string) => {
      setShowQrScan(false);
      ride.joinRide(code);
    },
    [ride],
  );

  // ----- Handlers: media -----
  const handlePlayPauseToggle = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    if (ride.isConnected) ride.sendMusic(next ? "play" : "pause");
  }, [playing, ride]);

  const handleSkipForward = useCallback(() => {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setPlaying(true);
    if (ride.isConnected) ride.sendMusic("skip_fwd");
  }, [ride]);

  const handleSkipBack = useCallback(() => {
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setPlaying(true);
    if (ride.isConnected) ride.sendMusic("skip_back");
  }, [ride]);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      storage.setItem(K_VOLUME, v);
      if (ride.isConnected) ride.sendVolume(v);
    },
    [ride],
  );

  // ----- Handlers: settings -----
  const handleModeChange = useCallback((m: IntercomMode) => {
    setMode(m);
    storage.setItem(K_MODE, m);
    if (m === "open") setPttHeldByMe(false);
  }, []);

  const handleVoxChange = useCallback((v: number) => {
    setVox(v);
    storage.setItem(K_VOX, v);
  }, []);

  const handleDuckDepthChange = useCallback((d: DuckDepth) => {
    setDuckDepth(d);
    storage.setItem(K_DUCK_DEPTH, d);
  }, []);

  const handleMicVoxToggle = useCallback((v: boolean) => {
    setMicVoxEnabled(v);
    storage.setItem(K_MIC_VOX, v);
    if (!v) {
      setMicLevelPct(0);
      setLocalSpeaking(false);
    }
  }, []);

  // ----- Handlers: PTT -----
  const handlePttPressIn = useCallback(async () => {
    setPttHeldByMe(true);
    setLocalSpeaking(true);
    if (MIC_SUPPORTED) await ptt.start();
  }, [ptt]);

  const handlePttPressOut = useCallback(async () => {
    setPttHeldByMe(false);
    setLocalSpeaking(false);
    if (MIC_SUPPORTED) await ptt.stopAndPlayback();
  }, [ptt]);

  // ----- Handlers: simulate ("me" speaks for 3s; broadcasts when connected) -----
  // Always simulating "me" so that when in a ride the peers actually see the
  // glow + ducking via the WebSocket speaking event. In solo mode this just
  // ducks the local music for 3s.
  const handleSimulateSpeaking = useCallback(() => {
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    setLocalSpeaking(true);
    speakingTimerRef.current = setTimeout(() => {
      setLocalSpeaking(false);
      speakingTimerRef.current = null;
    }, 3000);
  }, []);

  // ----- Save name from modal -----
  const handleSaveName = useCallback((name: string) => {
    setRiderName(name);
    storage.setItem(K_RIDER_NAME, name);
    setShowNameModal(false);
    setEditingName(false);
  }, []);

  // ----- Build the riders list shown in the GroupRideCard -----
  const groupRiders: Rider[] = useMemo(() => {
    if (!ride.isConnected) return [];
    return ride.otherRiders.map((r) => ({ id: r.id, name: r.name }));
  }, [ride.isConnected, ride.otherRiders]);

  const speakingIdForCard = remoteSpeaker?.id ?? null;

  // ----- Render -----
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        testID="dashboard-scroll"
      >
        {/* Header */}
        <View style={styles.header} testID="app-header">
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <MaterialCommunityIcons
                name="bike-fast"
                size={22}
                color={colors.background}
              />
            </View>
            <View>
              <Text style={styles.brand}>VELO VOICE</Text>
              <Text style={styles.brandPro}>PRO</Text>
            </View>
          </View>
          <TouchableOpacity
            testID="profile-btn"
            activeOpacity={0.7}
            onPress={() => setEditingName(true)}
            style={styles.headerRight}
          >
            <View
              style={[
                styles.connDot,
                {
                  backgroundColor: ride.isConnected
                    ? colors.primary
                    : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.connText} numberOfLines={1}>
              {ride.isConnected
                ? `${ride.code} · ${riderName || "Rider"}`
                : riderName
                  ? `SOLO · ${riderName.toUpperCase()}`
                  : "SET NAME"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Self-talking banner */}
        {localSpeaking ? (
          <View style={styles.selfTalkBanner} testID="self-talk-banner">
            <View style={styles.selfTalkDot} />
            <Text style={styles.selfTalkText}>You are transmitting…</Text>
          </View>
        ) : null}

        {/* Group Ride */}
        <GroupRideCard
          riders={groupRiders}
          scanning={
            ride.status === "connecting" || ride.status === "reconnecting"
          }
          speakingRiderId={speakingIdForCard}
          mode={mode}
          onModeChange={handleModeChange}
          onLinkRide={openConnect}
          pttHeldByMe={pttHeldByMe}
          onPttPressIn={handlePttPressIn}
          onPttPressOut={handlePttPressOut}
        />

        {/* Now Streaming */}
        <NowStreamingCard
          track={TRACKS[trackIndex]}
          playing={playing}
          volume={volume}
          ducked={ducked}
          duckScale={DUCK_SCALE[duckDepth]}
          onPlayPauseToggle={handlePlayPauseToggle}
          onSkipForward={handleSkipForward}
          onSkipBack={handleSkipBack}
          onVolumeChange={handleVolumeChange}
        />

        {/* Duck System */}
        <DuckSystemCard
          vox={vox}
          onVoxChange={handleVoxChange}
          duckDepth={duckDepth}
          onDuckDepthChange={handleDuckDepthChange}
          speaking={ducked}
          onSimulateSpeaking={handleSimulateSpeaking}
          micVoxEnabled={micVoxEnabled}
          onMicVoxToggle={handleMicVoxToggle}
          micLevelPct={micLevelPct}
          micVoxSupported={MIC_SUPPORTED}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {ride.isConnected
              ? `Ride ${ride.code} · ${ride.riders.length} rider${ride.riders.length === 1 ? "" : "s"} synced`
              : "Tap LINK RIDE to start or join a group"}
          </Text>
        </View>
      </ScrollView>

      {/* Modals (rendered after nameLoaded to avoid flash) */}
      {nameLoaded ? (
        <>
          <RiderNameModal
            visible={showNameModal || editingName}
            initialName={riderName}
            title={editingName ? "Edit rider name" : "What should we call you?"}
            cta={editingName ? "SAVE" : "CONTINUE"}
            cancellable={editingName}
            onSave={handleSaveName}
            onCancel={() => setEditingName(false)}
          />
          <RideConnectSheet
            visible={showConnectSheet}
            onClose={() => setShowConnectSheet(false)}
            code={ride.code}
            status={ride.status}
            error={ride.error}
            onCreateRide={ride.createRide}
            onJoinRide={ride.joinRide}
            onLeaveRide={ride.leaveRide}
            onScanQr={() => setShowQrScan(true)}
            riderCount={ride.riders.length}
          />
          <QrScanSheet
            visible={showQrScan}
            onClose={() => setShowQrScan(false)}
            onScanned={handleQrScanned}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? spacing.lg : 0,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2.5,
    lineHeight: 18,
  },
  brandPro: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3.5,
    lineHeight: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxWidth: 180,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  selfTalkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selfTalkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  selfTalkText: {
    ...typography.value,
    color: colors.primary,
    fontSize: 14,
    letterSpacing: 0.8,
  },
  footer: {
    alignItems: "center",
    paddingTop: spacing.md,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});

// Re-export to silence unused imports if any in tooling.
export { radii, sizes };
