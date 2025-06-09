// backend/src/middleware/auth.middleware.js - ВЕРСИЯ С ОПТИМИЗИРОВАННЫМ ЛОГИРОВАНИЕМ
const { User } = require('../models');
const mongoose = require('mongoose');

/**
 * Middleware для проверки аутентификации Telegram WebApp
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
async function telegramAuthMiddleware(req, res, next) {
  try {
    console.log('AUTH: Проверка аутентификации для:', req.method, req.originalUrl);
    console.log('AUTH: Заголовки запроса:', {
      'telegram-data': req.headers['telegram-data'] ? 'ПРИСУТСТВУЕТ' : 'ОТСУТСТВУЕТ',
      'user-agent': req.headers['user-agent'],
      'origin': req.headers['origin'],
      'referer': req.headers['referer']
    });
    
    // Получаем данные инициализации из заголовка
    const initData = req.headers['telegram-data'];
    
    if (!initData) {
      console.log('AUTH: Отсутствуют данные аутентификации');
      console.log('AUTH: Доступные заголовки:', Object.keys(req.headers));
      return res.status(401).json({
        success: false,
        message: 'Отсутствуют данные аутентификации'
      });
    }
    
    const telegramAuth = require('../utils/telegram-auth');
    
    console.log('AUTH: Длина initData:', initData.length);
    console.log('AUTH: Первые 100 символов initData:', initData.substring(0, 100));
    
    // Верифицируем Telegram данные криптографически
    const verificationResult = process.env.NODE_ENV === 'development' 
      ? telegramAuth.devVerifyTelegramData(initData)
      : telegramAuth.verifyTelegramData(initData);
    
    if (!verificationResult.isValid) {
      console.error('AUTH: Верификация не пройдена:', verificationResult.error);
      console.error('AUTH: NODE_ENV:', process.env.NODE_ENV);
      console.error('AUTH: BOT_TOKEN доступен:', !!process.env.BOT_TOKEN);
      return res.status(401).json({
        success: false,
        message: 'Данные аутентификации не прошли верификацию',
        debug: process.env.NODE_ENV === 'development' ? verificationResult.error : undefined
      });
    }
    
    const { userData } = verificationResult;
    const telegramUser = userData.user;
    const telegramId = telegramUser?.id;
    
    if (!telegramId) {
      console.log('AUTH: Идентификатор пользователя не найден в верифицированных данных');
      return res.status(401).json({
        success: false,
        message: 'Идентификатор пользователя не найден'
      });
    }
    
    console.log(`AUTH: TelegramId верифицирован: ${telegramId}`);
    
    // Находим пользователя по Telegram ID
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log(`AUTH: Создание нового пользователя ${telegramId}`);
      
      try {
        const { userService } = require('../services');
        user = await userService.createOrUpdateUser(telegramUser);
        console.log(`AUTH: Новый пользователь создан: ${user._id}`);
      } catch (createError) {
        console.error('AUTH: Ошибка создания пользователя:', createError);
        return res.status(500).json({
          success: false,
          message: 'Ошибка создания пользователя'
        });
      }
    } else {
      console.log(`AUTH: Пользователь найден: ${user._id}, баланс: ${user.balance} USDT`);
    }
    
    if (user.isBlocked) {
      console.log(`AUTH: Пользователь ${user._id} заблокирован`);
      return res.status(403).json({
        success: false,
        message: 'Ваш аккаунт заблокирован'
      });
    }
    
    // Обновляем время последней активности
    user.lastActivity = new Date();
    await user.save();
    
    // Сохраняем пользователя в запросе с дополнительными полями для дуэлей
    req.user = {
      ...user.toObject(),
      id: user._id.toString(), // Для совместимости с дуэлями
      username: telegramUser.username || user.username
    };
    
    console.log(`AUTH: Аутентификация успешна для ${user._id}`);
    
    next();
  } catch (error) {
    console.error('AUTH: Ошибка сервера при аутентификации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при аутентификации'
    });
  }
}

/**
 * Middleware для проверки роли администратора
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function adminAuthMiddleware(req, res, next) {
  console.log('ADMIN AUTH: Проверка прав администратора для:', req.method, req.originalUrl);
  
  // Проверяем Bearer токен
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('ADMIN AUTH: Проверка токена');
    
    // Получаем ожидаемый токен из переменных окружения
    const expectedToken = process.env.ADMIN_API_TOKEN;
    
    if (!expectedToken) {
      console.error('ADMIN AUTH: ADMIN_API_TOKEN не установлен!');
      return res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации сервера: отсутствует ADMIN_API_TOKEN'
      });
    }
    
    // Сравниваем токены
    if (token === expectedToken) {
      console.log('ADMIN AUTH: Токен верный, создаем виртуального админа');
      
      // Создаем валидный ObjectId для системного админа
      const systemAdminId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
      
      // Создаем виртуального админ-пользователя с валидным ObjectId
      req.user = {
        _id: systemAdminId,
        id: systemAdminId.toString(), // Добавляем string версию для совместимости
        role: 'admin',
        isAdmin: true,
        firstName: 'Admin',
        lastName: 'System',
        telegramId: 999999999
      };
      
      console.log('ADMIN AUTH: Создан виртуальный админ');
      return next();
    } else {
      console.log('ADMIN AUTH: Неверный токен');
      return res.status(403).json({
        success: false,
        message: 'Неверный токен администратора'
      });
    }
  }
  
  // Если нет Bearer токена, проверяем обычную аутентификацию
  if (!req.user) {
    console.log('ADMIN AUTH: Пользователь не аутентифицирован');
    return res.status(401).json({
      success: false,
      message: 'Не аутентифицировано'
    });
  }
  
  if (req.user.role !== 'admin' && !req.user.isAdmin) {
    console.log('ADMIN AUTH: Пользователь не является администратором');
    return res.status(403).json({
      success: false,
      message: 'Доступ запрещен'
    });
  }
  
  console.log('ADMIN AUTH: Проверка прав администратора успешна');
  next();
}

/**
 * Универсальный middleware - поддерживает WebApp и Bot аутентификацию
 */
async function universalAuthMiddleware(req, res, next) {
  try {
    console.log('UNIVERSAL AUTH: Проверка аутентификации для:', req.method, req.originalUrl);
    
    // Проверяем есть ли WebApp данные
    const initData = req.headers['telegram-data'];
    
    if (initData) {
      console.log('UNIVERSAL AUTH: Используем WebApp аутентификацию');
      return telegramAuthMiddleware(req, res, next);
    }
    
    // Проверяем Bot токен
    const botToken = req.headers['authorization'];
    const userIdFromHeaders = req.headers['x-telegram-user-id'];
    const usernameFromHeaders = req.headers['x-telegram-username'];
    
    if (botToken && botToken.startsWith('Bot ') && userIdFromHeaders) {
      const token = botToken.substring(4);
      const expectedToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
      
      console.log(`UNIVERSAL AUTH: Проверка Bot токена для пользователя ${userIdFromHeaders}`);
      
      if (token === expectedToken) {
        // Ищем пользователя по ID
        let user = await User.findOne({ telegramId: parseInt(userIdFromHeaders) });
        
        if (!user) {
          console.log(`UNIVERSAL AUTH: Создаем пользователя для ${userIdFromHeaders}`);
          const { userService } = require('../services');
          user = await userService.createOrUpdateUser({
            id: parseInt(userIdFromHeaders),
            username: usernameFromHeaders,
            first_name: req.headers['x-telegram-first-name'] || usernameFromHeaders
          });
        }
        
        // Устанавливаем req.user
        req.user = {
          ...user.toObject(),
          id: user._id.toString(),
          username: usernameFromHeaders || user.username
        };
        
        console.log(`UNIVERSAL AUTH: Bot аутентификация успешна для ${user._id}`);
        return next();
      } else {
        console.log('UNIVERSAL AUTH: Неверный Bot токен');
        return res.status(401).json({
          success: false,
          message: 'Неверный токен бота'
        });
      }
    }
    
    // Если ничего не подошло
    console.log('UNIVERSAL AUTH: Данные аутентификации не найдены');
    return res.status(401).json({
      success: false,
      message: 'Отсутствуют данные аутентификации'
    });
    
  } catch (error) {
    console.error('UNIVERSAL AUTH: Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
}

/**
 * Более мягкий middleware для дуэлей от Telegram бота
 */
async function duelAuthMiddleware(req, res, next) {
  try {
    console.log('DUEL AUTH: Проверка для дуэли:', req.method, req.originalUrl);
    console.log('DUEL AUTH: Headers received:', {
      authorization: req.headers.authorization ? 'PRESENT' : 'MISSING',
      'x-telegram-user-id': req.headers['x-telegram-user-id'],
      'x-telegram-username': req.headers['x-telegram-username'],
      'telegram-data': req.headers['telegram-data'] ? 'PRESENT' : 'MISSING'
    });
    console.log('DUEL AUTH: Query params:', req.query);
    console.log('DUEL AUTH: Body data:', req.body);
    
    // Сначала пытаемся стандартную аутентификацию
    const initData = req.headers['telegram-data'];
    
    if (initData) {
      // Используем стандартную аутентификацию
      return telegramAuthMiddleware(req, res, next);
    }
    
    // Если нет telegram-data, проверяем данные из body, URL или заголовков (для бота)
    const { challengerId, challengerUsername, userId, username } = req.body;
    const { userId: userIdFromQuery } = req.query;
    const userIdFromHeaders = req.headers['x-telegram-user-id'];
    const userIdFromBody = userId || challengerId || userIdFromQuery || userIdFromHeaders;
    const usernameFromBody = username || challengerUsername;
    
    console.log(`DUEL AUTH: Источники userId - body: ${userId}, challenger: ${challengerId}, query: ${userIdFromQuery}, headers: ${userIdFromHeaders}, final: ${userIdFromBody}`);
    
    // Проверяем заголовки от бота
    const botToken = req.headers['authorization'];
    if (botToken && botToken.startsWith('Bot ')) {
      const token = botToken.substring(4);
      const expectedToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
      
      console.log(`DUEL AUTH: Проверка Bot токена - получен: ${token ? 'ЕСТЬ' : 'НЕТ'}, ожидаемый: ${expectedToken ? 'ЕСТЬ' : 'НЕТ'}, userIdFromBody: ${userIdFromBody}`);
      
      if (token === expectedToken && userIdFromBody) {
        console.log(`DUEL AUTH: Аутентификация через bot token для пользователя ${userIdFromBody}`);
        
        // Ищем пользователя по ID
        let user = await User.findOne({ telegramId: parseInt(userIdFromBody) });
        
        if (!user) {
          console.log(`DUEL AUTH: Пользователь ${userIdFromBody} не найден`);
          return res.status(401).json({
            success: false,
            message: 'Пользователь не зарегистрирован в системе'
          });
          // БЕЗОПАСНОСТЬ: Не создаем пользователей без верификации Telegram
        }
        
        // Устанавливаем req.user
        req.user = {
          ...user.toObject(),
          id: user._id.toString(),
          username: usernameFromBody || user.username
        };
        
        console.log(`DUEL AUTH: Bot аутентификация успешна для ${user._id}, telegramId: ${user.telegramId}`);
        console.log(`DUEL AUTH: Final req.user object:`, {
          id: req.user.id,
          telegramId: req.user.telegramId,
          username: req.user.username,
          _id: req.user._id
        });
        return next();
      }
    }
    
    if (userIdFromBody && usernameFromBody) {
      console.log(`DUEL AUTH: Используем данные из запроса: ${userIdFromBody}`);
      
      // Ищем пользователя по ID
      let user = await User.findOne({ telegramId: parseInt(userIdFromBody) });
      
      if (!user) {
        console.log(`DUEL AUTH: Создаем временного пользователя для ${userIdFromBody}`);
        // Создаем временного пользователя для дуэли
        const { userService } = require('../services');
        user = await userService.createOrUpdateUser({
          id: parseInt(userIdFromBody),
          username: usernameFromBody,
          first_name: usernameFromBody
        });
      }
      
      // Устанавливаем req.user
      req.user = {
        ...user.toObject(),
        id: user._id.toString(),
        username: usernameFromBody
      };
      
      console.log(`DUEL AUTH: Временная аутентификация для дуэли успешна`);
      console.log(`DUEL AUTH: Fallback req.user object:`, {
        id: req.user.id,
        telegramId: req.user.telegramId,
        username: req.user.username,
        _id: req.user._id
      });
      return next();
    }
    
    // Если ничего не помогло
    console.log('DUEL AUTH: Данные аутентификации не найдены');
    return res.status(401).json({
      success: false,
      message: 'Отсутствуют данные аутентификации'
    });
    
  } catch (error) {
    console.error('DUEL AUTH: Ошибка:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
}

module.exports = {
  telegramAuthMiddleware,
  universalAuthMiddleware,
  adminAuthMiddleware,
  duelAuthMiddleware,
  // Алиасы для обратной совместимости
  authenticateToken: telegramAuthMiddleware,
  authMiddleware: telegramAuthMiddleware,
  isAdmin: adminAuthMiddleware
};
