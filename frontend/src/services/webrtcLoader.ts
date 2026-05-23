// Safely load react-native-webrtc.
//
// react-native-webrtc is a NATIVE module. It only works in:
//   - Custom dev builds  (Emergent Publish dev)
//   - Production builds  (Emergent Publish prod)
//
// It does NOT work in:
//   - Expo Go (Constants.executionEnvironment === 'storeClient')
//   - Web (Platform.OS === 'web')
//
// Importing it in any of those environments throws on module init. So we
// detect the runtime first and only call `require()` when it's safe. The
// rest of the app can then ask `isVoiceMeshSupported()` and degrade
// gracefully (showing a "Real voice requires a dev/prod build" banner).

import { Platform } from "react-native";
import Constants from "expo-constants";

type WebRTCExports = {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: any;
  MediaStream: any;
};

let cached: WebRTCExports | null = null;
let attempted = false;

export function isVoiceMeshSupported(): boolean {
  if (Platform.OS === "web") return false;
  // executionEnvironment can be "storeClient" (Expo Go), "standalone", or "bare".
  const env = (Constants as any).executionEnvironment;
  if (env === "storeClient") return false;
  return true;
}

export function loadWebRTC(): WebRTCExports | null {
  if (cached) return cached;
  if (attempted) return null;
  attempted = true;
  if (!isVoiceMeshSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-webrtc");
    cached = {
      RTCPeerConnection: mod.RTCPeerConnection,
      RTCSessionDescription: mod.RTCSessionDescription,
      RTCIceCandidate: mod.RTCIceCandidate,
      mediaDevices: mod.mediaDevices,
      MediaStream: mod.MediaStream,
    };
    return cached;
  } catch {
    return null;
  }
}

export function whyNotSupported(): string | null {
  if (Platform.OS === "web") {
    return "Voice mesh isn't available in the web preview.";
  }
  if ((Constants as any).executionEnvironment === "storeClient") {
    return "Voice mesh isn't available in Expo Go. Tap Publish to build a dev or prod app, then test there.";
  }
  return null;
}
