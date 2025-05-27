// backend/src/websocket/index.js
const CrashWebSocketHandlers = require('./crash.handlers');

function setupWebSocket(server) {
  const { Server } = require('socket.io');
  
  // Создаем Socket.IO сервер
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Основное подключение
  io.on('connection', (socket) => {
    console.log(`WebSocket: Пользователь подключился: ${socket.id}`);
    
    // Обработка отключения
    socket.on('disconnect', () => {
      console.log(`WebSocket: Пользователь отключился: ${socket.id}`);
    });
    
    // Базовые события для всех игр
    socket.on('join_game', (gameType) => {
      socket.join(`game_${gameType}`);
      console.log(`WebSocket: Пользователь ${socket.id} присоединился к игре ${gameType}`);
    });
    
    socket.on('leave_game', (gameType) => {
      socket.leave(`game_${gameType}`);
      console.log(`WebSocket: Пользователь ${socket.id} покинул игру ${gameType}`);
    });
  });
  
  // Инициализируем обработчики краш игры
  const crashHandlers = new CrashWebSocketHandlers(io);
  
  console.log('✅ WebSocket сервер настроен');
  console.log('🚀 Краш игра WebSocket обработчики настроены');
  
  return io;
}

module.exports = setupWebSocket;
