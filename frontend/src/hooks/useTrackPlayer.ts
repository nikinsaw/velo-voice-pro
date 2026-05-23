// Real audio playback for Velo Voice Pro.
//
// Uses expo-audio (SDK 54). One AudioPlayer instance is kept around and
// `replace()`-d when the user skips tracks. Volume is reactive — group
// volume (user slider) is multiplied by `duckFactor` (1.0 when no rider
// is speaking, lower while ducked) so the duck system can really lower
// the music in real time.

import { useEffect, useRef } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  type AudioSource,
} from "expo-audio";

export type LocalTrack = {
  title: string;
  artist: string;
  album: string;
  art: string;
  source: AudioSource | number; // require(...) returns number; remote uri also OK
};

export function useTrackPlayer(
  tracks: LocalTrack[],
  trackIndex: number,
  volumePct: number, // 0..100
  duckFactor: number, // 0..1
  shouldPlay: boolean,
) {
  // Initialize the player with the first track; we will replace() the source
  // when the user skips. Looping makes the prototype feel "always on".
  const player = useAudioPlayer(tracks[0].source);
  const status = useAudioPlayerStatus(player);
  const lastIndexRef = useRef(0);
  const audioModeSetRef = useRef(false);

  // Configure audio session once so playback works alongside recording
  // (we'll flip allowsRecording on/off elsewhere when we need the mic).
  useEffect(() => {
    if (audioModeSetRef.current) return;
    audioModeSetRef.current = true;
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
    }).catch(() => {});
  }, []);

  // Loop the track when it ends (prototype-style "queue").
  useEffect(() => {
    player.loop = true;
  }, [player]);

  // Swap source on skip.
  useEffect(() => {
    if (trackIndex === lastIndexRef.current) return;
    lastIndexRef.current = trackIndex;
    try {
      player.replace(tracks[trackIndex].source);
      if (shouldPlay) {
        // Slight delay needed before playing on iOS after replace().
        setTimeout(() => {
          try {
            player.play();
          } catch {}
        }, 50);
      }
    } catch {}
  }, [trackIndex, tracks, player, shouldPlay]);

  // Reactive volume = userVolume * duckFactor.
  useEffect(() => {
    const v = Math.max(0, Math.min(1, (volumePct / 100) * duckFactor));
    try {
      player.volume = v;
    } catch {}
  }, [volumePct, duckFactor, player]);

  // Play/pause sync.
  useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch {}
  }, [shouldPlay, player]);

  return {
    player,
    isPlaying: status.playing,
    isLoaded: status.isLoaded,
    duration: status.duration ?? 0,
    currentTime: status.currentTime ?? 0,
  };
}
