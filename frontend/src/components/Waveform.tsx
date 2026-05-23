import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
  withDelay,
} from "react-native-reanimated";

import { colors } from "@/src/theme";

const BAR_COUNT = 24;
// Pre-generated pseudo-random heights so each bar has its own rhythm.
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = Math.sin(i * 0.7) * 0.5 + 0.5;
  return 0.3 + t * 0.7; // 0.3 - 1.0 relative height
});
const BAR_DELAYS = Array.from({ length: BAR_COUNT }, (_, i) => (i * 80) % 600);

type WaveformProps = {
  playing: boolean;
  ducked: boolean; // when a rider speaks, music ducks
  duckScale: number; // 0..1, how much to reduce
  color?: string;
};

// Lightweight animated waveform; each bar scales independently.
// When `ducked` is true, all bars are smoothly compressed to `duckScale`.
export function Waveform({
  playing,
  ducked,
  duckScale,
  color = colors.primary,
}: WaveformProps) {
  return (
    <View style={styles.row} pointerEvents="none">
      {BAR_HEIGHTS.map((h, i) => (
        <Bar
          key={i}
          height={h}
          delay={BAR_DELAYS[i]}
          playing={playing}
          ducked={ducked}
          duckScale={duckScale}
          color={color}
        />
      ))}
    </View>
  );
}

function Bar({
  height,
  delay,
  playing,
  ducked,
  duckScale,
  color,
}: {
  height: number;
  delay: number;
  playing: boolean;
  ducked: boolean;
  duckScale: number;
  color: string;
}) {
  const pulse = useSharedValue(0.3);
  const compress = useSharedValue(1);

  useEffect(() => {
    if (playing) {
      pulse.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(height, {
              duration: 380,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(height * 0.35, {
              duration: 380,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0.15, { duration: 250 });
    }
    return () => {
      cancelAnimation(pulse);
    };
  }, [playing, delay, height, pulse]);

  useEffect(() => {
    compress.value = withTiming(ducked ? duckScale : 1, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [ducked, duckScale, compress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse.value * compress.value }],
    opacity: 0.5 + pulse.value * 0.5,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 56,
    width: "100%",
  },
  bar: {
    width: 5,
    height: "100%",
    borderRadius: 3,
    transformOrigin: "bottom",
  },
});
