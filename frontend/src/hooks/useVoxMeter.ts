// Real microphone VOX (Voice-Activated) detector for Velo Voice Pro.
//
// Strategy: keep an always-listening recorder (LOW_QUALITY preset + metering)
// when `enabled` is true. The recorder's `metering` value comes back in dBFS
// (-160 .. 0). We map dBFS → 0..100 normalized loudness for comparison with
// the user's VOX threshold slider. When loudness crosses the threshold we
// emit `onActive(true)`; when it drops back below (with hysteresis to avoid
// chatter) we emit `onActive(false)`.

import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
} from "expo-audio";

type Options = {
  enabled: boolean;
  /** 0..100; mic level needed to trigger active state. */
  thresholdPct: number;
  /** Called whenever the active state changes. */
  onActiveChange: (active: boolean, levelPct: number) => void;
  /** Optional callback for every metering sample (for visualization). */
  onSample?: (levelPct: number) => void;
};

// dBFS comes back negative (silence ≈ -160, max ≈ 0).
// Map [-60, -10] → [0, 100] for a practical voice range on a phone mic.
function dbToPct(db: number | undefined): number {
  if (db === undefined || db === null || !isFinite(db)) return 0;
  const min = -60;
  const max = -10;
  if (db <= min) return 0;
  if (db >= max) return 100;
  return Math.round(((db - min) / (max - min)) * 100);
}

export function useVoxMeter({
  enabled,
  thresholdPct,
  onActiveChange,
  onSample,
}: Options) {
  // Stable recorder options — must not change between renders.
  const opts = useMemo(
    () => ({
      ...RecordingPresets.LOW_QUALITY,
      isMeteringEnabled: true,
    }),
    [],
  );
  const recorder = useAudioRecorder(opts);
  const state = useAudioRecorderState(recorder, 120); // 120ms updates

  const activeRef = useRef(false);
  const startedRef = useRef(false);
  const aboveCountRef = useRef(0);
  const belowCountRef = useRef(0);

  // Start/stop the recorder according to `enabled`.
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // Web has no native mic recorder via expo-audio.
        if (Platform.OS === "web") return;

        // Request mic permission.
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return;

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        await recorder.record();
        startedRef.current = true;
      } catch {
        // Best-effort; if mic isn't available we silently fall back to
        // the "Simulate Rider Speaking" button.
      }
    };

    const stop = async () => {
      if (!startedRef.current) return;
      startedRef.current = false;
      try {
        await recorder.stop();
      } catch {}
      // Drop mic back so other apps / playback aren't affected.
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });
      } catch {}
      activeRef.current = false;
    };

    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      cancelled = true;
      if (startedRef.current) {
        recorder.stop().catch(() => {});
        startedRef.current = false;
      }
    };
  }, [enabled, recorder]);

  // React to metering samples → emit active state changes with hysteresis.
  useEffect(() => {
    if (!enabled) return;
    const pct = dbToPct(state.metering);
    onSample?.(pct);
    const above = pct >= thresholdPct;

    if (above) {
      aboveCountRef.current += 1;
      belowCountRef.current = 0;
      // require ≥1 consecutive sample over threshold → trigger on
      if (!activeRef.current && aboveCountRef.current >= 1) {
        activeRef.current = true;
        onActiveChange(true, pct);
      }
    } else {
      belowCountRef.current += 1;
      aboveCountRef.current = 0;
      // require ≥6 consecutive below (~720ms) before releasing → trigger off
      if (activeRef.current && belowCountRef.current >= 6) {
        activeRef.current = false;
        onActiveChange(false, pct);
      }
    }
  }, [state.metering, enabled, thresholdPct, onActiveChange, onSample]);

  return {
    isRecording: state.isRecording,
    levelPct: dbToPct(state.metering),
  };
}
