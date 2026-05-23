import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import { SegmentedToggle } from "@/src/components/SegmentedToggle";

export type Rider = {
  id: string;
  name: string;
  avatar?: string;
};

export type IntercomMode = "open" | "ptt";

type Props = {
  riders: Rider[];
  scanning: boolean;
  speakingRiderId: string | null;
  mode: IntercomMode;
  onModeChange: (m: IntercomMode) => void;
  onLinkRide: () => void;
  pttHeldByMe: boolean;
  onPttPressIn: () => void;
  onPttPressOut: () => void;
};

export function GroupRideCard({
  riders,
  scanning,
  speakingRiderId,
  mode,
  onModeChange,
  onLinkRide,
  pttHeldByMe,
  onPttPressIn,
  onPttPressOut,
}: Props) {
  const speaking = speakingRiderId !== null;
  const speakingRider = riders.find((r) => r.id === speakingRiderId);

  // Pulsing neon ring when someone is speaking.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (speaking) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(glow);
  }, [speaking, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    shadowOpacity: glow.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowRing, glowStyle]}
      />
      <View
        style={[
          styles.card,
          speaking && {
            borderColor: colors.primary,
          },
        ]}
        testID="group-ride-card"
      >
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>GROUP RIDE</Text>
            <Text style={styles.title} testID="group-ride-status">
              {riders.length === 0
                ? "Solo Ride"
                : `${riders.length} Rider${riders.length > 1 ? "s" : ""} Linked`}
            </Text>
          </View>
          <StatusDot active={riders.length > 0} speaking={speaking} />
        </View>

        {/* Rider avatars row */}
        <View style={styles.ridersRow}>
          {riders.length === 0 ? (
            <View style={styles.emptyRiders}>
              <MaterialCommunityIcons
                name="bluetooth-off"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No riders linked yet</Text>
            </View>
          ) : (
            riders.map((rider) => (
              <RiderChip
                key={rider.id}
                rider={rider}
                speaking={rider.id === speakingRiderId}
              />
            ))
          )}
        </View>

        {/* Speaking indicator */}
        {speaking && speakingRider ? (
          <View style={styles.speakingBanner} testID="speaking-indicator">
            <View style={styles.speakingDot} />
            <Text style={styles.speakingText}>
              {speakingRider.name} is speaking…
            </Text>
            <SpeakingBars />
          </View>
        ) : null}

        {/* Link Ride button */}
        <TouchableOpacity
          testID="link-ride-btn"
          activeOpacity={0.85}
          disabled={scanning}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            onLinkRide();
          }}
          style={[
            styles.linkBtn,
            scanning && { opacity: 0.7 },
          ]}
        >
          {scanning ? (
            <>
              <ActivityIndicator size="small" color={colors.background} />
              <Text style={styles.linkBtnText}>SCANNING…</Text>
            </>
          ) : (
            <>
              <Ionicons name="bluetooth" size={20} color={colors.background} />
              <Text style={styles.linkBtnText}>LINK RIDE · ADD RIDER</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Intercom mode toggle */}
        <Text style={styles.sectionLabel}>INTERCOM MODE</Text>
        <SegmentedToggle
          testIDPrefix="intercom-mode"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "open", label: "OPEN MIC" },
            { value: "ptt", label: "PUSH-TO-TALK" },
          ]}
        />

        {/* PTT button only visible in PTT mode */}
        {mode === "ptt" ? (
          <TouchableOpacity
            testID="ptt-button"
            activeOpacity={0.9}
            onPressIn={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
                () => {},
              );
              onPttPressIn();
            }}
            onPressOut={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              onPttPressOut();
            }}
            style={[
              styles.pttBtn,
              pttHeldByMe && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name="mic"
              size={24}
              color={pttHeldByMe ? colors.background : colors.textPrimary}
            />
            <Text
              style={[
                styles.pttBtnText,
                pttHeldByMe && { color: colors.background },
              ]}
            >
              {pttHeldByMe ? "TRANSMITTING…" : "HOLD TO TALK"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.openMicHint} testID="open-mic-hint">
            <MaterialCommunityIcons
              name="microphone-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.openMicText}>
              Mic is always open. VOX gate active.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusDot({
  active,
  speaking,
}: {
  active: boolean;
  speaking: boolean;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1);
    }
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: active ? 1 / pulse.value : 0.3,
  }));

  return (
    <View style={statusStyles.wrap}>
      <Animated.View
        style={[
          statusStyles.ring,
          {
            borderColor: speaking
              ? colors.primary
              : active
                ? colors.primary
                : colors.textMuted,
          },
          ringStyle,
        ]}
      />
      <View
        style={[
          statusStyles.dot,
          {
            backgroundColor: active ? colors.primary : colors.textMuted,
          },
        ]}
      />
    </View>
  );
}

function RiderChip({
  rider,
  speaking,
}: {
  rider: Rider;
  speaking: boolean;
}) {
  return (
    <View
      style={[
        styles.riderChip,
        speaking && {
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
        },
      ]}
      testID={`rider-chip-${rider.id}`}
    >
      <View style={styles.avatarWrap}>
        {rider.avatar ? (
          <Image source={{ uri: rider.avatar }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarImg, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {rider.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {speaking ? (
          <View style={styles.speakingRing} />
        ) : null}
      </View>
      <Text
        style={[
          styles.riderName,
          speaking && { color: colors.primary },
        ]}
        numberOfLines={1}
      >
        {rider.name}
      </Text>
    </View>
  );
}

function SpeakingBars() {
  const v1 = useSharedValue(0.4);
  const v2 = useSharedValue(0.4);
  const v3 = useSharedValue(0.4);

  useEffect(() => {
    const loop = (sv: typeof v1, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 250 + delay }),
          withTiming(0.3, { duration: 250 + delay }),
        ),
        -1,
        true,
      );
    };
    loop(v1, 0);
    loop(v2, 60);
    loop(v3, 120);
    return () => {
      cancelAnimation(v1);
      cancelAnimation(v2);
      cancelAnimation(v3);
    };
  }, [v1, v2, v3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scaleY: v1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scaleY: v2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scaleY: v3.value }] }));

  return (
    <View style={styles.speakingBars}>
      <Animated.View style={[styles.speakingBar, s1]} />
      <Animated.View style={[styles.speakingBar, s2]} />
      <Animated.View style={[styles.speakingBar, s3]} />
    </View>
  );
}

const statusStyles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  glowRing: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radii.card + 4,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 4,
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  ridersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  emptyRiders: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    fontSize: 14,
  },
  riderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingRight: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    position: "relative",
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    color: colors.textPrimary,
    fontWeight: "800",
  },
  speakingRing: {
    position: "absolute",
    top: -3,
    left: -3,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  riderName: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 14,
  },
  speakingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.control,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  speakingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  speakingText: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 14,
    flex: 1,
  },
  speakingBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 18,
  },
  speakingBar: {
    width: 3,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: sizes.hitTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  linkBtnText: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.2,
  },
  sectionLabel: {
    ...typography.label,
    marginTop: 4,
  },
  pttBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: sizes.hitTargetLg,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  pttBtnText: {
    color: colors.textPrimary,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.2,
  },
  openMicHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  openMicText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
});
