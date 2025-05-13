// auth.middleware.js
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
    // Получаем данные инициализации из заголовка
    const initData = req.headers['telegram-data'];
    
    if (!initData) {
      return res.status(401).json({
        success: false,
        message: 'Отсутствуют данные аутентификации'
      });
    }
    
    // Проверяем данные на корректность (в реальном приложении здесь будет
    // полноценная проверка подписи от Telegram)
    
    // В этом примере мы просто извлекаем telegramId из данных
    // В реальном приложении нужно проверить подпись данных
    let telegramId;
    try {
      // Простая имитация проверки (в реальном приложении будет более сложная логика)
      const parts = initData.split('&');
      for (const part of parts) {
        if (part.startsWith('user=')) {
          const userJson = decodeURIComponent(part.split('=')[1]);
          const user = JSON.parse(userJson);
          telegramId = user.id;
          break;
        }
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Некорректные данные аутентификации'
      });
    }
    
    if (!telegramId) {
      return res.status(401).json({
        success: false,
        message: 'Идентификатор пользователя не найден'
      });
    }
    
    // Находим пользователя по Telegram ID
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Ваш аккаунт заблокирован'
      });
    }
    
    // Сохраняем пользователя в запросе
    req.user = user;
    
    next();
  } catch (error) {
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