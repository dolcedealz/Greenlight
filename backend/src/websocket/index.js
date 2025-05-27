// backend/src/websocket/index.js
const CrashWebSocketHandlers = require('./crash.handlers');
const WebSocketHandlers = require('./handlers');
const { authMiddleware, loggingMiddleware, errorHandlingMiddleware } = require('./middleware');

function setupWebSocket(server) {
  const { Server } = require('socket.io');
  
  // Создаем Socket.IO сервер
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Настройки для лучшей производительности
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Применяем middleware
  io.use(loggingMiddleware);
  io.use(authMiddleware);
  io.use(errorHandlingMiddleware);
  
  // Основное подключение
  io.on('connection', (socket) => {
    console.log(`🔌 WebSocket: Пользователь подключился: ${socket.id}`);
    
    // Обработка отключения
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket: Пользователь отключился: ${socket.id}, причина: ${reason}`);
    });
    
    // Базовые события для всех игр
    socket.on('join_game', (gameType) => {
      try {
        if (['crash', 'coin', 'mines', 'slots'].includes(gameType)) {
          socket.join(`game_${gameType}`);
          console.log(`🔌 WebSocket: Пользователь ${socket.id} присоединился к игре ${gameType}`);
          socket.emit('joined_game', { gameType, success: true });
        } else {
          socket.emit('error', { message: 'Неизвестный тип игры' });
        }
      } catch (error) {
        console.error('🔌 WebSocket: Ошибка join_game:', error);
        socket.emit('error', { message: 'Ошибка присоединения к игре' });
      }
    });
    
    socket.on('leave_game', (gameType) => {
      try {
        socket.leave(`game_${gameType}`);
        console.log(`🔌 WebSocket: Пользователь ${socket.id} покинул игру ${gameType}`);
        socket.emit('left_game', { gameType, success: true });
      } catch (error) {
        console.error('🔌 WebSocket: Ошибка leave_game:', error);
        socket.emit('error', { message: 'Ошибка покидания игры' });
      }
    });

    // Пинг для проверки соединения
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });
  
  // Инициализируем основные обработчики
  const mainHandlers = new WebSocketHandlers(io);
  
  // Инициализируем обработчики краш игры
  const crashHandlers = new CrashWebSocketHandlers(io);
  
  // Добавляем методы для уведомлений к io объекту
  io.notifyUser = (userId, event, data) => {
    io.to(`user_${userId}`).emit(event, data);
  };

  io.notifyGameRoom = (gameType, event, data) => {
    io.to(`game_${gameType}`).emit(event, data);
  };

  io.broadcastToAll = (event, data) => {
    io.emit(event, data);
  };

  // Обработка глобальных ошибок Socket.IO
  io.engine.on('connection_error', (err) => {
    console.error('🔌 WebSocket: Ошибка подключения:', err.req);
    console.error('🔌 WebSocket: Код ошибки:', err.code);
    console.error('🔌 WebSocket: Сообщение ошибки:', err.message);
    console.error('🔌 WebSocket: Контекст ошибки:', err.context);
  });
  
  console.log('✅ WebSocket сервер настроен');
  console.log('🚀 Краш игра WebSocket обработчики настроены');
  console.log('🔌 Основные WebSocket обработчики настроены');
  
  return io;
}

module.exports = setupWebSocket;
