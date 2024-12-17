const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

let rooms = {};

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is online');
})

app.post('/api/create-room', (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8);
  rooms[roomId] = { players: [], word: '' };
  res.json({ roomId });
  console.log('Rooms:', rooms);
});

app.post('/api/room-exists', (req, res) => {
  const { roomId } = req.body;
  res.json({ exists: !!rooms[roomId] });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      socket.emit('error_message', 'Room not found.');
      return;
    }

    let playersList = rooms[roomId].players;
    const playerExists = playersList.some((player) => player.name === playerName);

    if (playerExists) {
      socket.emit('error_message', 'Player already exists.');
      console.log("player already exists),room:", rooms[roomId].players);
      return;
    }

    rooms[roomId].players.push({ id: socket.id, name: playerName, drawer: false });
    socket.join(roomId);

    io.to(roomId).emit('update_players', rooms[roomId].players);
  });

  socket.on('start_game', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach((player) => (player.drawer = false));
    const randomDrawerIndex = Math.floor(Math.random() * room.players.length);
    room.players[randomDrawerIndex].drawer = true;

    io.to(roomId).emit('start_game', room.players[randomDrawerIndex]);
    io.to(roomId).emit('update_players', room.players);
  });

  socket.on('draw_incremental', ({ roomId, drawingData }) => {
    socket.to(roomId).emit('draw_incremental', drawingData);
  });

  socket.on('clear_canvas', (roomId) => {
    socket.to(roomId).emit('clear_canvas');
  });

  // read comments from frontend 
  socket.on("comment", (roomId, socketId, comment) => {
    const player = rooms[roomId]?.players?.find((player) => player.id === socketId);
    console.log("player:", player);
    io.to(roomId).emit("comment", player, comment);
  })

  socket.on("word_selected", (word, roomId) => {
    rooms[roomId].word = word;
    io.to(roomId).emit("word_selected", word);
  })

  socket.on('round_over', (roomId, socketId) => {
    const winnerPLayer = rooms[roomId]?.players?.find((player) => player.id === socketId);
    io.to(roomId).emit('round_over', winnerPLayer);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(
        (player) => player.id !== socket.id
      );
      io.to(roomId).emit('update_players', rooms[roomId].players);
    }
  });

});

server.listen(5000, () => {
  console.log('Server is running!');
});
