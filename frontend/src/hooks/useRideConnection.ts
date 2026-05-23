// Velo Voice Pro — WebSocket-based ride connection hook.
//
// Connects to the FastAPI ride relay so multiple devices can join the same
// "Ride Room" via a 4-character code. The server broadcasts presence + music
// + speaker events; we mirror that into local state and expose simple
// send functions to push events back to the room.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

export type RemoteRider = {
  id: string;
  name: string;
  speaking: boolean;
};

export type RemoteMusic = {
  trackIndex: number;
  playing: boolean;
  volume: number;
};

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

type Args = {
  /** Stable per-device id (uuid persisted in storage). */
  deviceId: string;
  /** Rider display name to advertise to the room. */
  name: string;
};

export type RideConnection = ReturnType<typeof useRideConnection>;

export function useRideConnection({ deviceId, name }: Args) {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [riders, setRiders] = useState<RemoteRider[]>([]);
  const [music, setMusic] = useState<RemoteMusic>({
    trackIndex: 0,
    playing: true,
    volume: 65,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef = useRef<string | null>(null);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // Public listeners — main screen wires music/speaking deltas from these.
  const onRemoteMusicRef = useRef<
    ((action: string, music: RemoteMusic, from: string) => void) | null
  >(null);
  const onRemoteVolumeRef = useRef<
    ((volume: number, from: string) => void) | null
  >(null);

  const setOnRemoteMusic = useCallback(
    (cb: typeof onRemoteMusicRef.current) => {
      onRemoteMusicRef.current = cb;
    },
    [],
  );
  const setOnRemoteVolume = useCallback(
    (cb: typeof onRemoteVolumeRef.current) => {
      onRemoteVolumeRef.current = cb;
    },
    [],
  );

  const cleanupSocket = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const buildWsUrl = (targetCode: string) => {
    // EXPO_PUBLIC_BACKEND_URL looks like https://....preview.emergentagent.com
    const base = BACKEND_URL.replace(/^http/, "ws");
    const params = new URLSearchParams({
      name: nameRef.current,
      id: deviceId,
    }).toString();
    return `${base}/api/ride/ws/${targetCode}?${params}`;
  };

  const openSocket = useCallback(
    (targetCode: string) => {
      cleanupSocket();
      setError(null);
      setStatus("connecting");

      const url = buildWsUrl(targetCode);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (e: any) {
        setError(e?.message ?? "Failed to open WebSocket");
        setStatus("error");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        // Heartbeat to keep proxies from idling us out.
        pingTimerRef.current = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {}
        }, 25000);
      };

      ws.onmessage = (evt) => {
        let payload: any;
        try {
          payload = JSON.parse(typeof evt.data === "string" ? evt.data : "");
        } catch {
          return;
        }
        const t = payload?.type;
        if (t === "state") {
          setRiders(payload.riders ?? []);
          setMusic(payload.music);
        } else if (t === "rider_joined") {
          setRiders((prev) =>
            prev.some((r) => r.id === payload.rider.id)
              ? prev
              : [...prev, payload.rider],
          );
        } else if (t === "rider_left") {
          setRiders((prev) => prev.filter((r) => r.id !== payload.rider_id));
        } else if (t === "rider_speaking") {
          setRiders((prev) =>
            prev.map((r) =>
              r.id === payload.rider_id ? { ...r, speaking: payload.on } : r,
            ),
          );
        } else if (t === "rider_renamed") {
          setRiders((prev) =>
            prev.map((r) =>
              r.id === payload.rider_id ? { ...r, name: payload.name } : r,
            ),
          );
        } else if (t === "music") {
          setMusic(payload.music);
          onRemoteMusicRef.current?.(payload.action, payload.music, payload.from);
        } else if (t === "music_volume") {
          setMusic((m) => ({ ...m, volume: payload.volume }));
          onRemoteVolumeRef.current?.(payload.volume, payload.from);
        }
      };

      ws.onerror = () => {
        setError("Connection error");
      };

      ws.onclose = (e) => {
        setStatus((prev) => (prev === "idle" ? "idle" : "error"));
        if (!e?.wasClean && codeRef.current === targetCode) {
          // Auto-reconnect once after 1.5s if we lost the connection unexpectedly.
          setTimeout(() => {
            if (codeRef.current === targetCode) {
              setStatus("reconnecting");
              openSocket(targetCode);
            }
          }, 1500);
        }
      };
    },
    [cleanupSocket, deviceId],
  );

  // ----- Public API -----

  const createRide = useCallback(async (): Promise<string | null> => {
    try {
      setStatus("connecting");
      const res = await fetch(`${BACKEND_URL}/api/ride/create`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newCode = String(data.code).toUpperCase();
      codeRef.current = newCode;
      setCode(newCode);
      openSocket(newCode);
      return newCode;
    } catch (e: any) {
      setError(e?.message ?? "Failed to create ride");
      setStatus("error");
      return null;
    }
  }, [openSocket]);

  const joinRide = useCallback(
    (targetCode: string): boolean => {
      const clean = (targetCode || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(clean)) {
        setError("Code must be 4 characters (letters or numbers).");
        return false;
      }
      codeRef.current = clean;
      setCode(clean);
      openSocket(clean);
      return true;
    },
    [openSocket],
  );

  const leaveRide = useCallback(() => {
    cleanupSocket();
    codeRef.current = null;
    setCode(null);
    setStatus("idle");
    setError(null);
    setRiders([]);
    setMusic({ trackIndex: 0, playing: true, volume: 65 });
  }, [cleanupSocket]);

  const sendSpeaking = useCallback((on: boolean) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "speaking", on }));
    } catch {}
  }, []);

  const sendMusic = useCallback(
    (action: "play" | "pause" | "skip_fwd" | "skip_back") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "music", action }));
      } catch {}
    },
    [],
  );

  const sendVolume = useCallback((volume: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "music_volume", volume }));
    } catch {}
  }, []);

  const sendRename = useCallback((newName: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "rename", name: newName }));
    } catch {}
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => cleanupSocket();
  }, [cleanupSocket]);

  const isConnected = status === "connected";

  // Self rider (the local device) — present in `riders` once connected.
  const selfRider = riders.find((r) => r.id === deviceId) ?? null;
  // Others
  const otherRiders = riders.filter((r) => r.id !== deviceId);

  return {
    code,
    status,
    error,
    isConnected,
    riders,
    selfRider,
    otherRiders,
    music,
    createRide,
    joinRide,
    leaveRide,
    sendSpeaking,
    sendMusic,
    sendVolume,
    sendRename,
    setOnRemoteMusic,
    setOnRemoteVolume,
    // Useful for the QR encoder.
    deepLink:
      code && Platform.OS !== "web"
        ? `velovoice://ride/${code}`
        : code
          ? `velovoice://ride/${code}`
          : null,
  };
}
