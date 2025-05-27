// backend/src/websocket/middleware.js
const { User } = require('../models');

/**
 * Middleware для аутентификации WebSocket соединений
 */
const authMiddleware = async (socket, next) => {
  try {
    // Получаем данные аутентификации из handshake
    const { telegramId, token } = socket.handshake.auth || {};
    
    if (!telegramId && !token) {
      // Разрешаем подключение без аутентификации
      // Аутентификация может быть выполнена позже через событие 'authenticate'
      console.log('🔒 WEBSOCKET AUTH: Подключение без аутентификации разрешено');
      return next();
    }
    
    if (telegramId) {
      // Поиск пользователя по Telegram ID
      const user = await User.findOne({ telegramId });
      
      if (!user) {
        console.log(`🔒 WEBSOCKET AUTH: Пользователь с Telegram ID ${telegramId} не найден`);
        return next(new Error('Пользователь не найден'));
      }
      
      if (user.isBlocked) {
        console.log(`🔒 WEBSOCKET AUTH: Пользователь ${user._id} заблокирован`);
        return next(new Error('Пользователь заблокирован'));
      }
      
      // Привязываем пользователя к сокету
      socket.userId = user._id;
      socket.user = user;
      
      // Обновляем последнюю активность
      user.lastActivity = new Date();
      await user.save();
      
      console.log(`🔒 WEBSOCKET AUTH: Пользователь ${user._id} аутентифицирован`);
    }
    
    next();
    
  } catch (error) {
    console.error('🔒 WEBSOCKET AUTH: Ошибка аутентификации:', error);
    next(new Error('Ошибка аутентификации'));
  }
};

/**
 * Middleware для ограничения скорости (rate limiting)
 */
const rateLimitMiddleware = (socket, next) => {
  // Инициализируем счетчик событий для сокета
  if (!socket.eventCounts) {
    socket.eventCounts = new Map();
  }
  
  // Очищаем счетчики каждую минуту
  const interval = setInterval(() => {
    if (socket.eventCounts) {
      socket.eventCounts.clear();
    }
  }, 60000);
  
  // Очищаем интервал при отключении
  socket.on('disconnect', () => {
    clearInterval(interval);
  });
  
  next();
};

/**
 * Middleware для логирования подключений
 */
const loggingMiddleware = (socket, next) => {
  const startTime = Date.now();
  const clientIP = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'];
  
  console.log(`📊 WEBSOCKET LOG: Новое подключение ${socket.id} с IP ${clientIP}`);
  
  // Логируем отключение
  socket.on('disconnect', (reason) => {
    const duration = Date.now() - startTime;
    console.log(`📊 WEBSOCKET LOG: Отключение ${socket.id} после ${duration}мс. Причина: ${reason}`);
  });
  
  next();
};

/**
 * Middleware для обработки ошибок
 */
const errorHandlingMiddleware = (socket, next) => {
  socket.on('error', (error) => {
    console.error(`❌ WEBSOCKET ERROR: Ошибка сокета ${socket.id}:`, error);
  });
  
  next();
};

/**
 * Функция для проверки ограничений событий
 */
const checkEventLimit = (socket, eventName, limit = 30) => {
  if (!socket.eventCounts) {
    socket.eventCounts = new Map();
  }
  
  const currentCount = socket.eventCounts.get(eventName) || 0;
  
  if (currentCount >= limit) {
    console.warn(`⚠️ WEBSOCKET LIMIT: Превышен лимит событий ${eventName} для сокета ${socket.id}`);
    return false;
  }
  
  socket.eventCounts.set(eventName, currentCount + 1);
  return true;
};

/**
 * Middleware для проверки прав доступа к игре
 */
const gameAccessMiddleware = (gameType) => {
  return (socket, next) => {
    // Проверяем, что игра доступна
    const availableGames = ['crash', 'coin', 'mines', 'slots'];
    
    if (!availableGames.includes(gameType)) {
      return next(new Error('Игра недоступна'));
    }
    
    // Дополнительные проверки можно добавить здесь
    // Например, проверка на активность пользователя, блокировки и т.д.
    
    next();
  };
};

module.exports = {
  authMiddleware,
  rateLimitMiddleware,
  loggingMiddleware,
  errorHandlingMiddleware,
  gameAccessMiddleware,
  checkEventLimit
};
