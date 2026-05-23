# Velo Voice Pro — Product Requirements

## Summary
Single-screen Expo mobile dashboard for cyclists to manage shared audio and an intercom while wearing Bluetooth earphones. Ultra-minimalist obsidian + neon-mint theme, glove-friendly hit targets, no complex navigation.

## Scope
- Frontend-only (no backend, all settings persisted locally via AsyncStorage).
- **Real local MP3 playback** via expo-audio (3 bundled sample tracks under `/assets/audio/`).
- **Real microphone VOX** (Voice Activation) via expo-audio recorder metering, gated by a user-controlled "Enable Mic VOX" toggle so the mic is never on without consent.
- **Real Push-to-Talk** record + playback round-trip on the local device.
- **Bluetooth pairing remains simulated** in Expo Go preview — real BLE requires a dev build (`react-native-ble-plx`) and is wired as a service contract (`/src/services/bluetoothService.ts`) ready for swap.

## Single screen — `/app/frontend/app/index.tsx`

### A. Group Ride card (`GroupRideCard`)
- Status header ("2 Riders Linked") + animated pulsing dot.
- Rider chips with avatar + name; speaking chip gets neon ring + soft fill.
- "Link Ride · Add Rider" button → calls `scanForNextRider(currentRiders)` from the bluetooth service (simulated ~1.8 s; same API contract for real BLE later).
- Intercom Mode segmented toggle: **Open Mic** ↔ **Push-to-Talk**.
- In PTT mode: "Hold to Talk" button (haptic on press) → starts real mic recording on press-in → stops + plays back on release.
- In Open Mic mode: hint banner explaining VOX gate is active.

### B. Now Streaming card (`NowStreamingCard`)
- Album art + song title + artist + album.
- 24-bar animated waveform — ducks (compresses) when ducking is active.
- Transport: Skip-back · Play/Pause (76 pt glowing neon) · Skip-forward.
- Group Volume slider with live `%` value (drives real player volume).
- 3 bundled MP3s cycle on skip (`sample1.mp3`, `sample2.mp3`, `sample3.mp3`).

### C. Duck System card (`DuckSystemCard`)
- "Enable Mic VOX" toggle row with live mic level bar + threshold marker (shown when enabled).
- VOX threshold slider 0–100 with contextual label (WHISPER / NORMAL / LOUD ROAD / WINDY).
- Music Ducking Depth segmented: **-50% / -80% / Mute**.
- "Simulate Rider Speaking" test button → cycles through linked riders, 3 s speaking event.

## Real-functionality wiring

| Feature | Hook / Service | Notes |
|---|---|---|
| Music playback | `useTrackPlayer` → `useAudioPlayer` from expo-audio | Looped, real volume modulation, real `replace()` on skip. |
| Music ducking | `duckFactor` applied to `player.volume` | When `speakingRiderId !== null`, factor = `DUCK_SCALE[duckDepth]`. |
| Mic VOX | `useVoxMeter` → `useAudioRecorder` (LOW_QUALITY + isMeteringEnabled) | dBFS converted to 0–100; hysteresis prevents flicker; auto-stops when toggle off. |
| Push-to-Talk | `usePttRecorder` → `useAudioRecorder` HIGH_QUALITY + `createAudioPlayer` | Records while held, plays the file back on release. |
| Bluetooth scan | `scanForNextRider` (simulated, async) | Same contract as future real BLE; only swap the implementation. |

## Permissions
- iOS `NSMicrophoneUsageDescription`: "Used for intercom voice and VOX gating"
- Android `RECORD_AUDIO`
- `expo-audio` plugin configures both at build time.

## Platform support
- **Expo Go** (Android / iOS): full real audio + mic + PTT.
- **Web preview**: real audio playback may be blocked by autoplay restrictions; mic VOX is intentionally disabled (`Platform.OS === 'web'`).
- **Bluetooth pairing**: needs a dev/prod build before the simulation can be swapped for real BLE.

## Persistence (AsyncStorage)
- `velo.volume`, `velo.vox`, `velo.duck_depth`, `velo.mode`, `velo.mic_vox`

## Test IDs (kebab-case)
`dashboard-scroll`, `app-header`, `group-ride-card`, `group-ride-status`, `rider-chip-<id>`, `link-ride-btn`, `intercom-mode-open`, `intercom-mode-ptt`, `ptt-button`, `open-mic-hint`, `now-streaming-card`, `track-title`, `track-artist`, `play-pause-btn`, `skip-forward-btn`, `skip-back-btn`, `volume-slider`, `volume-value`, `duck-system-card`, `mic-vox-toggle`, `vox-slider`, `vox-value`, `duck-depth-light`, `duck-depth-deep`, `duck-depth-mute`, `simulate-speaking-btn`, `speaking-indicator`, `self-talk-banner`.

## Future (deferred, ready to drop in)
- Real BLE — replace `scanForNextRider` body with `BleManager.startDeviceScan` (config plugin already documented in the service file).
- YouTube Music / Spotify shared streaming (v2).
- Multi-rider voice mixing across BLE.
