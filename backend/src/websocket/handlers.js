// backend/src/websocket/handlers.js
const { User } = require('../models');

class WebSocketHandlers {
  constructor(io) {
    this.io = io;
    this.setupEventListeners();
    console.log('🔌 WEBSOCKET: Основные обработчики инициализированы');
  }

  setupEventListeners() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 WEBSOCKET: Новое подключение: ${socket.id}`);
      
      this.setupSocketHandlers(socket);
    });
  }

  setupSocketHandlers(socket) {
    // Аутентификация пользователя через WebSocket
    socket.on('authenticate', async (data) => {
      try {
        const { telegramId } = data;
        
        if (telegramId) {
          const user = await User.findOne({ telegramId });
          if (user) {
            socket.userId = user._id;
            socket.join(`user_${user._id}`);
            socket.emit('authenticated', { success: true, userId: user._id });
            console.log(`🔌 WEBSOCKET: Пользователь ${user._id} аутентифицирован`);
          } else {
            socket.emit('authenticated', { success: false, message: 'Пользователь не найден' });
          }
        }
      } catch (error) {
        console.error('🔌 WEBSOCKET: Ошибка аутентификации:', error);
        socket.emit('authenticated', { success: false, message: 'Ошибка аутентификации' });
      }
    });

    // Присоединение к игровой комнате
    socket.on('join_game', (gameType) => {
      if (['crash', 'coin', 'mines', 'slots'].includes(gameType)) {
        socket.join(`game_${gameType}`);
        console.log(`🔌 WEBSOCKET: Пользователь ${socket.id} присоединился к игре ${gameType}`);
        socket.emit('joined_game', { gameType });
      } else {
        socket.emit('error', { message: 'Неизвестный тип игры' });
      }
    });

    // Покидание игровой комнаты
    socket.on('leave_game', (gameType) => {
      socket.leave(`game_${gameType}`);
      console.log(`🔌 WEBSOCKET: Пользователь ${socket.id} покинул игру ${gameType}`);
      socket.emit('left_game', { gameType });
    });

    // Пинг для проверки соединения
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Обработка отключения
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WEBSOCKET: Пользователь ${socket.id} отключился. Причина: ${reason}`);
      
      // Очистка данных пользователя
      if (socket.userId) {
        socket.leave(`user_${socket.userId}`);
      }
    });

    // Обработка ошибок
    socket.on('error', (error) => {
      console.error(`🔌 WEBSOCKET: Ошибка сокета ${socket.id}:`, error);
    });
  }

  // Метод для отправки уведомления конкретному пользователю
  notifyUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Метод для отправки уведомления в игровую комнату
  notifyGameRoom(gameType, event, data) {
    this.io.to(`game_${gameType}`).emit(event, data);
  }

  // Метод для широковещательного уведомления
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = WebSocketHandlers;
