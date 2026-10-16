# Local Arcade

A local-network multiplayer game suite with three playable games: **Tic Tac Toe**, **Ludo**, and **Tower Defense**.

## Architecture

- **Frontend:** React + TypeScript + Vite (`frontend/`)
- **Backend:** FastAPI + WebSockets (`backend/`)
- **Database:** MySQL 8 schema and SQLAlchemy models (`backend/sql/schema.sql`)

The backend is the only service that talks to MySQL. Players connect to the frontend from devices on the same LAN; the frontend calls the backend REST/WebSocket API.

## Ports

| Service | Default port | Purpose |
|---|---:|---|
| Frontend | `5173` | Vite development server, bound to `0.0.0.0` |
| Backend | `8000` | FastAPI REST API and WebSocket server |
| MySQL | `3306` | Game metadata and match history |

## Requirements

- Node.js 20+
- Python 3.11+
- MySQL 8+

## Run locally

### 1. Database

Create a database and apply the schema:

```sql
CREATE DATABASE local_arcade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then run `backend/sql/schema.sql` using your MySQL client.

### 2. Backend

```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt

export DATABASE_URL='mysql+pymysql://arcade_user:arcade_password@127.0.0.1:3306/local_arcade'
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On Windows PowerShell use `$env:DATABASE_URL = '...'`.

### 3. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open `http://localhost:5173` on the host machine. Other LAN players should open:

```text
http://<HOST-LAN-IP>:5173
```

The frontend automatically derives the backend URL from the browser host. If you browse using a different hostname, set `VITE_API_URL` and `VITE_WS_URL` before starting Vite:

```bash
VITE_API_URL=http://192.168.1.10:8000 VITE_WS_URL=ws://192.168.1.10:8000 npm run dev -- --host 0.0.0.0
```

Allow inbound TCP ports `5173` and `8000` in the host firewall. You do not need Docker for this project.

## Multiplayer flow

1. Enter a display name and choose a game.
2. Create a room or join a room code shared by another player.
3. The browser opens a WebSocket at `/ws/{room_code}/{player_id}`.
4. Each action is broadcast to every player in the room. Match summaries are persisted by the backend when a match ends.

The current room manager is intentionally in-memory for a small LAN deployment. MySQL is ready for durable users, rooms, and match history; use the `matches` table when you add authentication or server restarts.

## API quick reference

- `GET /health` — backend and database health
- `GET /api/rooms?game=tictactoe` — list open rooms
- `POST /api/rooms` — create a room
- `POST /api/rooms/{code}/join` — join a room
- `WS /ws/{code}/{player_id}` — live game events

## Game notes

- **Tic Tac Toe:** two-player synchronized 3×3 game with rematch support.
- **Ludo:** 2–4 player pass-and-play online room with a shared turn, dice rolls, home lanes, and capture rules.
- **Tower Defense:** one player starts a run and other players join as co-defenders; waves are synchronized, players place towers, and the room can be restarted.

## Production-hardening ideas

- Replace in-memory rooms with Redis or a database-backed event store for multiple backend workers.
- Add authentication and player profiles.
- Add server-side rate limits and action validation for internet-facing deployments.
- Build the frontend with `npm run build`, then serve `frontend/dist` from your preferred web server.


## To run this app locally 
- **ENV FILE:** 
DATABASE_URL=mysql+pymysql://arcade_user:arcade_password@db:3306/local_arcade
MYSQL_DATABASE=local_arcade
MYSQL_USER=arcade_user
MYSQL_PASSWORD=arcade_password
MYSQL_RANDOM_ROOT_PASSWORD=yes 

- make a env file
- add this in that 
- make the env file in the same folder as docker compose file
