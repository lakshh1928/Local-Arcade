from __future__ import annotations

import json
import os
import random
import string
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .db import persist_player, persist_room

app = FastAPI(title="Local Arcade API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: dict[str, dict[str, Any]] = {}
connections: dict[str, list[WebSocket]] = {}

GAME_NAMES = {"tictactoe": "Tic Tac Toe", "ludo": "Ludo", "tower-defense": "Tower Defense"}

class CreateRoomRequest(BaseModel):
    game: str
    display_name: str = Field(min_length=1, max_length=40)

class JoinRoomRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)


def code() -> str:
    while True:
        value = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if value not in rooms:
            return value


def player(name: str) -> dict[str, str]:
    return {"id": str(uuid.uuid4()), "name": name.strip()}


def initial_state(game: str) -> dict[str, Any]:
    if game == "tictactoe":
        return {"board": [None] * 9, "turn": 0, "winner": None, "scores": [0, 0]}
    if game == "ludo":
        return {"turn": 0, "dice": None, "winner": None, "tokens": {}, "positions": {}}
    return {
        "wave": 1, "gold": 420, "lives": 20, "score": 0, "running": False,
        "enemies": [], "towers": [], "next_enemy_id": 1, "last_event": "Ready for deployment.",
    }


def public_room(room: dict[str, Any]) -> dict[str, Any]:
    return {"code": room["code"], "game": room["game"], "game_name": GAME_NAMES[room["game"]], "players": room["players"], "status": room["status"]}

async def broadcast(room_code: str, message: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for socket in connections.get(room_code, []):
        try:
            await socket.send_json(message)
        except Exception:
            dead.append(socket)
    for socket in dead:
        connections[room_code].remove(socket)


def apply_action(room: dict[str, Any], player_id: str, action: dict[str, Any]) -> None:
    state = room["state"]
    game = room["game"]
    kind = action.get("type")
    player_index = next((i for i, p in enumerate(room["players"]) if p["id"] == player_id), -1)
    if player_index < 0:
        raise ValueError("Player is not in this room")

    if game == "tictactoe":
        if kind == "reset":
            room["state"] = initial_state(game)
            return
        index = int(action.get("index", -1))
        if state["winner"] is not None or state["turn"] % 2 != player_index or index not in range(9) or state["board"][index] is not None:
            return
        state["board"][index] = "X" if player_index == 0 else "O"
        state["turn"] += 1
        lines = [(0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6)]
        for a, b, c in lines:
            if state["board"][a] and state["board"][a] == state["board"][b] == state["board"][c]:
                state["winner"] = player_index
                state["scores"][player_index] += 1
        if state["winner"] is None and state["turn"] == 9:
            state["winner"] = "draw"
    elif game == "ludo":
        if kind == "roll" and state["winner"] is None and state["turn"] == player_index:
            roll = random.randint(1, 6)
            state["dice"] = roll
            state["tokens"].setdefault(player_id, 0)
            state["tokens"][player_id] = min(57, state["tokens"][player_id] + roll)
            state["turn"] = (state["turn"] + 1) % max(2, len(room["players"]))
            if state["tokens"][player_id] >= 57:
                state["winner"] = player_index
    else:
        if kind == "start":
            state["running"] = True
            state["last_event"] = f"{room['players'][player_index]['name']} started wave {state['wave']}."
        elif kind == "place_tower" and state["gold"] >= 100:
            slot = int(action.get("slot", -1))
            if slot in range(8) and slot not in [t["slot"] for t in state["towers"]]:
                state["towers"].append({"slot": slot, "level": 1, "owner": player_id})
                state["gold"] -= 100
                state["last_event"] = f"{room['players'][player_index]['name']} placed a pulse tower."
        elif kind == "tick" and state["running"]:
            for enemy in state["enemies"]:
                enemy["progress"] += 0.08
            defeated = [e for e in state["enemies"] if e["progress"] >= 1]
            state["enemies"] = [e for e in state["enemies"] if e["progress"] < 1]
            if defeated:
                state["lives"] -= len(defeated)
                state["last_event"] = f"{len(defeated)} intruder(s) slipped through."
            if len(state["enemies"]) < 3 + state["wave"] // 2:
                state["enemies"].append({"id": state["next_enemy_id"], "progress": 0, "hp": 100})
                state["next_enemy_id"] += 1
            for tower in state["towers"]:
                target = next(iter(state["enemies"]), None)
                if target:
                    target["hp"] -= 28 * tower["level"]
                    if target["hp"] <= 0:
                        state["score"] += 25
                        state["gold"] += 30
                        state["enemies"].remove(target)
            if state["score"] and state["score"] % 250 == 0:
                state["wave"] += 1
            if state["lives"] <= 0:
                state["running"] = False
                state["last_event"] = "Base lost. Restart to deploy again."
        elif kind == "reset":
            room["state"] = initial_state(game)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "local-arcade-backend", "database": "configured" if os.getenv("DATABASE_URL") else "not-configured"}

@app.get("/api/rooms")
def list_rooms(game: str | None = None) -> list[dict[str, Any]]:
    return [public_room(r) for r in rooms.values() if r["status"] == "open" and (game is None or r["game"] == game)]

@app.post("/api/rooms")
def create_room(payload: CreateRoomRequest) -> dict[str, Any]:
    if payload.game not in GAME_NAMES:
        raise HTTPException(400, "Unsupported game")
    p = player(payload.display_name)
    room_code = code()
    rooms[room_code] = {"code": room_code, "game": payload.game, "players": [p], "status": "open", "state": initial_state(payload.game), "created_at": datetime.now(timezone.utc).isoformat()}
    persist_player(p)
    persist_room(rooms[room_code])
    return {"room": public_room(rooms[room_code]), "player": p}

@app.post("/api/rooms/{room_code}/join")
def join_room(room_code: str, payload: JoinRoomRequest) -> dict[str, Any]:
    room = rooms.get(room_code.upper())
    if not room or room["status"] != "open":
        raise HTTPException(404, "Room not found or already closed")
    if len(room["players"]) >= (4 if room["game"] == "ludo" else 2):
        raise HTTPException(409, "Room is full")
    p = player(payload.display_name)
    room["players"].append(p)
    persist_player(p)
    if room["game"] == "ludo":
        room["state"]["tokens"][p["id"]] = 0
    return {"room": public_room(room), "player": p}

@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str) -> None:
    room = rooms.get(room_code.upper())
    if not room or not any(p["id"] == player_id for p in room["players"]):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    connections.setdefault(room_code.upper(), []).append(websocket)
    await broadcast(room_code.upper(), {"type": "room_state", "room": public_room(room), "state": room["state"]})
    try:
        while True:
            action = await websocket.receive_json()
            try:
                apply_action(room, player_id, action)
                await broadcast(room_code.upper(), {"type": "room_state", "room": public_room(room), "state": room["state"], "event": action.get("type")})
            except (ValueError, KeyError, TypeError):
                await websocket.send_json({"type": "error", "message": "Invalid action"})
    except WebSocketDisconnect:
        if websocket in connections.get(room_code.upper(), []):
            connections[room_code.upper()].remove(websocket)
