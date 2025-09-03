// server.js (пример)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Игровая логика
let players = {};
let bullets = [];

io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);
  
  socket.on('new player', (username) => {
    players[socket.id] = {
      id: socket.id,
      username: username,
      x: Math.random() * 500,
      y: Math.random() * 500,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      score: 0
    };
    
    io.emit('players update', players);
    io.emit('chat message', {
      username: 'Система',
      message: `${username} присоединился к игре!`
    });
  });
  
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x += data.x * 5;
      players[socket.id].y += data.y * 5;
      io.emit('players update', players);
    }
  });
  
  socket.on('shoot', (data) => {
    const player = players[socket.id];
    if (player) {
      const bullet = {
        id: Math.random().toString(36).substr(2, 9),
        x: player.x,
        y: player.y,
        angle: data.angle,
        speed: 10,
        playerId: socket.id
      };
      bullets.push(bullet);
    }
  });
  
  socket.on('chat message', (message) => {
    const player = players[socket.id];
    if (player) {
      io.emit('chat message', {
        username: player.username,
        message: message
      });
    }
  });
  
  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player) {
      io.emit('chat message', {
        username: 'Система',
        message: `${player.username} покинул игру.`
      });
      delete players[socket.id];
      io.emit('players update', players);
    }
  });
});

// Игровой цикл сервера
setInterval(() => {
  // Обновление позиций пуль
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += Math.cos(bullet.angle) * bullet.speed;
    bullet.y += Math.sin(bullet.angle) * bullet.speed;
    
    // Проверка столкновений
    for (const id in players) {
      const player = players[id];
      if (player.id !== bullet.playerId) {
        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 20) {
          // Попадание!
          players[bullet.playerId].score += 1;
          io.emit('score update', {
            playerId: bullet.playerId,
            score: players[bullet.playerId].score
          });
          
          io.emit('player hit', {
            playerId: id,
            shooterName: players[bullet.playerId].username
          });
          
          // Удаляем пулю
          bullets.splice(i, 1);
          break;
        }
      }
    }
    
    // Удаляем пули, вылетевшие за границы
    if (bullet.x < 0 || bullet.x > 2000 || bullet.y < 0 || bullet.y > 2000) {
      bullets.splice(i, 1);
    }
  }
  
  io.emit('bullets update', bullets);
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});