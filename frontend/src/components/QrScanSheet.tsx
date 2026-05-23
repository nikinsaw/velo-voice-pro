// QR scanner sheet using expo-camera's CameraView with barcode scanning.
// Returns the scanned ride code (or null on dismiss).

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
};

// Accept both raw "ABCD" and deep links like "velovoice://ride/ABCD".
function extractCode(raw: string): string | null {
  if (!raw) return null;
  const cleanRaw = raw.trim().toUpperCase();
  // Deep link form
  const m = cleanRaw.match(/RIDE[\\/]([A-Z0-9]{4})/);
  if (m) return m[1];
  // Plain 4-char code
  if (/^[A-Z0-9]{4}$/.test(cleanRaw)) return cleanRaw;
  return null;
}

export function QrScanSheet({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const onBarcode = ({ data }: { data: string }) => {
    if (scanned) return;
    const code = extractCode(data);
    if (!code) return;
    setScanned(true);
    onScanned(code);
  };

  const renderBody = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.fallback}>
          <Ionicons name="camera-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.fallbackTitle}>Camera not available on web</Text>
          <Text style={styles.fallbackHelp}>
            Open the app on your phone via Expo Go to scan a ride QR code, or
            enter the ride code manually.
          </Text>
        </View>
      );
    }

    if (!permission) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Initializing camera…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.fallback}>
          <Ionicons name="camera-outline" size={36} color={colors.textSecondary} />
          <Text style={styles.fallbackTitle}>Camera permission needed</Text>
          <Text style={styles.fallbackHelp}>
            To scan a rider&apos;s QR code we need permission to use the
            camera.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity
              testID="qr-grant-btn"
              activeOpacity={0.85}
              onPress={() => requestPermission()}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>ALLOW CAMERA</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="qr-settings-btn"
              activeOpacity={0.85}
              onPress={() => Linking.openSettings()}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>OPEN SETTINGS</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcode}
        />
        <View style={styles.reticle} />
        <Text style={styles.scanLabel}>POINT AT QR CODE</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="qr-scan-sheet">
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Scan Ride QR</Text>
            <TouchableOpacity
              testID="qr-close-btn"
              activeOpacity={0.7}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {renderBody()}
        </View>
      </View>
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
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderSubtle,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.h2,
    fontSize: 20,
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
  cameraWrap: {
    height: 320,
    borderRadius: radii.control,
    overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    width: 200,
    height: 200,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  scanLabel: {
    position: "absolute",
    bottom: 16,
    color: colors.primary,
    fontWeight: "900",
    letterSpacing: 1.6,
    fontSize: 12,
  },
  fallback: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  fallbackTitle: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
  },
  fallbackHelp: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
  },
  primaryBtn: {
    height: sizes.hitTarget,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.3,
  },
});
