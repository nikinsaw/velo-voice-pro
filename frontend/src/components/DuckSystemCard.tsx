import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import { Slider } from "@/src/components/Slider";
import { SegmentedToggle } from "@/src/components/SegmentedToggle";

export type DuckDepth = "light" | "deep" | "mute";

// Map UI depth labels to actual scale-down factor on music.
export const DUCK_SCALE: Record<DuckDepth, number> = {
  light: 0.5, // -50%
  deep: 0.2, // -80%
  mute: 0.0, // mute
};

type Props = {
  vox: number;
  onVoxChange: (v: number) => void;
  duckDepth: DuckDepth;
  onDuckDepthChange: (d: DuckDepth) => void;
  speaking: boolean;
  onSimulateSpeaking: () => void;
};

export function DuckSystemCard({
  vox,
  onVoxChange,
  duckDepth,
  onDuckDepthChange,
  speaking,
  onSimulateSpeaking,
}: Props) {
  const voxLabel =
    vox < 25
      ? "WHISPER"
      : vox < 55
        ? "NORMAL"
        : vox < 80
          ? "LOUD ROAD"
          : "WINDY";

  return (
    <View style={styles.card} testID="duck-system-card">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>VOICE-OVER-MUSIC</Text>
          <Text style={styles.title}>Duck System</Text>
        </View>
        <MaterialCommunityIcons
          name="waveform"
          size={28}
          color={colors.primary}
        />
      </View>

      <Text style={styles.helper}>
        When a rider speaks, the music auto-ducks so you hear the voice clearly
        without losing ambient awareness.
      </Text>

      {/* VOX */}
      <View style={styles.sliderBlock}>
        <View style={styles.sliderLabelRow}>
          <View style={styles.sliderLabelLeft}>
            <Ionicons
              name="mic-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.sliderLabel}>VOICE ACTIVATION (VOX)</Text>
          </View>
          <View style={styles.voxValueWrap}>
            <Text style={styles.sliderValue} testID="vox-value">
              {vox}
            </Text>
            <Text style={styles.voxBadge}>{voxLabel}</Text>
          </View>
        </View>
        <Slider testID="vox-slider" value={vox} onChange={onVoxChange} />
      </View>

      {/* Ducking depth */}
      <View style={styles.depthBlock}>
        <View style={styles.sliderLabelRow}>
          <View style={styles.sliderLabelLeft}>
            <MaterialCommunityIcons
              name="volume-vibrate"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.sliderLabel}>MUSIC DUCKING DEPTH</Text>
          </View>
        </View>
        <SegmentedToggle
          testIDPrefix="duck-depth"
          value={duckDepth}
          onChange={onDuckDepthChange}
          options={[
            { value: "light", label: "-50%" },
            { value: "deep", label: "-80%" },
            { value: "mute", label: "MUTE" },
          ]}
        />
      </View>

      {/* Simulate Rider Speaking */}
      <TouchableOpacity
        testID="simulate-speaking-btn"
        activeOpacity={0.85}
        onPress={() => {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          onSimulateSpeaking();
        }}
        style={[
          styles.simulateBtn,
          speaking && styles.simulateBtnActive,
        ]}
      >
        <View
          style={[
            styles.simulateIconWrap,
            speaking && { backgroundColor: colors.background },
          ]}
        >
          <Ionicons
            name="play-circle"
            size={22}
            color={speaking ? colors.primary : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.simulateTitle}>
            {speaking ? "DUCKING…" : "SIMULATE RIDER SPEAKING"}
          </Text>
          <Text style={styles.simulateSub}>
            {speaking
              ? "Music ducked, voice channel hot"
              : "Test the voice-over-music priority"}
          </Text>
        </View>
      </TouchableOpacity>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 2,
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  sliderBlock: {
    gap: spacing.sm,
  },
  depthBlock: {
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
  voxValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  voxBadge: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: sizes.hitTarget,
  },
  simulateBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  simulateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  simulateTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  simulateSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
});
