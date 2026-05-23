import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, spacing, typography } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import {
  GroupRideCard,
  Rider,
  IntercomMode,
} from "@/src/components/GroupRideCard";
import { NowStreamingCard, Track } from "@/src/components/NowStreamingCard";
import {
  DuckSystemCard,
  DuckDepth,
  DUCK_SCALE,
} from "@/src/components/DuckSystemCard";

// Mock rider/track data — local-only (no backend).
const ALEX_AVATAR =
  "https://images.unsplash.com/photo-1545575439-3261931f52f1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxjeWNsaXN0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc5NTE4MzIwfDA&ixlib=rb-4.1.0&q=85";
const SARAH_AVATAR =
  "https://images.unsplash.com/photo-1622314873267-d44e38cdd652?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwyfHxjeWNsaXN0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc5NTE4MzIwfDA&ixlib=rb-4.1.0&q=85";

const INITIAL_RIDERS: Rider[] = [
  { id: "alex", name: "Alex", avatar: ALEX_AVATAR },
  { id: "sarah", name: "Sarah", avatar: SARAH_AVATAR },
];

const NEARBY_POOL: Rider[] = [
  { id: "mia", name: "Mia" },
  { id: "jordan", name: "Jordan" },
  { id: "kai", name: "Kai" },
  { id: "rio", name: "Rio" },
];

const ALBUM_ART =
  "https://images.unsplash.com/photo-1753170351064-6dd30ef64099?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwc3ludGh3YXZlJTIwYWxidW0lMjBjb3ZlciUyMGFydHxlbnwwfHx8fDE3Nzk1MTgzMjB8MA&ixlib=rb-4.1.0&q=85";

const TRACKS: Track[] = [
  {
    title: "Neon Highway",
    artist: "The Drift Collective",
    album: "Asphalt Pulse",
    art: ALBUM_ART,
  },
  {
    title: "Pedal Sequence",
    artist: "Tempo Riders",
    album: "Cadence",
    art: ALBUM_ART,
  },
  {
    title: "Headwind Hymn",
    artist: "Aero Theory",
    album: "Slipstream",
    art: ALBUM_ART,
  },
];

// AsyncStorage keys.
const K_VOLUME = "velo.volume";
const K_VOX = "velo.vox";
const K_DUCK_DEPTH = "velo.duck_depth";
const K_MODE = "velo.mode";

export default function VeloVoiceProDashboard() {
  // ----- Connection / Intercom state -----
  const [riders, setRiders] = useState<Rider[]>(INITIAL_RIDERS);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<IntercomMode>("open");
  const [pttHeldByMe, setPttHeldByMe] = useState(false);

  // ----- Media state -----
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(65);

  // ----- Duck system state -----
  const [vox, setVox] = useState(50);
  const [duckDepth, setDuckDepth] = useState<DuckDepth>("deep");
  const [speakingRiderId, setSpeakingRiderId] = useState<string | null>(null);

  const simulateCycleRef = useRef(0);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings on mount.
  useEffect(() => {
    (async () => {
      const v = await storage.getItem<number>(K_VOLUME, 65);
      const vx = await storage.getItem<number>(K_VOX, 50);
      const dd = await storage.getItem<string>(K_DUCK_DEPTH, "deep");
      const md = await storage.getItem<string>(K_MODE, "open");
      if (typeof v === "number") setVolume(v);
      if (typeof vx === "number") setVox(vx);
      if (dd === "light" || dd === "deep" || dd === "mute") setDuckDepth(dd);
      if (md === "open" || md === "ptt") setMode(md);
    })();
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  // ----- Handlers -----
  const handleLinkRide = useCallback(() => {
    if (scanning) return;
    setScanning(true);
    scanTimerRef.current = setTimeout(() => {
      setRiders((prev) => {
        // Find the first nearby rider not already in the group.
        const next = NEARBY_POOL.find(
          (r) => !prev.some((p) => p.id === r.id),
        );
        return next ? [...prev, next] : prev;
      });
      setScanning(false);
    }, 1800);
  }, [scanning]);

  const handleModeChange = useCallback((m: IntercomMode) => {
    setMode(m);
    storage.setItem(K_MODE, m);
    // Releasing PTT button when switching to open mic.
    if (m === "open") setPttHeldByMe(false);
  }, []);

  const handlePttPressIn = useCallback(() => {
    setPttHeldByMe(true);
    // Self-speaking: light ducking + my own indicator.
    setSpeakingRiderId("me");
  }, []);

  const handlePttPressOut = useCallback(() => {
    setPttHeldByMe(false);
    setSpeakingRiderId((cur) => (cur === "me" ? null : cur));
  }, []);

  const handlePlayPauseToggle = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const handleSkipForward = useCallback(() => {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setPlaying(true);
  }, []);

  const handleSkipBack = useCallback(() => {
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setPlaying(true);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    storage.setItem(K_VOLUME, v);
  }, []);

  const handleVoxChange = useCallback((v: number) => {
    setVox(v);
    storage.setItem(K_VOX, v);
  }, []);

  const handleDuckDepthChange = useCallback((d: DuckDepth) => {
    setDuckDepth(d);
    storage.setItem(K_DUCK_DEPTH, d);
  }, []);

  // Simulate a rider speaking — cycles through the linked riders so the
  // device "recognizes" whose mic is hot (per user clarification).
  const handleSimulateSpeaking = useCallback(() => {
    if (riders.length === 0) return;
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    const speaker = riders[simulateCycleRef.current % riders.length];
    simulateCycleRef.current += 1;
    setSpeakingRiderId(speaker.id);
    speakingTimerRef.current = setTimeout(() => {
      setSpeakingRiderId(null);
      speakingTimerRef.current = null;
    }, 3000);
  }, [riders]);

  const ducked = speakingRiderId !== null;
  const duckScale = DUCK_SCALE[duckDepth];

  // Riders displayed include "me" pseudo-rider only conceptually; we still
  // pass the real riders array. The "me" speaking case is reflected via
  // the speaking banner ("You are speaking…") which we substitute below.
  const ridersForCard = riders;
  const speakingIdForCard =
    speakingRiderId === "me" ? null : speakingRiderId;

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
          <View style={styles.headerRight}>
            <View
              style={[
                styles.connDot,
                {
                  backgroundColor:
                    riders.length > 0 ? colors.primary : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.connText}>
              {riders.length > 0 ? "LIVE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        {/* Self-talking banner */}
        {speakingRiderId === "me" ? (
          <View style={styles.selfTalkBanner} testID="self-talk-banner">
            <View style={styles.selfTalkDot} />
            <Text style={styles.selfTalkText}>You are transmitting…</Text>
          </View>
        ) : null}

        {/* Group Ride */}
        <GroupRideCard
          riders={ridersForCard}
          scanning={scanning}
          speakingRiderId={speakingIdForCard}
          mode={mode}
          onModeChange={handleModeChange}
          onLinkRide={handleLinkRide}
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
          duckScale={duckScale}
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
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Prototype mode · simulated Bluetooth & audio
          </Text>
        </View>
      </ScrollView>
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
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
    letterSpacing: 1.4,
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
  },
});
