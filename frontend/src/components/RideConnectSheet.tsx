// Ride Connect bottom sheet: lets the rider start a new ride (get a code +
// show a QR) or join an existing ride (enter a code or scan a QR).

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Share,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";
import type { ConnectionStatus } from "@/src/hooks/useRideConnection";

type Props = {
  visible: boolean;
  onClose: () => void;
  // Connection bits
  code: string | null;
  status: ConnectionStatus;
  error: string | null;
  onCreateRide: () => Promise<string | null>;
  onJoinRide: (code: string) => boolean;
  onLeaveRide: () => void;
  onScanQr: () => void;
  riderCount: number;
};

type Tab = "start" | "join";

export function RideConnectSheet({
  visible,
  onClose,
  code,
  status,
  error,
  onCreateRide,
  onJoinRide,
  onLeaveRide,
  onScanQr,
  riderCount,
}: Props) {
  const [tab, setTab] = useState<Tab>("start");
  const [joinCode, setJoinCode] = useState("");

  const isConnected = status === "connected" && !!code;
  const isBusy = status === "connecting" || status === "reconnecting";

  const handleCreate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await onCreateRide();
  };

  const handleJoin = () => {
    const clean = joinCode.trim().toUpperCase();
    if (!clean) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onJoinRide(clean);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join my Velo Voice Pro ride. Code: ${code}`,
      });
    } catch {}
  };

  const renderConnectedBody = () => (
    <View style={styles.connectedWrap} testID="connect-sheet-connected">
      <Text style={styles.label}>YOU&apos;RE IN A RIDE</Text>
      <View style={styles.qrCard}>
        <QRCode
          value={`velovoice://ride/${code}`}
          size={170}
          backgroundColor={colors.surfaceElevated}
          color={colors.primary}
        />
      </View>
      <Text style={styles.codeBig} testID="ride-code-display">
        {code}
      </Text>
      <Text style={styles.codeHelper}>
        {riderCount} rider{riderCount === 1 ? "" : "s"} in this ride
      </Text>

      <View style={styles.row}>
        <TouchableOpacity
          testID="share-code-btn"
          activeOpacity={0.85}
          onPress={handleShare}
          style={[styles.btn, styles.btnOutline]}
        >
          <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.btnOutlineText}>SHARE CODE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="leave-ride-btn"
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => {},
            );
            onLeaveRide();
            onClose();
          }}
          style={[styles.btn, styles.btnDanger]}
        >
          <Ionicons name="exit-outline" size={18} color={colors.danger} />
          <Text style={styles.btnDangerText}>LEAVE RIDE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStartTab = () => (
    <View style={styles.tabBody}>
      <View style={styles.featureRow}>
        <View style={styles.bullet}>
          <Ionicons name="qr-code" size={20} color={colors.background} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>You get a 4-letter code + QR</Text>
          <Text style={styles.featureHelp}>
            Share it with riders so they can join your ride from their phone.
          </Text>
        </View>
      </View>
      <View style={styles.featureRow}>
        <View style={styles.bullet}>
          <MaterialCommunityIcons
            name="account-multiple"
            size={20}
            color={colors.background}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Everyone syncs in real time</Text>
          <Text style={styles.featureHelp}>
            Same music, same play state, same volume across every rider&apos;s
            phone.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        testID="start-ride-btn"
        disabled={isBusy}
        activeOpacity={0.85}
        onPress={handleCreate}
        style={[styles.primaryBtn, isBusy && { opacity: 0.6 }]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Ionicons name="add-circle" size={20} color={colors.background} />
            <Text style={styles.primaryBtnText}>START A NEW RIDE</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderJoinTab = () => (
    <View style={styles.tabBody}>
      <Text style={styles.label}>ENTER 4-LETTER CODE</Text>
      <View style={styles.codeInputRow}>
        <TextInput
          testID="join-code-input"
          value={joinCode}
          onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 4))}
          placeholder="—  —  —  —"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={4}
          style={styles.codeInput}
          returnKeyType="go"
          onSubmitEditing={handleJoin}
        />
      </View>

      <TouchableOpacity
        testID="join-ride-btn"
        disabled={isBusy || joinCode.length !== 4}
        activeOpacity={0.85}
        onPress={handleJoin}
        style={[
          styles.primaryBtn,
          (isBusy || joinCode.length !== 4) && { opacity: 0.4 },
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Ionicons name="enter" size={20} color={colors.background} />
            <Text style={styles.primaryBtnText}>JOIN RIDE</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        testID="scan-qr-btn"
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          onScanQr();
        }}
        style={[styles.btn, styles.btnOutline]}
      >
        <Ionicons name="scan" size={18} color={colors.textPrimary} />
        <Text style={styles.btnOutlineText}>SCAN RIDER&apos;S QR</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet} testID="ride-connect-sheet">
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {isConnected ? "Ride Active" : "Link a Ride"}
            </Text>
            <TouchableOpacity
              testID="connect-close-btn"
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {isConnected ? (
            renderConnectedBody()
          ) : (
            <>
              {/* Tab switcher */}
              <View style={styles.tabs}>
                <TouchableOpacity
                  testID="tab-start"
                  activeOpacity={0.8}
                  onPress={() => setTab("start")}
                  style={[
                    styles.tab,
                    tab === "start" && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      tab === "start" && styles.tabLabelActive,
                    ]}
                  >
                    START
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="tab-join"
                  activeOpacity={0.8}
                  onPress={() => setTab("join")}
                  style={[
                    styles.tab,
                    tab === "join" && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      tab === "join" && styles.tabLabelActive,
                    ]}
                  >
                    JOIN
                  </Text>
                </TouchableOpacity>
              </View>

              {tab === "start" ? renderStartTab() : renderJoinTab()}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl + 12,
    gap: spacing.lg,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,59,48,0.12)",
    borderColor: "rgba(255,59,48,0.5)",
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabLabel: {
    color: colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 1.4,
    fontSize: 12,
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },
  tabBody: {
    gap: spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  bullet: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  featureTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  featureHelp: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  label: {
    ...typography.label,
  },
  codeInputRow: {
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
  },
  codeInput: {
    height: 72,
    color: colors.primary,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 10,
    textAlign: "center",
  },
  primaryBtn: {
    height: sizes.hitTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryBtnText: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  dividerText: {
    color: colors.textMuted,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  btn: {
    height: sizes.hitTarget,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    flex: 1,
  },
  btnOutline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  btnOutlineText: {
    color: colors.textPrimary,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.2,
  },
  btnDanger: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.5)",
  },
  btnDangerText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1.2,
  },
  connectedWrap: {
    alignItems: "center",
    gap: spacing.md,
  },
  qrCard: {
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  codeBig: {
    color: colors.primary,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 10,
    marginTop: 4,
  },
  codeHelper: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
    marginTop: spacing.md,
  },
});
