import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

import { colors, radii, sizes } from "@/src/theme";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
  compact?: boolean;
};

// Pill segmented control with a sliding active background.
// Used for Open Mic vs Push-to-Talk and for Ducking Depth.
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  compact = false,
}: Props<T>) {
  const height = compact ? 48 : sizes.hitTarget;
  const innerHeight = height - 12;

  return (
    <View
      style={[
        styles.container,
        { height, padding: 6 },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            testID={
              testIDPrefix ? `${testIDPrefix}-${opt.value}` : undefined
            }
            activeOpacity={0.85}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync().catch(() => {});
                onChange(opt.value);
              }
            }}
            style={[
              styles.option,
              {
                height: innerHeight,
                backgroundColor: active ? colors.surfaceElevated : "transparent",
                borderColor: active ? colors.borderSubtle : "transparent",
              },
            ]}
          >
            {opt.icon ? <View style={styles.icon}>{opt.icon}</View> : null}
            <Text
              style={[
                styles.label,
                {
                  color: active ? colors.textPrimary : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
  },
  option: {
    flex: 1,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  icon: {
    marginRight: 6,
  },
});
