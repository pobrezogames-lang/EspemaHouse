'use strict';

const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e5
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'Espema House Online', rooms: rooms.size }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function cleanText(value, max, fallback = '') {
  return String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max) || fallback;
}
function cleanCharacter(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}
function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    const bytes = crypto.randomBytes(6);
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
  } while (rooms.has(code));
  return code;
}
function getRoom(socket) {
  const id = socket.data.roomId;
  return id ? rooms.get(id) : null;
}
function roomPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    character: p.character,
    host: p.id === room.hostId,
    ready: !!p.ready
  }));
}
function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    private: !!room.passwordHash,
    status: room.status,
    maxPlayers: MAX_PLAYERS,
    players: roomPlayers(room)
  };
}
function updateRoom(room) {
  io.to(room.id).emit('room:update', publicRoom(room));
}
function publicRooms() {
  return [...rooms.values()]
    .filter(r => !r.passwordHash && r.status === 'waiting' && r.players.size < MAX_PLAYERS)
    .map(r => ({ id: r.id, name: r.name, players: r.players.size, maxPlayers: MAX_PLAYERS }));
}
function sendPlayers(room) {
  const list = [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    character: p.character,
    ...(p.state || {})
  }));
  io.to(room.id).emit('players:update', list);
}
function leaveCurrentRoom(socket) {
  const room = getRoom(socket);
  if (!room) {
    socket.data.roomId = null;
    return;
  }
  room.players.delete(socket.id);
  socket.leave(room.id);
  socket.data.roomId = null;

  if (room.players.size === 0) {
    rooms.delete(room.id);
    return;
  }
  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value;
  }
  updateRoom(room);
  sendPlayers(room);
}

io.on('connection', socket => {
  socket.data.roomId = null;

  socket.on('rooms:list', () => socket.emit('rooms:list', publicRooms()));

  socket.on('room:create', (raw, ack = () => {}) => {
    if (getRoom(socket)) leaveCurrentRoom(socket);
    const playerName = cleanText(raw && raw.playerName, 16, 'Player');
    const roomName = cleanText(raw && raw.roomName, 28, 'Espema House');
    const password = String((raw && raw.password) || '').slice(0, 32);
    const id = makeCode();
    const room = {
      id,
      name: roomName,
      passwordHash: password ? hashPassword(password) : null,
      hostId: socket.id,
      status: 'waiting',
      players: new Map()
    };
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      character: cleanCharacter(raw && raw.character),
      ready: true,
      state: null
    });
    rooms.set(id, room);
    socket.join(id);
    socket.data.roomId = id;
    ack({ ok: true, room: publicRoom(room) });
    updateRoom(room);
    io.emit('rooms:list', publicRooms());
  });

  socket.on('room:join', (raw, ack = () => {}) => {
    const id = cleanText(raw && raw.roomId, 6).toUpperCase();
    const room = rooms.get(id);
    if (!room) return ack({ ok: false, error: 'Room not found. Check the code.' });
    if (room.status !== 'waiting') return ack({ ok: false, error: 'This match has already started.' });
    if (room.players.size >= MAX_PLAYERS) return ack({ ok: false, error: 'This room is full (4 players maximum).' });
    const password = String((raw && raw.password) || '').slice(0, 32);
    if (room.passwordHash && hashPassword(password) !== room.passwordHash) {
      return ack({ ok: false, error: 'Incorrect room password.' });
    }
    if (getRoom(socket)) leaveCurrentRoom(socket);
    const playerName = cleanText(raw && raw.playerName, 16, 'Player');
    const duplicate = [...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase());
    const finalName = duplicate ? `${playerName.slice(0, 12)}_${room.players.size + 1}` : playerName;
    room.players.set(socket.id, {
      id: socket.id,
      name: finalName,
      character: cleanCharacter(raw && raw.character),
      ready: true,
      state: null
    });
    socket.join(id);
    socket.data.roomId = id;
    ack({ ok: true, room: publicRoom(room) });
    updateRoom(room);
    sendPlayers(room);
    io.emit('rooms:list', publicRooms());
  });

  socket.on('room:ready', (ready, ack = () => {}) => {
    const room = getRoom(socket);
    if (!room || room.status !== 'waiting') return ack({ ok: false, error: 'You are not in a waiting room.' });
    const player = room.players.get(socket.id);
    if (!player) return ack({ ok: false, error: 'Player not found in room.' });
    player.ready = !!ready;
    updateRoom(room);
    ack({ ok: true });
  });

  socket.on('room:start', (ack = () => {}) => {
    const room = getRoom(socket);
    if (!room) return ack({ ok: false, error: 'You are not in a room.' });
    if (room.hostId !== socket.id) return ack({ ok: false, error: 'Only the host can start the game.' });
    if (room.status !== 'waiting') return ack({ ok: false, error: 'The match already started.' });
    if ([...room.players.values()].some(p => !p.ready)) return ack({ ok: false, error: 'Wait for everyone to be ready.' });
    room.status = 'playing';
    const players = [...room.players.values()];
    players.forEach((p, index) => {
      io.to(p.id).emit('game:start', { playerIndex: index, roomId: room.id });
    });
    updateRoom(room);
    ack({ ok: true });
  });

  socket.on('game:world', snapshot => {
    const room = getRoom(socket);
    if (!room || room.status !== 'playing' || !snapshot || typeof snapshot !== 'object') return;
    // Relay only the small, known world-state payload; never trust client event names or room IDs.
    if (JSON.stringify(snapshot).length > 24000) return;
    socket.to(room.id).emit('world:update', snapshot);
  });

  socket.on('game:state', raw => {
    const room = getRoom(socket);
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !raw || typeof raw !== 'object') return;
    const number = (v, fallback = 0, min = -100, max = 100) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };
    player.state = {
      x: number(raw.x), y: number(raw.y, 0, -10, 60), z: number(raw.z),
      level: number(raw.level, 0, 0, 5), yaw: number(raw.yaw, 0, -1000, 1000),
      moving: !!raw.moving, crouch: !!raw.crouch, fast: !!raw.fast, hidden: !!raw.hidden
    };
    sendPlayers(room);
  });

  socket.on('room:leave', () => {
    leaveCurrentRoom(socket);
    io.emit('rooms:list', publicRooms());
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
    io.emit('rooms:list', publicRooms());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Espema House Online listening on ${PORT}`);
});
