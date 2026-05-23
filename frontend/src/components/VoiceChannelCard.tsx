// Velo Voice Pro — Voice Channel card.
//
// Shows the real-voice mesh status, lets the user pick ICE mode (STUN-only
// vs STUN+TURN) and toggle whether voice mesh is engaged. When running in
// Expo Go or web preview, shows a clear "build required" hint instead of
// pretending it works.

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import { SegmentedToggle } from "@/src/components/SegmentedToggle";
import type { IceMode, MeshPeer } from "@/src/hooks/useVoiceMesh";

type Props = {
  supported: boolean;
  notSupportedReason: string | null;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  active: boolean;
  error: string | null;
  peers: MeshPeer[];
  iceMode: IceMode;
  onIceModeChange: (m: IceMode) => void;
  transmitting: boolean;
  isInRide: boolean;
};

export function VoiceChannelCard({
  supported,
  notSupportedReason,
  enabled,
  onEnabledChange,
  active,
  error,
  peers,
  iceMode,
  onIceModeChange,
  transmitting,
  isInRide,
}: Props) {
  const connectedCount = peers.filter((p) => p.state === "connected").length;
  const totalPeers = peers.length;

  return (
    <View style={styles.card} testID="voice-channel-card">
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>REAL-TIME VOICE · WEBRTC</Text>
          <Text style={styles.title}>Voice Channel</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            active && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: active
                  ? colors.primary
                  : colors.textMuted,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: active ? colors.primary : colors.textSecondary },
            ]}
          >
            {active ? "LIVE" : "IDLE"}
          </Text>
        </View>
      </View>

      {!supported ? (
        <View style={styles.notSupportedBanner} testID="voice-mesh-unsupported">
          <Ionicons name="construct" size={18} color={colors.primary} />
          <Text style={styles.notSupportedText}>
            {notSupportedReason ??
              "Voice mesh requires a custom dev or prod build."}
          </Text>
        </View>
      ) : !isInRide ? (
        <Text style={styles.helper}>
          Link a ride first — then enable Voice Channel here to hear other
          riders over the same group.
        </Text>
      ) : (
        <Text style={styles.helper}>
          Direct phone-to-phone audio over the open internet. Microphone
          follows your Open Mic / Push-to-Talk setting above.
        </Text>
      )}

      {/* Enable toggle */}
      <TouchableOpacity
        testID="voice-mesh-toggle"
        disabled={!supported || !isInRide}
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
          onEnabledChange(!enabled);
        }}
        style={[
          styles.enableRow,
          enabled && active && styles.enableRowActive,
          (!supported || !isInRide) && { opacity: 0.5 },
        ]}
      >
        <View
          style={[
            styles.enableIcon,
            enabled && active && { backgroundColor: colors.primary },
          ]}
        >
          <MaterialCommunityIcons
            name={enabled ? "broadcast" : "broadcast-off"}
            size={20}
            color={enabled && active ? colors.background : colors.textPrimary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.enableTitle}>
            {enabled && active
              ? transmitting
                ? "TRANSMITTING · MIC HOT"
                : "VOICE CHANNEL ENGAGED"
              : enabled
                ? "STARTING…"
                : "ENGAGE VOICE CHANNEL"}
          </Text>
          <Text style={styles.enableSub} numberOfLines={1}>
            {!isInRide
              ? "Link a ride to enable"
              : enabled
                ? `${connectedCount}/${totalPeers} peer${totalPeers === 1 ? "" : "s"} connected`
                : "Phone-to-phone voice between riders"}
          </Text>
        </View>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* Peer list */}
      {enabled && peers.length > 0 ? (
        <View style={styles.peerList} testID="voice-peer-list">
          {peers.map((p) => (
            <View key={p.id} style={styles.peerRow} testID={`voice-peer-${p.id}`}>
              <View
                style={[
                  styles.peerDot,
                  {
                    backgroundColor:
                      p.state === "connected"
                        ? colors.primary
                        : p.state === "failed" ||
                            p.state === "disconnected"
                          ? colors.danger
                          : colors.textSecondary,
                  },
                ]}
              />
              <Text style={styles.peerName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.peerState}>{p.state.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ICE mode picker */}
      <View style={styles.iceBlock}>
        <View style={styles.iceLabelRow}>
          <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.iceLabel}>NETWORK PATH</Text>
        </View>
        <SegmentedToggle
          compact
          testIDPrefix="ice-mode"
          value={iceMode}
          onChange={onIceModeChange}
          options={[
            { value: "stun", label: "STUN ONLY" },
            { value: "turn", label: "STUN + TURN" },
          ]}
        />
        <Text style={styles.iceHelp}>
          {iceMode === "stun"
            ? "Fast P2P when networks allow. Falls over on strict cellular NATs."
            : "Uses a free TURN relay (openrelay.metered.ca) for stubborn networks."}
        </Text>
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
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  notSupportedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  notSupportedText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
    fontWeight: "600",
  },
  enableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: sizes.hitTarget,
  },
  enableRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  enableIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  enableTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  enableSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: "rgba(255,59,48,0.12)",
    borderColor: "rgba(255,59,48,0.5)",
    borderWidth: 1,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  peerList: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  peerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  peerDot: { width: 8, height: 8, borderRadius: 4 },
  peerName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  peerState: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  iceBlock: { gap: spacing.sm },
  iceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iceLabel: { ...typography.label },
  iceHelp: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
