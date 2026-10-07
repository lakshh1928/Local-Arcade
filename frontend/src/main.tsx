import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Gamepad2, Users, Radio, Copy, ArrowRight, RotateCcw, Shield, Dice5, Grid3X3 } from 'lucide-react'
import './styles.css'

type GameId = 'tictactoe' | 'ludo' | 'tower-defense'
type Player = { id: string; name: string }
type Room = { code: string; game: GameId; game_name: string; players: Player[]; status: string }
type State = any

const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`
const WS = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000`
const games: { id: GameId; name: string; kicker: string; description: string; accent: string; icon: React.ReactNode }[] = [
  { id:'tictactoe', name:'Tic Tac Toe', kicker:'QUICK DUEL', description:'Classic 3 × 3. Read the room, make the line.', accent:'coral', icon:<Grid3X3/> },
  { id:'ludo', name:'Ludo', kicker:'TABLETOP RUSH', description:'Roll, race, capture. Up to four players.', accent:'lime', icon:<Dice5/> },
  { id:'tower-defense', name:'Tower Defense', kicker:'CO-OP PROTOCOL', description:'Place pulse towers and hold the base together.', accent:'violet', icon:<Shield/> },
]

function App() {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<GameId>('tictactoe')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [state, setState] = useState<State>(null)
  const [error, setError] = useState('')
  const socket = useRef<WebSocket | null>(null)

  const enterRoom = (data: any) => { setRoom(data.room); setPlayer(data.player); connect(data.room.code, data.player.id) }
  const connect = (code: string, playerId: string) => {
    const ws = new WebSocket(`${WS}/ws/${code}/${playerId}`)
    socket.current = ws
    ws.onmessage = e => { const message = JSON.parse(e.data); if (message.type === 'room_state') { setRoom(message.room); setState(message.state) } if (message.type === 'error') setError(message.message) }
    ws.onerror = () => setError('Could not connect to the game server. Check port 8000.')
  }
  const create = async () => {
    if (!name.trim()) return setError('Enter a display name first.')
    const res = await fetch(`${API}/api/rooms`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ game:selected, display_name:name }) })
    if (!res.ok) return setError('Could not create room.')
    enterRoom(await res.json())
  }
  const join = async () => {
    if (!name.trim() || roomCode.length !== 6) return setError('Enter your name and a 6-character room code.')
    const res = await fetch(`${API}/api/rooms/${roomCode.toUpperCase()}/join`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ display_name:name }) })
    if (!res.ok) return setError((await res.json()).detail || 'Could not join room.')
    enterRoom(await res.json())
  }
  const send = (action: any) => socket.current?.send(JSON.stringify(action))
  useEffect(() => () => socket.current?.close(), [])

  if (room && player && state) return <GameRoom room={room} player={player} state={state} send={send} onLeave={() => { socket.current?.close(); setRoom(null); setState(null) }} />
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Gamepad2 size={19}/></div><div><strong>LOCAL ARCADE</strong><span>LAN PLAY / 01</span></div></div><div className="live"><i/> LOCAL SERVER ONLINE</div></header>
    <section className="hero"><div className="eyebrow">THE NEIGHBORHOOD GAME ROOM</div><h1>PLAY LOUD.<br/><em>STAY LOCAL.</em></h1><p>Three multiplayer games, one shared room. Built for the people on your Wi-Fi.</p></section>
    <section className="setup-panel">
      <div className="step"><span>01</span><div><label>YOUR CALLSIGN</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. NEO" maxLength={40}/></div></div>
      <div className="step"><span>02</span><div><label>CHOOSE A GAME</label><div className="game-picker">{games.map(g=><button key={g.id} className={selected===g.id?'selected':''} onClick={()=>setSelected(g.id)}><span className={`game-icon ${g.accent}`}>{g.icon}</span><b>{g.name}</b><small>{g.kicker}</small></button>)}</div></div></div>
      <div className="room-actions"><button className="primary" onClick={create}>CREATE ROOM <ArrowRight size={17}/></button><div className="join-line"><input value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6}/><button onClick={join}>JOIN <ArrowRight size={15}/></button></div></div>
    </section>
    <section className="game-cards">{games.map(g=><article key={g.id} className={`game-card ${g.accent}`}><div className="card-top"><span>{g.kicker}</span><span>0{games.indexOf(g)+1}</span></div><div className="card-icon">{g.icon}</div><h2>{g.name}</h2><p>{g.description}</p></article>)}</section>
    {error && <div className="toast">{error}<button onClick={()=>setError('')}>×</button></div>}
    <footer><span><Radio size={14}/> SERVER: {API.replace(/^https?:\/\//,'')}</span><span>SHARE THE ROOM CODE. KEEP THE TRASH TALK LOCAL.</span></footer>
  </main>
}

function GameRoom({ room, player, state, send, onLeave }: { room:Room; player:Player; state:State; send:(a:any)=>void; onLeave:()=>void }) {
  const me = room.players.findIndex(p=>p.id===player.id)
  const game = games.find(g=>g.id===room.game)!
  const status = room.game==='tictactoe' ? (state.winner === null ? `${room.players[state.turn % 2]?.name || 'Waiting'}'s turn` : state.winner==='draw'?'DRAW GAME':`${room.players[state.winner]?.name} WINS`) : room.game==='ludo' ? (state.winner === null ? `${room.players[state.turn]?.name || 'Waiting'} rolls next` : `${room.players[state.winner]?.name} WINS`) : state.last_event
  return <main className="app-shell room-screen"><header className="topbar"><div className="brand"><div className="brand-mark"><Gamepad2 size={19}/></div><div><strong>LOCAL ARCADE</strong><span>ROOM / {room.code}</span></div></div><button className="ghost" onClick={onLeave}>LEAVE ROOM</button></header><div className="room-heading"><div><div className="eyebrow">{game.kicker} · {room.players.length} PLAYER{room.players.length===1?'':'S'}</div><h1>{game.name}</h1><p>{status}</p></div><button className="code-chip" onClick={()=>navigator.clipboard?.writeText(room.code)}><Copy size={15}/> {room.code}</button></div><div className="play-area">{room.game==='tictactoe' && <TicTacToe state={state} me={me} send={send}/>} {room.game==='ludo' && <Ludo state={state} room={room} me={me} send={send}/>} {room.game==='tower-defense' && <Tower state={state} send={send}/>}</div><div className="player-strip">{room.players.map((p,i)=><div className={i===me?'active':''} key={p.id}><span>{i+1}</span><b>{p.name}</b>{i===me&&<small>YOU</small>}</div>)}</div></main>
}
function TicTacToe({state, me, send}:{state:any;me:number;send:(a:any)=>void}) { return <div className="ttt-wrap"><div className="score-row"><span>PLAYER ONE <b>{state.scores[0]}</b></span><span>PLAYER TWO <b>{state.scores[1]}</b></span></div><div className="ttt-board">{state.board.map((cell:string|null,i:number)=><button key={i} className={cell?'filled':''} onClick={()=>send({type:'move',index:i})}>{cell}</button>)}</div><button className="secondary" onClick={()=>send({type:'reset'})}><RotateCcw size={15}/> NEW ROUND</button></div> }
function Ludo({state,room,me,send}:{state:any;room:Room;me:number;send:(a:any)=>void}) { const tracks=room.players.map((p,i)=>({p,i,token:state.tokens[p.id]||0})); return <div className="ludo-wrap"><div className="ludo-board">{tracks.map(({p,i,token})=><div className={`ludo-token token-${i}`} key={p.id} style={{left:`${6 + Math.min(token,57)/57*82}%`} as React.CSSProperties}><span>{p.name.slice(0,1).toUpperCase()}</span><small>{token}/57</small></div>)}<div className="finish">HOME<br/><b>◆</b></div></div><div className="ludo-controls"><div className="dice">{state.dice || '—'}</div><button className="primary" disabled={state.turn!==me || !room.players[1]} onClick={()=>send({type:'roll'})}>ROLL DICE <Dice5 size={17}/></button><p>Roll a six-sided die and race your token to HOME.</p></div></div> }
function Tower({state,send}:{state:any;send:(a:any)=>void}) { useEffect(()=>{ if(!state.running) return; const timer=window.setInterval(()=>send({type:'tick'}),1000); return()=>window.clearInterval(timer) },[state.running,send]); return <div className="tower-wrap"><div className="tower-stats"><div><small>WAVE</small><b>{state.wave}</b></div><div><small>BASE LIVES</small><b className={state.lives<8?'danger':''}>{state.lives}</b></div><div><small>GOLD</small><b>{state.gold}</b></div><div><small>SCORE</small><b>{state.score}</b></div></div><div className="tower-map"><div className="path"><span>ENTRY</span><i/><i/><i/><i/><i/><span>BASE</span></div>{state.enemies.map((e:any)=><div key={e.id} className="enemy" style={{left:`${e.progress*88+4}%`}}/>)}{state.towers.map((t:any)=><div key={t.slot} className={`tower placed slot-${t.slot}`}><Shield size={19}/></div>)}{Array.from({length:8},(_,i)=><button key={i} className="tower-slot" onClick={()=>send({type:'place_tower',slot:i})} title="Place tower">+</button>)}</div><div className="tower-actions"><button className="primary" onClick={()=>send({type:'start'})}>{state.running?'WAVE ACTIVE':'START / RESUME WAVE'} <ArrowRight size={17}/></button><button className="secondary" onClick={()=>send({type:'reset'})}><RotateCcw size={15}/> RESET</button><small>{state.last_event}</small></div></div> }

createRoot(document.getElementById('root')!).render(<App />)
