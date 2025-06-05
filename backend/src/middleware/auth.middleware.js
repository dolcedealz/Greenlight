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
    
    // Получаем данные инициализации из заголовка
    const initData = req.headers['telegram-data'];
    
    if (!initData) {
      console.log('AUTH: Отсутствуют данные аутентификации');
      return res.status(401).json({
        success: false,
        message: 'Отсутствуют данные аутентификации'
      });
    }
    
    const telegramAuth = require('../utils/telegram-auth');
    
    // Верифицируем Telegram данные криптографически
    const verificationResult = process.env.NODE_ENV === 'development' 
      ? telegramAuth.devVerifyTelegramData(initData)
      : telegramAuth.verifyTelegramData(initData);
    
    if (!verificationResult.isValid) {
      console.error('AUTH: Верификация не пройдена:', verificationResult.error);
      return res.status(401).json({
        success: false,
        message: 'Данные аутентификации не прошли верификацию'
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
 * Более мягкий middleware для дуэлей от Telegram бота
 */
async function duelAuthMiddleware(req, res, next) {
  try {
    console.log('DUEL AUTH: Проверка для дуэли:', req.method, req.originalUrl);
    
    // Сначала пытаемся стандартную аутентификацию
    const initData = req.headers['telegram-data'];
    
    if (initData) {
      // Используем стандартную аутентификацию
      return telegramAuthMiddleware(req, res, next);
    }
    
    // Если нет telegram-data, проверяем данные из body или URL (для бота)
    const { challengerId, challengerUsername, userId, username } = req.body;
    const userIdFromBody = userId || challengerId;
    const usernameFromBody = username || challengerUsername;
    
    // Проверяем заголовки от бота
    const botToken = req.headers['authorization'];
    if (botToken && botToken.startsWith('Bot ')) {
      const token = botToken.substring(4);
      const expectedToken = process.env.BOT_TOKEN;
      
      if (token === expectedToken && userIdFromBody) {
        console.log(`DUEL AUTH: Аутентификация через bot token для пользователя ${userIdFromBody}`);
        
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
          username: usernameFromBody || user.username
        };
        
        console.log(`DUEL AUTH: Bot аутентификация успешна для ${user._id}`);
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
  adminAuthMiddleware,
  duelAuthMiddleware
};
