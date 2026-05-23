"""Velo Voice Pro backend tests — REST + WebSocket relay."""

import json
import os
import re
import uuid

import pytest
import requests
import websocket  # websocket-client

BASE_URL = "https://group-ride-audio.preview.emergentagent.com"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


# ----- /api/ root health -----
def test_root_health():
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "message" in data and "active_rooms" in data
    assert isinstance(data["active_rooms"], int)


# ----- /api/ride/create -----
class TestRideCreate:
    def test_create_returns_4char_code(self):
        r = requests.post(f"{BASE_URL}/api/ride/create", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "code" in data
        code = data["code"]
        # uppercase consonants/digits, no vowels and no 0/O/1/I/L
        assert re.fullmatch(r"[BCDFGHJKMNPQRSTVWXYZ23456789]{4}", code), code

    def test_create_codes_unique(self):
        codes = set()
        for _ in range(5):
            r = requests.post(f"{BASE_URL}/api/ride/create", timeout=10)
            assert r.status_code == 200
            codes.add(r.json()["code"])
        assert len(codes) == 5


# ----- /api/ride/{code} GET -----
class TestRideGet:
    def test_get_existing_ride(self):
        code = requests.post(f"{BASE_URL}/api/ride/create", timeout=10).json()["code"]
        r = requests.get(f"{BASE_URL}/api/ride/{code}", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == code
        assert data["riders"] == []
        assert "music" in data and "trackIndex" in data["music"]

    def test_get_unknown_ride_404(self):
        r = requests.get(f"{BASE_URL}/api/ride/ZZZZ", timeout=10)
        assert r.status_code == 404


# ----- WebSocket relay -----
class TestRideWebSocket:
    def _open(self, code, name, rid):
        url = f"{WS_BASE}/api/ride/ws/{code}?name={name}&id={rid}"
        ws = websocket.create_connection(url, timeout=10)
        return ws

    def test_two_riders_sync_presence_music_volume_speaking(self):
        code = requests.post(f"{BASE_URL}/api/ride/create", timeout=10).json()["code"]
        a_id = "TEST_A_" + uuid.uuid4().hex[:8]
        b_id = "TEST_B_" + uuid.uuid4().hex[:8]

        a = self._open(code, "Alice", a_id)
        # First message to A is its initial 'state'.
        msg_a_init = json.loads(a.recv())
        assert msg_a_init["type"] == "state"
        assert msg_a_init["code"] == code

        b = self._open(code, "Bob", b_id)
        msg_b_init = json.loads(b.recv())
        assert msg_b_init["type"] == "state"
        # B should already see A in initial state.
        rider_ids = {r["id"] for r in msg_b_init["riders"]}
        assert a_id in rider_ids

        # A should receive rider_joined for B.
        joined = json.loads(a.recv())
        assert joined["type"] == "rider_joined"
        assert joined["rider"]["id"] == b_id
        assert joined["rider"]["name"] == "Bob"

        # B sends music skip_fwd → A should receive 'music'.
        b.send(json.dumps({"type": "music", "action": "skip_fwd"}))
        ev = json.loads(a.recv())
        assert ev["type"] == "music"
        assert ev["action"] == "skip_fwd"
        assert ev["music"]["trackIndex"] == 1
        assert ev["from"] == b_id

        # A sends pause → B should receive.
        a.send(json.dumps({"type": "music", "action": "pause"}))
        ev = json.loads(b.recv())
        assert ev["type"] == "music"
        assert ev["music"]["playing"] is False

        # A sends volume.
        a.send(json.dumps({"type": "music_volume", "volume": 30}))
        ev = json.loads(b.recv())
        assert ev["type"] == "music_volume"
        assert ev["volume"] == 30

        # A sends speaking on.
        a.send(json.dumps({"type": "speaking", "on": True}))
        ev = json.loads(b.recv())
        assert ev["type"] == "rider_speaking"
        assert ev["on"] is True
        assert ev["rider_id"] == a_id

        # B leaves → A should receive rider_left.
        b.close()
        ev = json.loads(a.recv())
        assert ev["type"] == "rider_left"
        assert ev["rider_id"] == b_id

        a.close()

    def test_join_existing_code(self):
        # Create a ride and have rider join via the same code.
        code = requests.post(f"{BASE_URL}/api/ride/create", timeout=10).json()["code"]
        rid = "TEST_J_" + uuid.uuid4().hex[:8]
        ws = self._open(code, "Joiner", rid)
        msg = json.loads(ws.recv())
        assert msg["type"] == "state"
        assert msg["code"] == code
        ws.close()
