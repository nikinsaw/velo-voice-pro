# Velo Voice Pro — Product Requirements

## Summary
Single-screen Expo mobile dashboard for cyclists to share music + intercom across multiple phones. Ultra-minimalist obsidian + neon-mint theme, glove-friendly hit targets, no complex navigation.

## Scope
- **Real multi-device sync** via FastAPI WebSocket relay using a 4-character Ride Code (or QR scan).
- **Real local MP3 playback** via expo-audio (3 bundled tracks).
- **Real microphone VOX** via expo-audio recorder metering, gated by a Mic VOX toggle (opt-in).
- **Real Push-to-Talk** record + playback round-trip on the local device.
- **Bluetooth pairing remains a service-contract placeholder** — when you build a dev/prod APK/IPA the `/src/services/bluetoothService.ts` body can be swapped for `react-native-ble-plx`.
- Settings persisted locally via AsyncStorage.

## Backend (FastAPI)
- `GET /api/` — health
- `POST /api/ride/create` — returns `{ code: "XXXX" }` (4-char, no vowels/0/1/I/L)
- `GET /api/ride/{code}` — current room state (riders + music)
- `WS /api/ride/ws/{code}?name=&id=` — bidirectional relay:
  - Server → client: `state`, `rider_joined`, `rider_left`, `rider_speaking`, `rider_renamed`, `music`, `music_volume`
  - Client → server: `speaking`, `music` (play/pause/skip_fwd/skip_back), `music_volume`, `rename`, `ping`
- In-memory room store, no MongoDB (rooms are ephemeral; GC'd when last rider leaves).

## Single screen — `/app/frontend/app/index.tsx`

### A. Group Ride card (`GroupRideCard`)
- Status header (`Solo Ride` ↔ `N Riders Linked`) + animated pulsing dot.
- Rider chips with name; speaking chip gets neon ring + soft fill.
- "Link Ride · Add Rider" → opens RideConnectSheet.
- Intercom Mode segmented: Open Mic ↔ Push-to-Talk.
- PTT mode: "Hold to Talk" → real mic record on press-in → playback on release.

### B. Now Streaming card (`NowStreamingCard`)
- Album art + song metadata.
- 24-bar animated waveform — ducks (compresses) when ducking is active.
- Skip-back · Play/Pause · Skip-forward.
- Group Volume slider with live `%` — **syncs across all riders in the ride.**
- 3 bundled MP3s cycle on skip — track index syncs across riders.

### C. Duck System card (`DuckSystemCard`)
- "Enable Mic VOX" toggle with live mic level bar + threshold marker.
- VOX threshold slider 0–100 with contextual label (WHISPER / NORMAL / LOUD ROAD / WINDY).
- Music Ducking Depth segmented: -50% / -80% / Mute.
- "Simulate Rider Speaking" → broadcasts a 3-second speaking event to peers.

## Multi-device sync (iteration 3 + 4)

### Connection UX
1. First launch → `RiderNameModal` asks for name (auto-suggested from `Constants.deviceName`).
2. Header chip shows `SOLO · <NAME>` (grey dot). Tap to edit name.
3. Tap "Link Ride · Add Rider" → `RideConnectSheet` with two tabs:
   - **START** — feature bullets + "START A NEW RIDE" → POSTs `/api/ride/create`, returns code, immediately joins WS, shows QR + code + Share / Leave.
   - **JOIN** — 4-char code input + "JOIN RIDE", plus "SCAN RIDER'S QR" → `QrScanSheet` (expo-camera, web fallback).
4. Header chip becomes `<CODE> · <NAME>` (neon dot) once connected.
5. Footer shows ride summary.

### Sync rules
- Music: any rider's play/pause/skip is broadcast; the backend keeps authoritative `trackIndex` & `playing`.
- Volume: any rider's volume drag is broadcast; all riders mirror.
- Speaking: each rider's PTT / Mic VOX / Simulate-Speaking flips a boolean that's broadcast. Listeners apply the duck and show the speaker chip glow.
- Settings (VOX threshold, ducking depth, intercom mode) are **per-device**.

### Avoiding echo / stale-closure bugs (lessons learned)
- Backend broadcasts with `exclude_rider_id=sender` so senders never receive their own events.
- Receivers apply remote state locally **without** calling the corresponding send fn (so no infinite loop).
- `Slider.tsx` routes `onChange` / `onChangeEnd` through refs (`onChangeRef`) — the `PanResponder` is created once with `useRef()` and would otherwise capture a stale `onChange` from the first render. Fixed in iteration 4.
- `handleSimulateSpeaking` sets `localSpeaking=true` rather than tracking a separate "fake speaker id" — the existing `useEffect` that watches `localSpeaking` then auto-broadcasts via `ride.sendSpeaking`. Fixed in iteration 4.

## Permissions (app.json)
- iOS: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`
- Android: `RECORD_AUDIO`, `CAMERA`
- Plugins: `expo-router`, `expo-splash-screen`, `expo-asset`, `expo-audio` (mic), `expo-camera` (QR)

## Platform support
- **Expo Go** (Android / iOS): all features fully functional except real BLE pairing.
- **Web preview**: ride sync + UI work; real audio playback is blocked by browser autoplay until first tap; mic VOX disabled (`Platform.OS === 'web'`); QR scanner shows fallback ("Camera not available on web").
- **Real BLE pairing**: still requires a custom dev build via the Emergent Publish button.

## Persistence (AsyncStorage)
- `velo.device_id`, `velo.rider_name`, `velo.volume`, `velo.vox`, `velo.duck_depth`, `velo.mode`, `velo.mic_vox`

## Test IDs (kebab-case)
`dashboard-scroll`, `app-header`, `profile-btn`, `group-ride-card`, `group-ride-status`, `rider-chip-<id>`, `link-ride-btn`, `intercom-mode-open`, `intercom-mode-ptt`, `ptt-button`, `open-mic-hint`, `now-streaming-card`, `track-title`, `track-artist`, `play-pause-btn`, `skip-forward-btn`, `skip-back-btn`, `volume-slider`, `volume-value`, `duck-system-card`, `mic-vox-toggle`, `vox-slider`, `vox-value`, `duck-depth-light`, `duck-depth-deep`, `duck-depth-mute`, `simulate-speaking-btn`, `speaking-indicator`, `self-talk-banner`, `rider-name-modal`, `rider-name-input`, `rider-name-save-btn`, `rider-name-cancel-btn`, `ride-connect-sheet`, `tab-start`, `tab-join`, `start-ride-btn`, `join-code-input`, `join-ride-btn`, `scan-qr-btn`, `connect-sheet-connected`, `ride-code-display`, `share-code-btn`, `leave-ride-btn`, `connect-close-btn`, `qr-scan-sheet`, `qr-grant-btn`, `qr-settings-btn`, `qr-close-btn`.

## Iteration history
- **Iter 1** (UI only): single-screen dashboard, simulated states, 11/11 tests passed.
- **Iter 2** (real audio): expo-audio playback, mic VOX, PTT recording; 11/11 baseline regressions still passing.
- **Iter 3** (multi-device): FastAPI WS relay, ride code + QR, Start/Join flow, presence + music + volume + speaking sync; backend 7/7, frontend 8/11 with 2 real bugs identified.
- **Iter 4** (bug fixes): both bugs fixed — Slider stale-closure (refs), simulate-speaking transmission. All previous regressions still passing.

## Future (deferred)
- Real BLE — replace `scanForNextRider` body with `BleManager.startDeviceScan` (config plugin already documented in the service file).
- Real-time voice over the network: WebRTC P2P (needs dev build) or low-bitrate WS audio chunks (~300-800 ms lag).
- YouTube Music / Spotify shared streaming.
