import os
from typing import Any

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None


def persist_player(player: dict[str, str]) -> None:
    if not engine:
        return
    with engine.begin() as conn:
        conn.execute(text("INSERT IGNORE INTO players (id, display_name) VALUES (:id, :name)"), player)


def persist_room(room: dict[str, Any]) -> None:
    if not engine:
        return
    with engine.begin() as conn:
        conn.execute(text("INSERT IGNORE INTO rooms (code, game, host_player_id, status) VALUES (:code, :game, :host, :status)"), {
            "code": room["code"], "game": room["game"], "host": room["players"][0]["id"], "status": room["status"]
        })
