// backend/src/middleware/auth.middleware.js
const { User } = require('../models');
const crypto = require('crypto');

/**
 * Middleware для проверки аутентификации Telegram WebApp
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
async function telegramAuthMiddleware(req, res, next) {
  try {
    console.log('AUTH: Начало проверки аутентификации');
    console.log('AUTH: Headers:', JSON.stringify(req.headers, null, 2));
    
    // Получаем данные инициализации из заголовка
    const initData = req.headers['telegram-data'];
    
    if (!initData) {
      console.log('AUTH: Отсутствуют данные аутентификации');
      return res.status(401).json({
        success: false,
        message: 'Отсутствуют данные аутентификации'
      });
    }
    
    console.log('AUTH: Получены initData:', initData);
    
    // Проверяем данные на корректность (в реальном приложении здесь будет
    // полноценная проверка подписи от Telegram)
    
    // В этом примере мы просто извлекаем telegramId из данных
    // В реальном приложении нужно проверить подпись данных
    let telegramId;
    let telegramUser;
    try {
      // Простая имитация проверки (в реальном приложении будет более сложная логика)
      const parts = initData.split('&');
      for (const part of parts) {
        if (part.startsWith('user=')) {
          const userJson = decodeURIComponent(part.split('=')[1]);
          console.log('AUTH: Decoded user JSON:', userJson);
          telegramUser = JSON.parse(userJson);
          telegramId = telegramUser.id;
          break;
        }
      }
    } catch (error) {
      console.error('AUTH: Ошибка парсинга данных аутентификации:', error);
      return res.status(401).json({
        success: false,
        message: 'Некорректные данные аутентификации'
      });
    }
    
    if (!telegramId) {
      console.log('AUTH: Идентификатор пользователя не найден');
      return res.status(401).json({
        success: false,
        message: 'Идентификатор пользователя не найден'
      });
    }
    
    console.log(`AUTH: TelegramId извлечен: ${telegramId}`);
    
    // Находим пользователя по Telegram ID
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log(`AUTH: Пользователь с telegramId ${telegramId} не найден, создаем нового`);
      
      // Создаем нового пользователя, если не найден
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
      console.log(`AUTH: Пользователь найден: ${user._id} (${user.firstName} ${user.lastName})`);
      console.log(`AUTH: Баланс пользователя: ${user.balance} USDT`);
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
    
    // Сохраняем пользователя в запросе
    req.user = user;
    
    console.log(`AUTH: Аутентификация успешна для пользователя ${user._id}`);
    
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
  // Должен быть вызван после telegramAuthMiddleware
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Не аутентифицировано'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Доступ запрещен'
    });
  }
  
  next();
}

module.exports = {
  telegramAuthMiddleware,
  adminAuthMiddleware
};