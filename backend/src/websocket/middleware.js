// backend/src/websocket/middleware.js
const { User } = require('../models');
const authService = require('../services/auth.service');

/**
 * Middleware для аутентификации WebSocket соединений в Telegram Mini App
 */
const authMiddleware = async (socket, next) => {
  try {
    // Получаем данные аутентификации из handshake
    const { telegramId, token, initData } = socket.handshake.auth || {};
    
    console.log(`🔒 WEBSOCKET AUTH: Попытка подключения с данными:`, {
      telegramId: telegramId || 'отсутствует',
      hasToken: !!token,
      hasInitData: !!initData
    });
    
    // Если есть Telegram initData, валидируем через auth service
    if (initData) {
      console.log('🔒 WEBSOCKET AUTH: Валидация через Telegram initData');
      
      const telegramData = authService.validateTelegramWebAppData(
        initData, 
        process.env.TELEGRAM_BOT_TOKEN
      );
      
      if (!telegramData) {
        console.error('🔒 WEBSOCKET AUTH: Невалидные Telegram данные');
        return next(new Error('Невалидные данные авторизации'));
      }
      
      // Получаем или создаем пользователя
      const user = await authService.getOrCreateUser(telegramData);
      
      if (user.isBlocked) {
        console.log(`🔒 WEBSOCKET AUTH: Пользователь ${user._id} заблокирован`);
        return next(new Error('Пользователь заблокирован'));
      }
      
      // Привязываем пользователя к сокету
      socket.userId = user._id;
      socket.telegramId = user.telegramId;
      socket.user = user;
      
      console.log(`✅ WEBSOCKET AUTH: Пользователь ${user.username || user.telegramId} аутентифицирован через initData`);
      return next();
    }
    
    // Если есть JWT токен, валидируем его
    if (token) {
      console.log('🔒 WEBSOCKET AUTH: Валидация через JWT токен');
      
      const decoded = authService.validateJWT(token);
      if (!decoded) {
        console.error('🔒 WEBSOCKET AUTH: Невалидный JWT токен');
        return next(new Error('Невалидный токен'));
      }
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        console.error('🔒 WEBSOCKET AUTH: Пользователь из токена не найден');
        return next(new Error('Пользователь не найден'));
      }
      
      if (user.isBlocked) {
        console.log(`🔒 WEBSOCKET AUTH: Пользователь ${user._id} заблокирован`);
        return next(new Error('Пользователь заблокирован'));
      }
      
      // Привязываем пользователя к сокету
      socket.userId = user._id;
      socket.telegramId = user.telegramId;
      socket.user = user;
      
      console.log(`✅ WEBSOCKET AUTH: Пользователь ${user.username || user.telegramId} аутентифицирован через JWT`);
      return next();
    }
    
    // Если есть только telegramId (legacy)
    if (telegramId) {
      console.log('🔒 WEBSOCKET AUTH: Валидация через Telegram ID (legacy)');
      
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
      socket.telegramId = user.telegramId;
      socket.user = user;
      
      console.log(`✅ WEBSOCKET AUTH: Пользователь ${user.username || user.telegramId} аутентифицирован через telegramId`);
      return next();
    }
    
    // Разрешаем подключение без аутентификации для общих событий
    console.log('⚠️ WEBSOCKET AUTH: Подключение без аутентификации (только для чтения)');
    socket.isGuest = true;
    next();
    
  } catch (error) {
    console.error('❌ WEBSOCKET AUTH: Ошибка аутентификации:', error);
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
