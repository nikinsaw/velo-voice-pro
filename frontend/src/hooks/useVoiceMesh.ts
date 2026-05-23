// Velo Voice Pro — WebRTC voice mesh hook.
//
// Maintains one RTCPeerConnection per remote rider in a full-mesh topology.
// Deterministic initiator: the rider with the lexicographically smaller
// peer id always creates the offer; the other side answers. ICE candidates
// are latched until SDP arrives to avoid the "candidate before remote
// description" failure mode on react-native-webrtc.
//
// Signalling rides on top of the existing FastAPI WebSocket ride relay via
// the `sendSignal` / `onSignal` glue exposed by useRideConnection.
//
// Mic transmission: we attach the local audio track to every peer
// connection. `transmit` toggles the track's `enabled` flag — this gates
// outgoing audio without renegotiating SDP and without closing the mic.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadWebRTC,
  isVoiceMeshSupported,
  whyNotSupported,
} from "@/src/services/webrtcLoader";

export type IceMode = "stun" | "turn";

export type PeerState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export type MeshPeer = {
  id: string;
  name: string;
  state: PeerState;
};

type Args = {
  enabled: boolean;
  selfId: string;
  riders: { id: string; name: string }[]; // other riders only
  iceMode: IceMode;
  transmit: boolean; // is my mic hot?
  sendSignal: (msg: Record<string, unknown>) => void;
  setOnSignal: (cb: ((msg: any) => void) | null) => void;
};

const STUN_ONLY = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const STUN_PLUS_TURN = [
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

function iceServersFor(mode: IceMode) {
  return mode === "turn" ? STUN_PLUS_TURN : STUN_ONLY;
}

type Slot = {
  pc: any; // RTCPeerConnection
  remoteId: string;
  remoteName: string;
  state: PeerState;
  pendingCandidates: any[];
  hasRemoteDescription: boolean;
};

export function useVoiceMesh(args: Args) {
  const {
    enabled,
    selfId,
    riders,
    iceMode,
    transmit,
    sendSignal,
    setOnSignal,
  } = args;

  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotsRef = useRef<Map<string, Slot>>(new Map());
  const localStreamRef = useRef<any | null>(null);
  const localTrackRef = useRef<any | null>(null);
  const iceModeRef = useRef<IceMode>(iceMode);
  const transmitRef = useRef<boolean>(transmit);
  const selfIdRef = useRef<string>(selfId);

  useEffect(() => {
    iceModeRef.current = iceMode;
  }, [iceMode]);
  useEffect(() => {
    transmitRef.current = transmit;
    if (localTrackRef.current) {
      try {
        localTrackRef.current.enabled = transmit;
      } catch {}
    }
  }, [transmit]);
  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  const publishPeers = useCallback(() => {
    const list: MeshPeer[] = [];
    slotsRef.current.forEach((s) => {
      list.push({ id: s.remoteId, name: s.remoteName, state: s.state });
    });
    setPeers(list);
  }, []);

  const updateSlotState = useCallback(
    (remoteId: string, state: PeerState) => {
      const s = slotsRef.current.get(remoteId);
      if (!s) return;
      s.state = state;
      publishPeers();
    },
    [publishPeers],
  );

  const closeSlot = useCallback(
    (remoteId: string) => {
      const s = slotsRef.current.get(remoteId);
      if (!s) return;
      try {
        s.pc.close();
      } catch {}
      slotsRef.current.delete(remoteId);
      publishPeers();
    },
    [publishPeers],
  );

  const ensureSlot = useCallback(
    (remoteId: string, remoteName: string): Slot | null => {
      const rtc = loadWebRTC();
      if (!rtc) return null;
      const existing = slotsRef.current.get(remoteId);
      if (existing) {
        existing.remoteName = remoteName;
        return existing;
      }
      const pc = new rtc.RTCPeerConnection({
        iceServers: iceServersFor(iceModeRef.current),
      });
      const slot: Slot = {
        pc,
        remoteId,
        remoteName,
        state: "new",
        pendingCandidates: [],
        hasRemoteDescription: false,
      };
      slotsRef.current.set(remoteId, slot);

      // Attach the local audio track to the connection.
      if (localStreamRef.current) {
        try {
          localStreamRef.current
            .getTracks()
            .forEach((t: any) => pc.addTrack(t, localStreamRef.current));
        } catch {}
      }

      pc.onicecandidate = (e: any) => {
        if (e.candidate) {
          sendSignal({
            type: "webrtc_ice",
            to: remoteId,
            candidate: e.candidate.toJSON
              ? e.candidate.toJSON()
              : e.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const cs: string = pc.connectionState ?? "";
        let s: PeerState = "connecting";
        if (cs === "connected") s = "connected";
        else if (cs === "disconnected") s = "disconnected";
        else if (cs === "failed" || cs === "closed") s = "failed";
        else if (cs === "new" || cs === "connecting") s = "connecting";
        updateSlotState(remoteId, s);
      };

      pc.ontrack = () => {
        // react-native-webrtc routes remote audio to the device speaker
        // automatically. We don't need to do anything with the stream
        // beyond letting the engine play it.
      };

      publishPeers();
      return slot;
    },
    [sendSignal, publishPeers, updateSlotState],
  );

  // Drain queued ICE candidates after we get the remote description.
  const drainPending = useCallback(async (slot: Slot) => {
    const rtc = loadWebRTC();
    if (!rtc) return;
    while (slot.pendingCandidates.length) {
      const c = slot.pendingCandidates.shift();
      try {
        await slot.pc.addIceCandidate(new rtc.RTCIceCandidate(c));
      } catch {}
    }
  }, []);

  // Initiator side: create offer and send.
  const initiateOffer = useCallback(
    async (slot: Slot) => {
      const rtc = loadWebRTC();
      if (!rtc) return;
      try {
        slot.state = "connecting";
        publishPeers();
        const offer = await slot.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await slot.pc.setLocalDescription(offer);
        sendSignal({
          type: "webrtc_offer",
          to: slot.remoteId,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch (e: any) {
        setError(`Offer failed: ${e?.message ?? "unknown"}`);
      }
    },
    [sendSignal, publishPeers],
  );

  // Incoming signal handler.
  const handleSignal = useCallback(
    async (msg: any) => {
      const rtc = loadWebRTC();
      if (!rtc) return;
      const from = msg?.from;
      if (!from || from === selfIdRef.current) return;
      const knownRider = riders.find((r) => r.id === from);
      const slot =
        slotsRef.current.get(from) ??
        ensureSlot(from, knownRider?.name ?? "Rider");
      if (!slot) return;

      try {
        if (msg.type === "webrtc_offer") {
          await slot.pc.setRemoteDescription(
            new rtc.RTCSessionDescription(msg.sdp),
          );
          slot.hasRemoteDescription = true;
          const answer = await slot.pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
          });
          await slot.pc.setLocalDescription(answer);
          sendSignal({
            type: "webrtc_answer",
            to: from,
            sdp: { type: answer.type, sdp: answer.sdp },
          });
          await drainPending(slot);
        } else if (msg.type === "webrtc_answer") {
          await slot.pc.setRemoteDescription(
            new rtc.RTCSessionDescription(msg.sdp),
          );
          slot.hasRemoteDescription = true;
          await drainPending(slot);
        } else if (msg.type === "webrtc_ice") {
          if (slot.hasRemoteDescription) {
            try {
              await slot.pc.addIceCandidate(
                new rtc.RTCIceCandidate(msg.candidate),
              );
            } catch {}
          } else {
            slot.pendingCandidates.push(msg.candidate);
          }
        }
      } catch (e: any) {
        setError(`Signal handling failed: ${e?.message ?? "unknown"}`);
      }
    },
    [riders, ensureSlot, sendSignal, drainPending],
  );

  // Subscribe to incoming signals as long as the mesh is enabled.
  useEffect(() => {
    if (!enabled) {
      setOnSignal(null);
      return;
    }
    setOnSignal(handleSignal);
    return () => setOnSignal(null);
  }, [enabled, setOnSignal, handleSignal]);

  // Acquire mic + activate mesh.
  useEffect(() => {
    if (!enabled) return;
    if (!isVoiceMeshSupported()) {
      setError(whyNotSupported() ?? "WebRTC not supported.");
      return;
    }
    const rtc = loadWebRTC();
    if (!rtc) {
      setError(whyNotSupported() ?? "WebRTC failed to load.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await rtc.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t: any) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        const tracks = stream.getAudioTracks();
        if (tracks[0]) {
          localTrackRef.current = tracks[0];
          tracks[0].enabled = transmitRef.current;
        }
        setActive(true);
      } catch (e: any) {
        setError(`Microphone access failed: ${e?.message ?? "unknown"}`);
      }
    })();

    return () => {
      cancelled = true;
      setActive(false);
      // Tear down peer connections + stop tracks on disable / unmount.
      slotsRef.current.forEach((s) => {
        try {
          s.pc.close();
        } catch {}
      });
      slotsRef.current.clear();
      setPeers([]);
      if (localStreamRef.current) {
        try {
          localStreamRef.current
            .getTracks()
            .forEach((t: any) => t.stop());
        } catch {}
      }
      localStreamRef.current = null;
      localTrackRef.current = null;
    };
  }, [enabled]);

  // Reconcile the set of peers with the riders list.
  useEffect(() => {
    if (!enabled || !active) return;
    const desired = new Set(riders.map((r) => r.id));

    // Remove slots for riders who left.
    slotsRef.current.forEach((_slot, id) => {
      if (!desired.has(id)) closeSlot(id);
    });

    // Add slots for new riders.
    riders.forEach((r) => {
      const existing = slotsRef.current.get(r.id);
      if (existing) {
        existing.remoteName = r.name;
        return;
      }
      const slot = ensureSlot(r.id, r.name);
      if (!slot) return;
      // Deterministic initiator: smaller id offers.
      if (selfIdRef.current < r.id) {
        // Slight delay so both sides finish ensureSlot before SDP flies.
        setTimeout(() => initiateOffer(slot), 50);
      }
    });
    publishPeers();
  }, [enabled, active, riders, ensureSlot, closeSlot, initiateOffer, publishPeers]);

  // Apply ICE-server changes to existing peer connections at runtime.
  useEffect(() => {
    if (!active) return;
    slotsRef.current.forEach((slot) => {
      try {
        const cfg = slot.pc.getConfiguration?.() ?? {};
        slot.pc.setConfiguration?.({
          ...cfg,
          iceServers: iceServersFor(iceMode),
        });
      } catch {}
    });
  }, [iceMode, active]);

  return {
    supported: isVoiceMeshSupported(),
    notSupportedReason: whyNotSupported(),
    active,
    error,
    peers,
  };
}
