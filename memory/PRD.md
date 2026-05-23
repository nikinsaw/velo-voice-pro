# Velo Voice Pro — Product Requirements

## Summary
Single-screen Expo mobile dashboard for cyclists to manage shared audio and an intercom while wearing Bluetooth earphones. Ultra-minimalist obsidian + neon-mint theme, glove-friendly hit targets, no complex navigation.

## Scope (v1)
- Frontend-only prototype (no backend, no real Bluetooth/audio per user choice).
- All states (Bluetooth scan, group, playback, speaking event) are simulated.
- Settings persisted locally via AsyncStorage (`@/src/utils/storage`).

## Screens & Components
**Single screen:** `/app/frontend/app/index.tsx`

### A. Group Ride card (`GroupRideCard`)
- Group status header ("2 Riders Linked") + animated status dot.
- Rider chips with avatar + name; speaking chip gets neon ring + soft fill.
- "Link Ride · Add Rider" pill button → simulates ~1.8s scan → adds next rider from pool (Mia → Jordan → Kai → Rio).
- Intercom Mode segmented toggle: **Open Mic** ↔ **Push-to-Talk**.
- In PTT mode: "Hold to Talk" button (haptic on press, flips to "Transmitting…").
- In Open Mic mode: hint banner explaining VOX gate is active.
- When any rider is speaking → neon pulsing ring wraps the card and a "X is speaking…" banner appears with animated bars.

### B. Now Streaming card (`NowStreamingCard`)
- Album art (synthwave) + song title + artist + album.
- 24-bar animated waveform (reanimated) — ducks (compresses) when ducking is active.
- Transport: Skip-back · Play/Pause (76pt glowing neon) · Skip-forward.
- Group Volume slider with live `%` value.
- 3 mock tracks cycle on skip.

### C. Duck System card (`DuckSystemCard`)
- VOX (Voice Activation) slider 0–100 with contextual label (WHISPER / NORMAL / LOUD ROAD / WINDY).
- Music Ducking Depth segmented: **-50% / -80% / Mute**.
- "Simulate Rider Speaking" test button → cycles through linked riders, triggers 3s speaking event.

## Behavior Rules
| Trigger | Effect |
|---|---|
| Tap Link Ride | Scanning state 1.8s → adds next nearby rider |
| Tap Simulate Speaking | Picks next rider (round-robin), sets speaking state for 3s, music waveform ducks by selected depth, neon ring pulses around Group card |
| Tap PTT button (press-in) | "Me" becomes speaker, self-talk banner appears at top, music ducks |
| Slider drags | Light haptic ticks every ~10% |
| Volume/VOX/Mode/Duck change | Persisted to AsyncStorage |

## Design System (from `/app/design_guidelines.json`)
- BG `#0A0A0A`, surface `#161618`, elevated `#222225`
- Primary neon `#00FFB2` with `rgba(0,255,178,0.5)` glow
- Card radius 24, pill 999, hit targets 56–76pt
- Bold uppercase headings with wide letter-spacing for outdoor legibility

## Out of Scope (v1)
- Real Bluetooth scanning / pairing
- Real local MP3 scanning / playback (planned for v2 with file-system + expo-audio)
- YouTube Music / streaming-service integration (v2)
- Multi-screen navigation, settings sub-pages

## Test IDs
All interactive elements expose kebab-case `testID`s (e.g. `link-ride-btn`, `play-pause-btn`, `volume-slider`, `vox-slider`, `duck-depth-deep`, `simulate-speaking-btn`, `ptt-button`).

## Files
- `app/index.tsx` — dashboard composition + state
- `src/theme.ts` — design tokens
- `src/components/GroupRideCard.tsx`
- `src/components/NowStreamingCard.tsx`
- `src/components/DuckSystemCard.tsx`
- `src/components/Slider.tsx` — custom glove-friendly slider
- `src/components/SegmentedToggle.tsx`
- `src/components/Waveform.tsx` — animated bars (reanimated)
