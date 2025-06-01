// backend/src/middleware/auth.middleware.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ДОПОЛНИТЕЛЬНЫМ ЛОГИРОВАНИЕМ
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
    console.log('AUTH: Начало проверки аутентификации');
    console.log('AUTH: URL:', req.method, req.originalUrl);
    console.log('AUTH: Headers:', JSON.stringify(req.headers, null, 2));
    
    // Получаем данные инициализации из заголовка
    const initData = req.headers['telegram-data'];
    
    if (!initData) {
      console.log('AUTH: Отсутствуют данные аутентификации в заголовке telegram-data');
      return res.status(401).json({
        success: false,
        message: 'Отсутствуют данные аутентификации'
      });
    }
    
    console.log('AUTH: Получены initData:', initData.substring(0, 100) + '...');
    
    // В этом примере мы просто извлекаем telegramId из данных
    let telegramId;
    let telegramUser;
    try {
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
      console.log('AUTH: Идентификатор пользователя не найден в данных');
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
  console.log('ADMIN AUTH: Проверка прав администратора');
  console.log('ADMIN AUTH: URL:', req.method, req.originalUrl);
  console.log('ADMIN AUTH: Headers:', JSON.stringify(req.headers, null, 2));
  
  // Проверяем Bearer токен
  const authHeader = req.headers['authorization'];
  console.log('ADMIN AUTH: Authorization header:', authHeader);
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('ADMIN AUTH: Извлечен токен (первые 20 символов):', token.substring(0, 20) + '...');
    
    // Получаем ожидаемый токен из переменных окружения
    const expectedToken = process.env.ADMIN_API_TOKEN;
    console.log('ADMIN AUTH: ADMIN_API_TOKEN установлен:', !!expectedToken);
    
    if (!expectedToken) {
      console.error('ADMIN AUTH: ADMIN_API_TOKEN не установлен в переменных окружения!');
      return res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации сервера: отсутствует ADMIN_API_TOKEN'
      });
    }
    
    // Сравниваем токены
    if (token === expectedToken) {
      console.log('ADMIN AUTH: Токен верный, создаем виртуального админа');
      
      // ИСПРАВЛЕНИЕ: Создаем валидный ObjectId для системного админа
      const systemAdminId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'); // Фиксированный ObjectId
      
      // Создаем виртуального админ-пользователя с валидным ObjectId
      req.user = {
        _id: systemAdminId, // Валидный ObjectId вместо строки
        role: 'admin',
        isAdmin: true,
        firstName: 'Admin',
        lastName: 'System',
        telegramId: 999999999 // Фиктивный telegram ID
      };
      
      console.log('ADMIN AUTH: Создан виртуальный админ с ID:', systemAdminId);
      return next();
    } else {
      console.log('ADMIN AUTH: Неверный токен администратора');
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

module.exports = {
  telegramAuthMiddleware,
  adminAuthMiddleware
};
