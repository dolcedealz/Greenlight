// backend/src/services/auth.service.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Сервис аутентификации для Telegram Mini App
 */
class AuthService {
  /**
   * Валидация данных Telegram WebApp
   * @param {string} initData - Данные инициализации от Telegram
   * @param {string} botToken - Токен бота
   * @returns {Object|null} - Данные пользователя или null если невалидно
   */
  validateTelegramWebAppData(initData, botToken) {
    try {
      console.log('AUTH SERVICE: Валидация Telegram WebApp данных');
      
      if (!initData || !botToken) {
        console.error('AUTH SERVICE: Отсутствуют initData или botToken');
        return null;
      }

      // Парсим данные из initData
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        console.error('AUTH SERVICE: Отсутствует hash в initData');
        return null;
      }

      // Убираем hash из параметров для валидации
      urlParams.delete('hash');
      
      // Сортируем параметры и создаем строку для валидации
      const dataCheckArray = [];
      for (const [key, value] of urlParams.entries()) {
        dataCheckArray.push(`${key}=${value}`);
      }
      dataCheckArray.sort();
      const dataCheckString = dataCheckArray.join('\n');

      // Создаем секретный ключ из токена бота
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Вычисляем ожидаемый hash
      const expectedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // Проверяем hash
      if (hash !== expectedHash) {
        console.error('AUTH SERVICE: Невалидный hash');
        return null;
      }

      // Парсим данные пользователя
      const userDataString = urlParams.get('user');
      if (!userDataString) {
        console.error('AUTH SERVICE: Отсутствуют данные пользователя');
        return null;
      }

      const userData = JSON.parse(userDataString);
      
      // Проверяем auth_date (данные не должны быть старше 24 часов)
      const authDate = parseInt(urlParams.get('auth_date'));
      const currentTime = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 часа в секундах

      if (currentTime - authDate > maxAge) {
        console.error('AUTH SERVICE: Данные авторизации устарели');
        return null;
      }

      console.log('AUTH SERVICE: Telegram данные валидны');
      return {
        telegramId: userData.id,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        languageCode: userData.language_code,
        authDate: new Date(authDate * 1000),
        queryId: urlParams.get('query_id'),
        chatType: urlParams.get('chat_type'),
        chatInstance: urlParams.get('chat_instance')
      };

    } catch (error) {
      console.error('AUTH SERVICE: Ошибка валидации Telegram данных:', error);
      return null;
    }
  }

  /**
   * Получить или создать пользователя по Telegram данным
   * @param {Object} telegramData - Валидированные данные Telegram
   * @param {string} referralCode - Реферальный код (опционально)
   * @returns {Promise<Object>} - Пользователь
   */
  async getOrCreateUser(telegramData, referralCode = null) {
    try {
      console.log(`AUTH SERVICE: Поиск пользователя с Telegram ID: ${telegramData.telegramId}`);
      
      let user = await User.findOne({ telegramId: telegramData.telegramId });
      
      if (user) {
        // Обновляем данные существующего пользователя
        user.username = telegramData.username || user.username;
        user.firstName = telegramData.firstName || user.firstName;
        user.lastName = telegramData.lastName || user.lastName;
        user.languageCode = telegramData.languageCode || user.languageCode;
        user.lastActivity = new Date();
        
        await user.save();
        console.log(`AUTH SERVICE: Пользователь обновлен: ${user.username || user.telegramId}`);
        
        return user;
      }

      // Создаем нового пользователя
      console.log(`AUTH SERVICE: Создание нового пользователя`);
      
      const newUserData = {
        telegramId: telegramData.telegramId,
        username: telegramData.username,
        firstName: telegramData.firstName,
        lastName: telegramData.lastName,
        languageCode: telegramData.languageCode,
        balance: 0,
        totalWagered: 0,
        totalWon: 0,
        isBlocked: false,
        registeredAt: new Date(),
        lastActivity: new Date(),
        // Настройки по умолчанию
        settings: {
          soundEnabled: true,
          vibrationEnabled: true,
          notifications: true
        }
      };

      // Обрабатываем реферальный код
      if (referralCode) {
        try {
          const referrer = await User.findOne({ 
            referralCode: referralCode,
            isBlocked: false 
          });
          
          if (referrer && referrer.telegramId !== telegramData.telegramId) {
            newUserData.referredBy = referrer._id;
            console.log(`AUTH SERVICE: Пользователь приглашен по реферальному коду: ${referralCode}`);
          }
        } catch (refError) {
          console.error('AUTH SERVICE: Ошибка обработки реферального кода:', refError);
          // Не прерываем создание пользователя из-за ошибки в реферальной системе
        }
      }

      user = new User(newUserData);
      await user.save();

      console.log(`AUTH SERVICE: Новый пользователь создан: ${user.username || user.telegramId}`);
      return user;

    } catch (error) {
      console.error('AUTH SERVICE: Ошибка создания/получения пользователя:', error);
      throw new Error('Ошибка аутентификации пользователя');
    }
  }

  /**
   * Создать JWT токен для пользователя
   * @param {Object} user - Пользователь
   * @returns {string} - JWT токен
   */
  generateJWT(user) {
    try {
      const payload = {
        userId: user._id,
        telegramId: user.telegramId,
        username: user.username,
        isBlocked: user.isBlocked
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { 
          expiresIn: '30d',
          issuer: 'greenlight-casino',
          audience: 'telegram-mini-app'
        }
      );

      console.log(`AUTH SERVICE: JWT токен создан для пользователя: ${user.username || user.telegramId}`);
      return token;

    } catch (error) {
      console.error('AUTH SERVICE: Ошибка создания JWT токена:', error);
      throw new Error('Ошибка создания токена');
    }
  }

  /**
   * Валидировать JWT токен
   * @param {string} token - JWT токен
   * @returns {Object|null} - Декодированные данные или null
   */
  validateJWT(token) {
    try {
      if (!token) {
        return null;
      }

      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET,
        {
          issuer: 'greenlight-casino',
          audience: 'telegram-mini-app'
        }
      );

      return decoded;

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        console.warn('AUTH SERVICE: JWT токен истек');
      } else if (error.name === 'JsonWebTokenError') {
        console.warn('AUTH SERVICE: Невалидный JWT токен');
      } else {
        console.error('AUTH SERVICE: Ошибка валидации JWT:', error);
      }
      return null;
    }
  }

  /**
   * Проверить права администратора
   * @param {Object} user - Пользователь
   * @returns {boolean} - Является ли администратором
   */
  isAdmin(user) {
    if (!user || !user.telegramId) {
      return false;
    }

    // Список админов из переменных окружения
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim());
    return adminIds.includes(user.telegramId.toString());
  }

  /**
   * Аутентификация пользователя через прямой объект (без валидации initData)
   * @param {Object} telegramUser - Объект пользователя Telegram
   * @param {string} referralCode - Реферальный код (опционально)
   * @returns {Promise<Object>} - Результат аутентификации
   */
  async authenticateUserDirect(telegramUser, referralCode = null) {
    try {
      console.log('AUTH SERVICE: Прямая аутентификация пользователя');

      if (!telegramUser || !telegramUser.id) {
        throw new Error('Невалидные данные пользователя Telegram');
      }

      // Преобразуем данные в формат telegramData
      const telegramData = {
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        languageCode: telegramUser.language_code
      };

      // Получаем или создаем пользователя
      const user = await this.getOrCreateUser(telegramData, referralCode);

      // Проверяем, не заблокирован ли пользователь
      if (user.isBlocked) {
        throw new Error('Пользователь заблокирован');
      }

      // Создаем JWT токен
      const token = this.generateJWT(user);

      console.log('AUTH SERVICE: Прямая аутентификация успешна');

      return {
        success: true,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance,
          totalWagered: user.totalWagered,
          totalWon: user.totalWon,
          referralCode: user.referralCode,
          isAdmin: this.isAdmin(user),
          registeredAt: user.registeredAt,
          lastActivity: user.lastActivity
        },
        token
      };

    } catch (error) {
      console.error('AUTH SERVICE: Ошибка прямой аутентификации:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Полная аутентификация пользователя для Telegram Mini App
   * @param {string} initData - Данные инициализации от Telegram
   * @param {string} referralCode - Реферальный код (опционально)
   * @returns {Promise<Object>} - Результат аутентификации
   */
  async authenticateUser(initData, referralCode = null) {
    try {
      console.log('AUTH SERVICE: Начало аутентификации пользователя');

      // Валидируем Telegram данные
      const telegramData = this.validateTelegramWebAppData(
        initData,
        process.env.TELEGRAM_BOT_TOKEN
      );

      if (!telegramData) {
        throw new Error('Невалидные данные Telegram');
      }

      // Получаем или создаем пользователя
      const user = await this.getOrCreateUser(telegramData, referralCode);

      // Проверяем, не заблокирован ли пользователь
      if (user.isBlocked) {
        throw new Error('Пользователь заблокирован');
      }

      // Создаем JWT токен
      const token = this.generateJWT(user);

      console.log('AUTH SERVICE: Аутентификация успешна');

      return {
        success: true,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance,
          totalWagered: user.totalWagered,
          totalWon: user.totalWon,
          referralCode: user.referralCode,
          isAdmin: this.isAdmin(user),
          registeredAt: user.registeredAt,
          lastActivity: user.lastActivity
        },
        token
      };

    } catch (error) {
      console.error('AUTH SERVICE: Ошибка аутентификации:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new AuthService();