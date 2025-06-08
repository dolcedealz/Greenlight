// backend/src/utils/telegram-auth.js
const crypto = require('crypto');

/**
 * Верификация Telegram WebApp initData
 * Основано на официальной документации: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
class TelegramAuth {
  constructor() {
    this.botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!this.botToken) {
      console.error('TELEGRAM_AUTH: Переменные окружения:', {
        BOT_TOKEN: process.env.BOT_TOKEN ? 'ЕСТЬ' : 'НЕТ',
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'ЕСТЬ' : 'НЕТ',
        NODE_ENV: process.env.NODE_ENV
      });
      throw new Error('BOT_TOKEN или TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
    }
    console.log('TELEGRAM_AUTH: Инициализирован с токеном длиной:', this.botToken.length);
  }

  /**
   * Верифицирует данные Telegram WebApp
   * @param {string} initData - Строка initData от Telegram WebApp
   * @returns {Object} - { isValid: boolean, userData: Object|null, error: string|null }
   */
  verifyTelegramData(initData) {
    try {
      console.log('TELEGRAM_AUTH: Начало верификации данных');
      
      // Парсим данные
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      console.log('TELEGRAM_AUTH: Параметры из initData:', {
        parametersCount: urlParams.size,
        hasHash: !!hash,
        hasUser: !!urlParams.get('user'),
        hasAuthDate: !!urlParams.get('auth_date')
      });
      
      if (!hash) {
        return {
          isValid: false,
          userData: null,
          error: 'Отсутствует hash в initData'
        };
      }

      // Удаляем hash из параметров для создания строки проверки
      urlParams.delete('hash');
      
      // Создаем строку для проверки подписи согласно документации Telegram
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      console.log('TELEGRAM_AUTH: Строка для проверки (первые 200 символов):', dataCheckString.substring(0, 200));
      
      // Создаем ключ для проверки
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(this.botToken).digest();
      
      // Вычисляем ожидаемый hash
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      console.log('TELEGRAM_AUTH: Сравнение hash-ей:', {
        received: hash.substring(0, 10) + '...',
        calculated: calculatedHash.substring(0, 10) + '...',
        match: hash === calculatedHash
      });
      
      // Сравниваем hash'и
      const isValid = hash === calculatedHash;
      
      if (!isValid) {
        return {
          isValid: false,
          userData: null,
          error: `Некорректная подпись данных. Получен: ${hash.substring(0, 10)}..., ожидался: ${calculatedHash.substring(0, 10)}...`
        };
      }

      // Извлекаем данные пользователя
      const userData = this.extractUserData(urlParams);
      
      // Проверяем время жизни данных (опционально)
      if (userData.auth_date) {
        const authTime = parseInt(userData.auth_date);
        const currentTime = Math.floor(Date.now() / 1000);
        const age = currentTime - authTime;
        const maxAge = 86400; // 24 часа
        
        console.log('TELEGRAM_AUTH: Проверка времени:', {
          authTime: new Date(authTime * 1000).toISOString(),
          currentTime: new Date(currentTime * 1000).toISOString(),
          ageInMinutes: Math.floor(age / 60),
          maxAgeInHours: maxAge / 3600,
          isExpired: age > maxAge
        });
        
        if (age > maxAge) {
          return {
            isValid: false,
            userData: null,
            error: `Данные аутентификации устарели (возраст: ${Math.floor(age / 3600)} часов)`
          };
        }
      }

      return {
        isValid: true,
        userData: userData,
        error: null
      };

    } catch (error) {
      return {
        isValid: false,
        userData: null,
        error: `Ошибка верификации: ${error.message}`
      };
    }
  }

  /**
   * Извлекает данные пользователя из URLSearchParams
   * @param {URLSearchParams} urlParams 
   * @returns {Object}
   */
  extractUserData(urlParams) {
    const userData = {};
    
    // Извлекаем основные данные
    for (const [key, value] of urlParams) {
      if (key === 'user') {
        try {
          userData.user = JSON.parse(decodeURIComponent(value));
        } catch (error) {
          console.error('Ошибка парсинга user data:', error);
        }
      } else {
        userData[key] = value;
      }
    }
    
    return userData;
  }

  /**
   * Упрощенная верификация для разработки (НЕ ИСПОЛЬЗОВАТЬ В PRODUCTION!)
   * @param {string} initData 
   * @returns {Object}
   */
  devVerifyTelegramData(initData) {
    console.warn('⚠️  ВНИМАНИЕ: Используется упрощенная верификация для разработки!');
    
    try {
      const urlParams = new URLSearchParams(initData);
      const userData = this.extractUserData(urlParams);
      
      return {
        isValid: true,
        userData: userData,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        userData: null,
        error: `Ошибка парсинга: ${error.message}`
      };
    }
  }

  /**
   * Генерирует безопасный JWT токен на основе верифицированных данных
   * @param {Object} userData - Верифицированные данные пользователя
   * @returns {string} - JWT токен
   */
  generateJWT(userData) {
    const jwt = require('jsonwebtoken');
    
    if (!userData.user) {
      throw new Error('Отсутствуют данные пользователя для генерации токена');
    }

    const payload = {
      telegramId: userData.user.id,
      username: userData.user.username,
      firstName: userData.user.first_name,
      lastName: userData.user.last_name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 часа
    };

    const secret = process.env.JWT_SECRET;
    
    return jwt.sign(payload, secret);
  }

  /**
   * Верифицирует JWT токен
   * @param {string} token - JWT токен
   * @returns {Object} - { isValid: boolean, payload: Object|null, error: string|null }
   */
  verifyJWT(token) {
    const jwt = require('jsonwebtoken');
    
    try {
      const secret = process.env.JWT_SECRET;
      const payload = jwt.verify(token, secret);
      
      return {
        isValid: true,
        payload: payload,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        payload: null,
        error: error.message
      };
    }
  }
}

// Singleton instance
const telegramAuth = new TelegramAuth();

module.exports = telegramAuth;