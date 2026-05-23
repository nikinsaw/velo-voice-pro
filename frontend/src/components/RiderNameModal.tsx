// First-launch modal that asks the user for their rider name.
// Auto-populates from Constants.deviceName when available, but always lets
// the user edit before joining a ride.

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, radii, sizes, spacing, typography } from "@/src/theme";

type Props = {
  visible: boolean;
  initialName: string;
  title?: string;
  cta?: string;
  onSave: (name: string) => void;
  onCancel?: () => void;
  cancellable?: boolean;
};

export function RiderNameModal({
  visible,
  initialName,
  title = "What should we call you?",
  cta = "SAVE",
  onSave,
  onCancel,
  cancellable = false,
}: Props) {
  const [value, setValue] = useState(initialName);

  useEffect(() => {
    if (visible) setValue(initialName || "");
  }, [visible, initialName]);

  const trimmed = value.trim();
  const canSave = trimmed.length >= 1 && trimmed.length <= 20;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancellable ? onCancel : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.card} testID="rider-name-modal">
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="bike-fast"
              size={28}
              color={colors.background}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.helper}>
            Your name will be shown to other riders in the group ride.
          </Text>

          <TextInput
            testID="rider-name-input"
            value={value}
            onChangeText={setValue}
            placeholder="Rider name"
            placeholderTextColor={colors.textMuted}
            maxLength={20}
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => canSave && onSave(trimmed)}
          />

          <TouchableOpacity
            testID="rider-name-save-btn"
            disabled={!canSave}
            activeOpacity={0.85}
            onPress={() => canSave && onSave(trimmed)}
            style={[styles.primaryBtn, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.primaryBtnText}>{cta}</Text>
          </TouchableOpacity>

          {cancellable && onCancel ? (
            <TouchableOpacity
              testID="rider-name-cancel-btn"
              activeOpacity={0.7}
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xxl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  title: {
    ...typography.h2,
    fontSize: 22,
  },
  helper: {
    ...typography.body,
    fontSize: 14,
  },
  input: {
    height: sizes.hitTarget,
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
  },
  primaryBtn: {
    height: sizes.hitTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.background,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 1.4,
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1.2,
  },
});
