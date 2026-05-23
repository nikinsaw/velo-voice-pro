// Stable per-device id, persisted in AsyncStorage.
// Used by the WebSocket ride relay so a phone has the same identity across
// reconnects and across renames.

import { useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

const KEY = "velo.device_id";

function uuid(): string {
  // Minimal RFC4122-ish; good enough for client-side rider id.
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) out += "-";
  }
  return out;
}

export function useDeviceId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const existing = await storage.getItem<string>(KEY, "");
      if (existing) {
        setId(existing);
      } else {
        const fresh = uuid();
        await storage.setItem(KEY, fresh);
        setId(fresh);
      }
    })();
  }, []);
  return id;
}
