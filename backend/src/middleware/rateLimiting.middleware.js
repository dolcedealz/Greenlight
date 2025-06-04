// backend/src/middleware/rateLimiting.middleware.js
// Middleware для ограничения частоты запросов

/**
 * Простая реализация rate limiting без внешних зависимостей
 * В production рекомендуется использовать Redis для хранения счетчиков
 */

// В памяти храним информацию о запросах пользователей
const userRequests = new Map();

// Настройки лимитов для разных типов операций
const LIMITS = {
  betting: {
    windowMs: 60 * 1000, // 1 минута
    max: 10, // максимум 10 ставок в минуту
    message: 'Слишком много ставок. Подождите минуту перед следующей ставкой'
  },
  general: {
    windowMs: 60 * 1000, // 1 минута  
    max: 100, // максимум 100 запросов в минуту
    message: 'Слишком много запросов. Попробуйте позже'
  },
  admin: {
    windowMs: 60 * 1000, // 1 минута
    max: 50, // максимум 50 запросов в минуту для админов
    message: 'Слишком много административных операций'
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 попыток входа за 15 минут
    message: 'Слишком много попыток входа. Попробуйте через 15 минут'
  }
};

/**
 * Создает middleware для ограничения частоты запросов
 * @param {string} type - тип лимита (betting, general, admin, auth)
 * @returns {Function} Express middleware
 */
function createRateLimit(type = 'general') {
  const config = LIMITS[type] || LIMITS.general;
  
  return (req, res, next) => {
    try {
      // Определяем ключ для идентификации пользователя
      const key = getClientKey(req);
      
      // Получаем текущее время
      const now = Date.now();
      
      // Получаем данные о запросах этого пользователя
      let userInfo = userRequests.get(key);
      
      if (!userInfo) {
        // Первый запрос от этого пользователя
        userInfo = {
          count: 1,
          resetTime: now + config.windowMs,
          firstRequest: now
        };
        userRequests.set(key, userInfo);
        return next();
      }
      
      // Проверяем не истек ли период
      if (now > userInfo.resetTime) {
        // Период истек, сбрасываем счетчик
        userInfo.count = 1;
        userInfo.resetTime = now + config.windowMs;
        userInfo.firstRequest = now;
        userRequests.set(key, userInfo);
        return next();
      }
      
      // Увеличиваем счетчик
      userInfo.count++;
      
      // Проверяем не превышен ли лимит
      if (userInfo.count > config.max) {
        console.warn(`Rate limit exceeded for ${type}: ${key}, attempts: ${userInfo.count}`);
        
        return res.status(429).json({
          success: false,
          message: config.message,
          retryAfter: Math.ceil((userInfo.resetTime - now) / 1000),
          limit: config.max,
          current: userInfo.count
        });
      }
      
      // Добавляем заголовки с информацией о лимитах
      res.set({
        'X-RateLimit-Limit': config.max,
        'X-RateLimit-Remaining': Math.max(0, config.max - userInfo.count),
        'X-RateLimit-Reset': Math.ceil(userInfo.resetTime / 1000)
      });
      
      userRequests.set(key, userInfo);
      next();
      
    } catch (error) {
      console.error('Rate limiting error:', error);
      // В случае ошибки пропускаем запрос
      next();
    }
  };
}

/**
 * Получает ключ для идентификации клиента
 * @param {Object} req - Express request object
 * @returns {string} уникальный ключ клиента
 */
function getClientKey(req) {
  // Приоритет: telegram user ID > IP адрес
  if (req.user && req.user.telegramId) {
    return `telegram:${req.user.telegramId}`;
  }
  
  // Получаем IP адрес (учитываем прокси)
  const ip = req.ip || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress ||
             (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             'unknown';
             
  return `ip:${ip}`;
}

/**
 * Очистка старых записей из памяти (запускать периодически)
 */
function cleanupOldEntries() {
  const now = Date.now();
  const toDelete = [];
  
  for (const [key, userInfo] of userRequests.entries()) {
    // Удаляем записи старше 1 часа
    if (now - userInfo.firstRequest > 60 * 60 * 1000) {
      toDelete.push(key);
    }
  }
  
  toDelete.forEach(key => userRequests.delete(key));
  
  if (toDelete.length > 0) {
    console.log(`Rate limiting: Cleaned up ${toDelete.length} old entries`);
  }
}

// Запускаем очистку каждые 10 минут
setInterval(cleanupOldEntries, 10 * 60 * 1000);

// Экспортируем готовые middleware для разных случаев
module.exports = {
  createRateLimit,
  
  // Готовые middleware
  bettingLimit: createRateLimit('betting'),
  generalLimit: createRateLimit('general'),
  adminLimit: createRateLimit('admin'),
  authLimit: createRateLimit('auth'),
  
  // Утилиты
  cleanupOldEntries,
  getUserRequestsCount: () => userRequests.size
};