import React, { useEffect, useRef, useState } from "react";
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
//
// IMPORTANT: PanResponder is created once with useRef so it survives
// re-renders. Because of that, we must NEVER capture `onChange` /
// `onChangeEnd` directly in the responder closures — instead we keep them
// in refs that are updated every render, so the latest parent callback
// (with the latest closed-over state) is always invoked. This fixes a
// real bug where downstream effects (e.g. sending a WebSocket event when
// connected) were lost because the PanResponder held a stale callback
// from the initial mount.
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
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);
  const disabledRef = useRef(disabled);
  const lastHapticPct = useRef(value);

  // Keep refs in sync with latest props every render.
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onChangeEndRef.current = onChangeEnd;
  }, [onChangeEnd]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const updateFromTouch = (locationX: number) => {
    if (widthRef.current <= 0) return;
    const pct = clamp((locationX / widthRef.current) * 100);
    const rounded = Math.round(pct);
    valueRef.current = rounded;
    onChangeRef.current?.(rounded);
    // Subtle haptic tick every ~10% so riders can "feel" the drag.
    if (Math.abs(pct - lastHapticPct.current) > 10) {
      lastHapticPct.current = pct;
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        updateFromTouch(e.nativeEvent.locationX);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateFromTouch(e.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onChangeEndRef.current?.(valueRef.current);
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
