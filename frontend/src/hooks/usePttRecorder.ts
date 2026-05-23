// Real Push-to-Talk recorder for Velo Voice Pro.
//
// While the rider holds the PTT button we record from the mic; when they
// release we stop and play the recording back through the same device so
// they can audibly verify the round-trip. (Group transmission requires real
// BLE and is intentionally out of scope until the user does a dev build.)

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
  createAudioPlayer,
  type AudioPlayer,
} from "expo-audio";

export function usePttRecorder() {
  const opts = useMemo(() => ({ ...RecordingPresets.HIGH_QUALITY }), []);
  const recorder = useAudioRecorder(opts);
  const playerRef = useRef<AudioPlayer | null>(null);
  const recordingRef = useRef(false);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recorder.stop().catch(() => {});
        recordingRef.current = false;
      }
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [recorder]);

  const start = useCallback(async () => {
    if (Platform.OS === "web") return false;
    if (recordingRef.current) return false;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return false;
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await recorder.prepareToRecordAsync();
      await recorder.record();
      recordingRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, [recorder]);

  const stopAndPlayback = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!recordingRef.current) return;
    try {
      await recorder.stop();
      recordingRef.current = false;
      const uri = recorder.uri;
      // Switch audio session back to playback-friendly.
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      if (uri) {
        // Dispose previous player.
        if (playerRef.current) {
          try {
            playerRef.current.remove();
          } catch {}
          playerRef.current = null;
        }
        const player = createAudioPlayer({ uri });
        playerRef.current = player;
        player.volume = 1.0;
        player.play();
      }
    } catch {
      recordingRef.current = false;
    }
  }, [recorder]);

  return { start, stopAndPlayback };
}
