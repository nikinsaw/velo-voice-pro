import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import { Slider } from "@/src/components/Slider";
import { Waveform } from "@/src/components/Waveform";

export type Track = {
  title: string;
  artist: string;
  album: string;
  art: string;
};

type Props = {
  track: Track;
  playing: boolean;
  volume: number;
  ducked: boolean;
  duckScale: number;
  onPlayPauseToggle: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
  onVolumeChange: (v: number) => void;
};

export function NowStreamingCard({
  track,
  playing,
  volume,
  ducked,
  duckScale,
  onPlayPauseToggle,
  onSkipForward,
  onSkipBack,
  onVolumeChange,
}: Props) {
  return (
    <View style={styles.card} testID="now-streaming-card">
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <View style={styles.streamingDot} />
          <Text style={styles.eyebrow}>NOW STREAMING TO GROUP</Text>
        </View>
      </View>

      {/* Album art + meta */}
      <View style={styles.metaRow}>
        <View style={styles.artWrap}>
          <Image
            source={{ uri: track.art }}
            style={styles.art}
            transition={250}
            contentFit="cover"
          />
          {ducked ? <View style={styles.artDim} /> : null}
        </View>
        <View style={styles.metaText}>
          <Text style={styles.songTitle} numberOfLines={2} testID="track-title">
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1} testID="track-artist">
            {track.artist}
          </Text>
          <Text style={styles.album} numberOfLines={1}>
            {track.album}
          </Text>
        </View>
      </View>

      {/* Waveform */}
      <View style={styles.waveformWrap}>
        <Waveform
          playing={playing}
          ducked={ducked}
          duckScale={duckScale}
        />
      </View>

      {/* Transport controls */}
      <View style={styles.transport}>
        <TouchableOpacity
          testID="skip-back-btn"
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSkipBack();
          }}
          style={styles.skipBtn}
        >
          <Ionicons name="play-skip-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="play-pause-btn"
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            onPlayPauseToggle();
          }}
          style={styles.playBtn}
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={36}
            color={colors.background}
            style={!playing ? { marginLeft: 3 } : undefined}
          />
        </TouchableOpacity>

        <TouchableOpacity
          testID="skip-forward-btn"
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onSkipForward();
          }}
          style={styles.skipBtn}
        >
          <Ionicons
            name="play-skip-forward"
            size={28}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Volume */}
      <View style={styles.sliderBlock}>
        <View style={styles.sliderLabelRow}>
          <View style={styles.sliderLabelLeft}>
            <Ionicons name="volume-medium" size={18} color={colors.textSecondary} />
            <Text style={styles.sliderLabel}>GROUP VOLUME</Text>
          </View>
          <Text style={styles.sliderValue} testID="volume-value">
            {volume}%
          </Text>
        </View>
        <Slider
          testID="volume-slider"
          value={volume}
          onChange={onVolumeChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  artWrap: {
    width: 80,
    height: 80,
    borderRadius: radii.control,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.surfaceElevated,
  },
  art: {
    width: "100%",
    height: "100%",
  },
  artDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  metaText: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  album: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  waveformWrap: {
    paddingVertical: spacing.sm,
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  skipBtn: {
    width: sizes.skip,
    height: sizes.skip,
    borderRadius: sizes.skip / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  playBtn: {
    width: sizes.playPause,
    height: sizes.playPause,
    borderRadius: sizes.playPause / 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  sliderBlock: {
    gap: spacing.sm,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabelLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sliderLabel: {
    ...typography.label,
  },
  sliderValue: {
    ...typography.value,
    color: colors.primary,
  },
});
