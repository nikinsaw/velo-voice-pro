"""
Velo Voice Pro — FastAPI backend.

Provides a WebSocket relay so multiple phones can join the same "Ride Room"
identified by a short 4-character ride code. The server keeps an in-memory
room state (riders, music state) and broadcasts events between participants.

Only ephemeral signalling lives here — no MongoDB, no persistence. If the
server restarts every room is dropped and clients must re-join.
"""

import asyncio
import json
import logging
import os
import random
import string
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Velo Voice Pro Backend")
api_router = APIRouter(prefix="/api")


# ----- Ride room model ------------------------------------------------------


@dataclass
class Rider:
    id: str
    name: str
    speaking: bool = False


@dataclass
class MusicState:
    trackIndex: int = 0
    playing: bool = True
    volume: int = 65  # 0..100, host-driven shared volume floor


@dataclass
class RideRoom:
    code: str
    riders: Dict[str, Rider] = field(default_factory=dict)
    sockets: Dict[str, WebSocket] = field(default_factory=dict)
    music: MusicState = field(default_factory=MusicState)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def public_state(self) -> dict:
        return {
            "code": self.code,
            "riders": [asdict(r) for r in self.riders.values()],
            "music": asdict(self.music),
        }

    async def broadcast(self, payload: dict, exclude_rider_id: Optional[str] = None):
        dead: List[str] = []
        for rider_id, ws in list(self.sockets.items()):
            if exclude_rider_id and rider_id == exclude_rider_id:
                continue
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(rider_id)
        # Cleanup any sockets that errored during broadcast.
        for rid in dead:
            self.sockets.pop(rid, None)
            self.riders.pop(rid, None)


# In-memory store. Keyed by uppercase 4-char ride code.
RIDE_ROOMS: Dict[str, RideRoom] = {}
ROOMS_LOCK = asyncio.Lock()


def _generate_code() -> str:
    # No vowels and no easily-confused chars (0/O, 1/I/L).
    alphabet = "BCDFGHJKMNPQRSTVWXYZ23456789"
    return "".join(random.choices(alphabet, k=4))


async def _get_or_create_room(code: str) -> RideRoom:
    code = code.upper()
    async with ROOMS_LOCK:
        room = RIDE_ROOMS.get(code)
        if room is None:
            room = RideRoom(code=code)
            RIDE_ROOMS[code] = room
        return room


# ----- REST endpoints -------------------------------------------------------


@api_router.get("/")
async def root():
    return {"message": "Velo Voice Pro backend", "active_rooms": len(RIDE_ROOMS)}


@api_router.post("/ride/create")
async def create_ride():
    """Returns a fresh ride code that's guaranteed unique against the current
    in-memory store. Clients then connect to /api/ride/ws/{code}."""
    async with ROOMS_LOCK:
        for _ in range(20):
            code = _generate_code()
            if code not in RIDE_ROOMS:
                RIDE_ROOMS[code] = RideRoom(code=code)
                logger.info("Created ride room %s", code)
                return {"code": code}
        raise HTTPException(503, "Failed to allocate a ride code; try again.")


@api_router.get("/ride/{code}")
async def get_ride(code: str):
    room = RIDE_ROOMS.get(code.upper())
    if room is None:
        raise HTTPException(404, "Ride not found")
    return room.public_state()


# ----- WebSocket relay ------------------------------------------------------


@app.websocket("/api/ride/ws/{code}")
async def ride_socket(
    websocket: WebSocket,
    code: str,
    name: str = Query(..., min_length=1, max_length=24),
    rider_id: str = Query(..., alias="id", min_length=1, max_length=64),
):
    code = code.upper()
    await websocket.accept()
    room = await _get_or_create_room(code)
    name = name.strip()[:24] or "Rider"

    rider = Rider(id=rider_id, name=name)
    async with room.lock:
        room.riders[rider_id] = rider
        room.sockets[rider_id] = websocket

        # Send initial state snapshot to the joiner.
        await websocket.send_text(
            json.dumps({"type": "state", **room.public_state()})
        )
        # Notify everyone else.
        await room.broadcast(
            {"type": "rider_joined", "rider": asdict(rider)},
            exclude_rider_id=rider_id,
        )

    logger.info("WS join code=%s rider=%s id=%s", code, name, rider_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = msg.get("type")
            if mtype == "speaking":
                on = bool(msg.get("on"))
                async with room.lock:
                    if rider_id in room.riders:
                        room.riders[rider_id].speaking = on
                    await room.broadcast(
                        {"type": "rider_speaking", "rider_id": rider_id, "on": on},
                        exclude_rider_id=rider_id,
                    )
            elif mtype == "music":
                action = msg.get("action")
                async with room.lock:
                    if action == "play":
                        room.music.playing = True
                    elif action == "pause":
                        room.music.playing = False
                    elif action == "skip_fwd":
                        room.music.trackIndex = (room.music.trackIndex + 1) % 1000
                    elif action == "skip_back":
                        room.music.trackIndex = max(0, room.music.trackIndex - 1)
                    elif action == "set_track":
                        idx = int(msg.get("trackIndex", 0))
                        room.music.trackIndex = max(0, idx)
                    await room.broadcast(
                        {
                            "type": "music",
                            "action": action,
                            "music": asdict(room.music),
                            "from": rider_id,
                        },
                        exclude_rider_id=rider_id,
                    )
            elif mtype == "music_volume":
                vol = int(msg.get("volume", 65))
                vol = max(0, min(100, vol))
                async with room.lock:
                    room.music.volume = vol
                    await room.broadcast(
                        {
                            "type": "music_volume",
                            "volume": vol,
                            "from": rider_id,
                        },
                        exclude_rider_id=rider_id,
                    )
            elif mtype == "rename":
                new_name = str(msg.get("name", "")).strip()[:24]
                if new_name:
                    async with room.lock:
                        if rider_id in room.riders:
                            room.riders[rider_id].name = new_name
                        await room.broadcast(
                            {
                                "type": "rider_renamed",
                                "rider_id": rider_id,
                                "name": new_name,
                            },
                            exclude_rider_id=rider_id,
                        )
            elif mtype == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif mtype in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
                # Direct peer-to-peer signalling forwarding. The server is a
                # dumb relay: it does not parse SDP / ICE, only routes the
                # blob to the addressed rider. `to` must be a rider_id.
                to_id = msg.get("to")
                if not to_id:
                    continue
                payload = {**msg, "from": rider_id}
                target_ws = room.sockets.get(to_id)
                if target_ws is not None:
                    try:
                        await target_ws.send_text(json.dumps(payload))
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning("WS error %s code=%s rider=%s: %s", type(e).__name__, code, rider_id, e)
    finally:
        async with room.lock:
            room.sockets.pop(rider_id, None)
            room.riders.pop(rider_id, None)
            await room.broadcast(
                {"type": "rider_left", "rider_id": rider_id},
            )
            # GC empty rooms.
            if not room.sockets:
                async with ROOMS_LOCK:
                    RIDE_ROOMS.pop(code, None)
        logger.info("WS leave code=%s rider=%s id=%s", code, name, rider_id)


# ----- Wire router + CORS ---------------------------------------------------


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
