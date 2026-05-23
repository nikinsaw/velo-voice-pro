import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";

import { colors } from "@/src/theme";

type SliderProps = {
  value: number; // 0 - 100
  onChange: (v: number) => void;
  onChangeEnd?: (v: number) => void;
  accent?: string;
  testID?: string;
  disabled?: boolean;
};

// Thick, glove-friendly slider built from scratch (no third-party deps).
// 12px track + 28px white thumb on neon mint fill, per design guidelines.
export function Slider({
  value,
  onChange,
  onChangeEnd,
  accent = colors.primary,
  testID,
  disabled = false,
}: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startValueRef = useRef(value);
  const lastHapticPct = useRef(value);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const updateFromTouch = (locationX: number) => {
    if (widthRef.current <= 0) return;
    const pct = clamp((locationX / widthRef.current) * 100);
    onChange(Math.round(pct));
    // Subtle haptic tick every ~10% so riders can "feel" the drag.
    if (Math.abs(pct - lastHapticPct.current) > 10) {
      lastHapticPct.current = pct;
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        startValueRef.current = value;
        updateFromTouch(e.nativeEvent.locationX);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateFromTouch(e.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onChangeEnd?.(value);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const fillPct = clamp(value);
  const thumbLeft = (fillPct / 100) * width - 14; // half of thumb (28/2)

  return (
    <View
      style={styles.container}
      testID={testID}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${fillPct}%`, backgroundColor: accent }]}
        />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            shadowColor: accent,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    justifyContent: "center",
    width: "100%",
  },
  track: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 4,
    borderColor: colors.surface,
    top: 8,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
