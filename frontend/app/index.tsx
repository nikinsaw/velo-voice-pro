import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
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
import { NowStreamingCard } from "@/src/components/NowStreamingCard";
import {
  DuckSystemCard,
  DuckDepth,
  DUCK_SCALE,
} from "@/src/components/DuckSystemCard";
import {
  useTrackPlayer,
  type LocalTrack,
} from "@/src/hooks/useTrackPlayer";
import { useVoxMeter } from "@/src/hooks/useVoxMeter";
import { usePttRecorder } from "@/src/hooks/usePttRecorder";
import { scanForNextRider } from "@/src/services/bluetoothService";

// Initial connected riders (already-paired from a previous ride).
const ALEX_AVATAR =
  "https://images.unsplash.com/photo-1545575439-3261931f52f1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxjeWNsaXN0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc5NTE4MzIwfDA&ixlib=rb-4.1.0&q=85";
const SARAH_AVATAR =
  "https://images.unsplash.com/photo-1622314873267-d44e38cdd652?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwyfHxjeWNsaXN0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc5NTE4MzIwfDA&ixlib=rb-4.1.0&q=85";

const INITIAL_RIDERS: Rider[] = [
  { id: "alex", name: "Alex", avatar: ALEX_AVATAR },
  { id: "sarah", name: "Sarah", avatar: SARAH_AVATAR },
];

const ALBUM_ART =
  "https://images.unsplash.com/photo-1753170351064-6dd30ef64099?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwc3ludGh3YXZlJTIwYWxidW0lMjBjb3ZlciUyMGFydHxlbnwwfHx8fDE3Nzk1MTgzMjB8MA&ixlib=rb-4.1.0&q=85";

// Bundled MP3s under /app/frontend/assets/audio/.
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

// Web preview can't open the mic via expo-audio.
const MIC_SUPPORTED = Platform.OS !== "web";

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
  const [micVoxEnabled, setMicVoxEnabled] = useState(false);
  const [micLevelPct, setMicLevelPct] = useState(0);

  const simulateCycleRef = useRef(0);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings on mount.
  useEffect(() => {
    (async () => {
      const v = await storage.getItem<number>(K_VOLUME, 65);
      const vx = await storage.getItem<number>(K_VOX, 50);
      const dd = await storage.getItem<string>(K_DUCK_DEPTH, "deep");
      const md = await storage.getItem<string>(K_MODE, "open");
      const mv = await storage.getItem<boolean>(K_MIC_VOX, false);
      if (typeof v === "number") setVolume(v);
      if (typeof vx === "number") setVox(vx);
      if (dd === "light" || dd === "deep" || dd === "mute") setDuckDepth(dd);
      if (md === "open" || md === "ptt") setMode(md);
      if (typeof mv === "boolean") setMicVoxEnabled(mv && MIC_SUPPORTED);
    })();
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    };
  }, []);

  // ----- Real audio playback -----
  // `duckFactor` is what we multiply the user volume by when a rider speaks.
  const ducked = speakingRiderId !== null;
  const duckFactor = ducked ? DUCK_SCALE[duckDepth] : 1.0;

  useTrackPlayer(TRACKS, trackIndex, volume, duckFactor, playing);

  // ----- Real mic VOX -----
  const onVoxActiveChange = useCallback(
    (active: boolean) => {
      // Don't override an in-progress simulate / PTT event.
      if (active) {
        // The mic detected the local user speaking → trigger "me" speaking
        // so the duck system reacts and the UI shows the self-talk banner.
        setSpeakingRiderId("me");
      } else {
        setSpeakingRiderId((cur) => (cur === "me" ? null : cur));
      }
    },
    [],
  );

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

  // ----- Handlers -----
  const handleLinkRide = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    const result = await scanForNextRider(riders);
    setScanning(false);
    if (result.ok) {
      setRiders((prev) =>
        prev.some((p) => p.id === result.rider.id)
          ? prev
          : [...prev, result.rider],
      );
    } else if (result.reason === "no-new-riders") {
      Alert.alert(
        "No riders nearby",
        "Everyone within Bluetooth range is already linked.",
      );
    }
  }, [scanning, riders]);

  const handleModeChange = useCallback((m: IntercomMode) => {
    setMode(m);
    storage.setItem(K_MODE, m);
    if (m === "open") setPttHeldByMe(false);
  }, []);

  const handlePttPressIn = useCallback(async () => {
    setPttHeldByMe(true);
    setSpeakingRiderId("me");
    if (MIC_SUPPORTED) {
      await ptt.start();
    }
  }, [ptt]);

  const handlePttPressOut = useCallback(async () => {
    setPttHeldByMe(false);
    setSpeakingRiderId((cur) => (cur === "me" ? null : cur));
    if (MIC_SUPPORTED) {
      await ptt.stopAndPlayback();
    }
  }, [ptt]);

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

  const handleMicVoxToggle = useCallback((v: boolean) => {
    setMicVoxEnabled(v);
    storage.setItem(K_MIC_VOX, v);
    if (!v) setMicLevelPct(0);
  }, []);

  // Simulate rider speaking — cycles through linked riders so the device
  // "recognizes" the right rider. Used when mic VOX is off, or in PTT mode.
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
            Real local audio + mic VOX · BLE pairing on dev build
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
