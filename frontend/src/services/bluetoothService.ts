// Bluetooth scanning + pairing service for Velo Voice Pro.
//
// REAL BLE STATUS:
// ─────────────────
// Real BLE scanning is NOT supported inside Expo Go because Expo Go's
// pre-built native binary does not include the BLE module. To run real
// BLE you must:
//   1) Install `react-native-ble-plx` (or similar) with `expo install`.
//   2) Add its config plugin to app.json.
//   3) Build a development client OR a production APK/IPA from the
//      Emergent "Publish" button in the top-right corner.
//
// Until then this service stays in `simulated` mode so the user can drive
// the UI and demo the experience in Expo Go. When you flip to a dev build,
// replace `simulatedScan` with a real `BleManager.startDeviceScan(...)`
// implementation. The rest of the app (state machine, rider chips, glow
// ring, ducking) is already plumbed against the same async contract and
// will "just work".
//
// Suggested real implementation (commented for future builds):
//
//   import { BleManager } from "react-native-ble-plx";
//   const ble = new BleManager();
//
//   export async function scanForRiders(): Promise<DiscoveredRider[]> {
//     return new Promise((resolve) => {
//       const found: DiscoveredRider[] = [];
//       ble.startDeviceScan(null, null, (err, device) => {
//         if (err || !device) return;
//         if (device.name && device.name.includes("VeloVoice")) {
//           found.push({ id: device.id, name: device.name });
//         }
//       });
//       setTimeout(() => {
//         ble.stopDeviceScan();
//         resolve(found);
//       }, 4000);
//     });
//   }

import type { Rider } from "@/src/components/GroupRideCard";

const NEARBY_POOL: Rider[] = [
  { id: "mia", name: "Mia" },
  { id: "jordan", name: "Jordan" },
  { id: "kai", name: "Kai" },
  { id: "rio", name: "Rio" },
];

export type ScanResult =
  | { ok: true; rider: Rider }
  | { ok: false; reason: "no-new-riders" | "scan-failed" };

/**
 * Returns the next "nearby" rider not already in the group.
 * `currentRiders` is used to avoid offering a duplicate.
 *
 * This is the simulated implementation. The real BLE version returns
 * the same shape so callers don't change.
 */
export async function scanForNextRider(
  currentRiders: Rider[],
): Promise<ScanResult> {
  // Simulated scan latency (~1.8s) — mirrors the wait of a real BLE scan.
  await new Promise((r) => setTimeout(r, 1800));

  const next = NEARBY_POOL.find(
    (r) => !currentRiders.some((p) => p.id === r.id),
  );
  if (!next) return { ok: false, reason: "no-new-riders" };
  return { ok: true, rider: next };
}

export const isRealBleAvailable = false; // flip when a dev build is wired
