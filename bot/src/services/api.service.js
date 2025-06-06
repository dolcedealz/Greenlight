// bot/src/services/api.service.js
const axios = require('axios');
const config = require('../config');

/**
 * Сервис для работы с API сервера
 */
class ApiService {
  constructor() {
    // Создаем экземпляр axios с базовым URL
    this.api = axios.create({
      baseURL: config.apiUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }
  
  /**
   * Создает заголовки для аутентификации через Telegram данные
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @returns {Object} - Заголовки для запроса
   */
  createTelegramAuthHeaders(telegramUser) {
    // Очищаем строки от недопустимых символов для HTTP заголовков
    const cleanString = (str) => {
      if (!str) return '';
      return str.replace(/[^\x20-\x7E]/g, ''); // Удаляем все не-ASCII символы
    };

    const headers = {
      'Authorization': `Bot ${config.BOT_TOKEN || process.env.BOT_TOKEN}`,
      'X-Telegram-User-Id': telegramUser.id.toString(),
      'X-Telegram-Username': cleanString(telegramUser.username) || '',
      'X-Telegram-First-Name': cleanString(telegramUser.first_name) || '',
      'Content-Type': 'application/json'
    };

    // Логирование отключено в продакшн для безопасности

    return headers;
  }
  
  /**
   * Создает или обновляет пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} referralCode - Реферальный код (опционально)
   * @returns {Object} - Данные пользователя
   */
  async createOrUpdateUser(telegramUser, referralCode = null) {
    try {
      console.log(`API: Создание/обновление пользователя ${telegramUser.id}`);
      
      const data = {
        user: telegramUser,
        referralCode
      };
      
      const response = await this.api.post('/users/auth', data);
      
      console.log(`API: Пользователь ${telegramUser.id} успешно создан/обновлен`);
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при создании/обновлении пользователя:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Создает депозит через backend API
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {number} amount - Сумма депозита
   * @param {Object} metadata - Дополнительные данные
   * @returns {Object} - Данные созданного депозита
   */
  async createDeposit(telegramUser, amount, metadata = {}) {
    try {
      console.log(`API: Создаем депозит для пользователя ${telegramUser.id} на сумму ${amount} USDT`);
      
      // Сначала убеждаемся, что пользователь существует в системе
      await this.createOrUpdateUser(telegramUser);
      
      // Создаем депозит
      const depositData = {
        amount: amount,
        description: metadata.description || `Пополнение через Telegram бот`,
        referralCode: metadata.referralCode || null
      };
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      console.log('API: Отправляем запрос на создание депозита:', depositData);
      
      const response = await this.api.post('/payments/deposits', depositData, { headers });
      
      console.log('API: Депозит создан успешно');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при создании депозита:', error.response?.data || error.message);
      
      if (error.response) {
        // Пробрасываем ошибку с понятным сообщением
        const errorMessage = error.response.data?.message || 'Ошибка API при создании депозита';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }
  
  /**
   * Получает статус депозита - ИСПРАВЛЕНО с улучшенной обработкой ошибок
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} depositId - ID депозита
   * @returns {Object} - Статус депозита
   */
  async getDepositStatus(telegramUser, depositId) {
    try {
      console.log(`API: Проверяем статус депозита ${depositId} для пользователя ${telegramUser.id}`);
      
      // Валидация depositId - должен быть MongoDB ObjectId
      if (!depositId || !depositId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Некорректный ID депозита');
      }
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/payments/deposits/${depositId}/status`, { headers });
      
      console.log('API: Статус депозита получен:', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении статуса депозита:', error.response?.data || error.message);
      
      if (error.response) {
        console.error('API: Статус ответа:', error.response.status);
        
        // Более детальная обработка ошибок
        if (error.response.status === 404) {
          throw new Error('Депозит не найден');
        } else if (error.response.status === 403) {
          throw new Error('Доступ к депозиту запрещен');
        } else if (error.response.status === 401) {
          throw new Error('Ошибка аутентификации пользователя');
        } else {
          const message = error.response.data?.message || 'Ошибка получения статуса депозита';
          throw new Error(message);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Получает информацию о депозите
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} depositId - ID депозита
   * @returns {Object} - Информация о депозите
   */
  async getDepositInfo(telegramUser, depositId) {
    try {
      console.log(`API: Получаем информацию о депозите ${depositId} для пользователя ${telegramUser.id}`);
      
      // Валидация depositId
      if (!depositId || !depositId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Некорректный ID депозита');
      }
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/payments/deposits/${depositId}`, { headers });
      
      console.log('API: Информация о депозите получена');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении информации о депозите:', error.response?.data || error.message);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Депозит не найден');
        } else if (error.response.status === 403) {
          throw new Error('Доступ к депозиту запрещен');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Получает историю депозитов пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {Object} params - Параметры запроса
   * @returns {Object} - История депозитов
   */
  async getUserDeposits(telegramUser, params = {}) {
    try {
      console.log(`API: Получаем историю депозитов для пользователя ${telegramUser.id}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get('/payments/deposits', { 
        headers,
        params
      });
      
      console.log('API: История депозитов получена');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении истории депозитов:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Получает баланс пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @returns {number} - Баланс пользователя
   */
  async getUserBalance(telegramUser) {
    try {
      console.log(`API: Получаем баланс пользователя ${telegramUser.id}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get('/users/balance', { headers });
      
      console.log(`API: Баланс пользователя: ${response.data.data.balance} USDT`);
      
      return response.data.data.balance;
    } catch (error) {
      console.error('API: Ошибка при получении баланса:', error.response?.data || error.message);
      
      // Возвращаем 0 в случае ошибки, чтобы не ломать интерфейс
      console.log('API: Возвращаем баланс 0 из-за ошибки');
      return 0;
    }
  }
  
  /**
   * Получает профиль пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @returns {Object} - Профиль пользователя
   */
  async getUserProfile(telegramUser) {
    try {
      console.log(`API: Получаем профиль пользователя ${telegramUser.id}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      console.log('API: Заголовки запроса:', JSON.stringify(headers, null, 2));
      
      const response = await this.api.get('/users/profile', { headers });
      
      console.log('API: Профиль пользователя получен:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении профиля:', error.response?.data || error.message);
      console.error('API: Статус ошибки:', error.response?.status);
      console.error('API: URL запроса:', error.config?.url);
      throw error;
    }
  }
  
  /**
   * Получает реферальный код пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @returns {string} - Реферальный код
   */
  async getUserReferralCode(telegramUser) {
    try {
      console.log(`API: Получаем реферальный код пользователя ${telegramUser.id}`);
      
      const profile = await this.getUserProfile(telegramUser);
      
      const referralCode = profile.referralCode;
      console.log(`API: Реферальный код: ${referralCode}`);
      
      return referralCode;
    } catch (error) {
      console.error('API: Ошибка при получении реферального кода:', error.response?.data || error.message);
      
      // Возвращаем заглушку в случае ошибки
      return 'ERROR';
    }
  }

  /**
   * Создает запрос на вывод средств
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {Object} withdrawalData - Данные для вывода
   * @returns {Object} - Данные созданного запроса на вывод
   */
  async createWithdrawal(telegramUser, withdrawalData) {
    try {
      console.log(`API: Создаем запрос на вывод для пользователя ${telegramUser.id}`);
      
      // Сначала убеждаемся, что пользователь существует в системе
      await this.createOrUpdateUser(telegramUser);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      console.log('API: Отправляем запрос на создание вывода:', withdrawalData);
      
      const response = await this.api.post('/withdrawals', withdrawalData, { headers });
      
      console.log('API: Запрос на вывод создан успешно');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при создании запроса на вывод:', error.response?.data || error.message);
      
      if (error.response) {
        // Пробрасываем ошибку с понятным сообщением
        const errorMessage = error.response.data?.message || 'Ошибка API при создании вывода';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }
  
  /**
   * Получает статус вывода
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} withdrawalId - ID вывода
   * @returns {Object} - Статус вывода
   */
  async getWithdrawalStatus(telegramUser, withdrawalId) {
    try {
      console.log(`API: Проверяем статус вывода ${withdrawalId} для пользователя ${telegramUser.id}`);
      
      // Валидация withdrawalId - должен быть MongoDB ObjectId
      if (!withdrawalId || !withdrawalId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Некорректный ID вывода');
      }
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/withdrawals/${withdrawalId}/status`, { headers });
      
      console.log('API: Статус вывода получен:', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении статуса вывода:', error.response?.data || error.message);
      
      if (error.response) {
        console.error('API: Статус ответа:', error.response.status);
        
        // Более детальная обработка ошибок
        if (error.response.status === 404) {
          throw new Error('Запрос на вывод не найден');
        } else if (error.response.status === 403) {
          throw new Error('Доступ к выводу запрещен');
        } else if (error.response.status === 401) {
          throw new Error('Ошибка аутентификации пользователя');
        } else {
          const message = error.response.data?.message || 'Ошибка получения статуса вывода';
          throw new Error(message);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Получает информацию о выводе
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} withdrawalId - ID вывода
   * @returns {Object} - Информация о выводе
   */
  async getWithdrawalInfo(telegramUser, withdrawalId) {
    try {
      console.log(`API: Получаем информацию о выводе ${withdrawalId} для пользователя ${telegramUser.id}`);
      
      // Валидация withdrawalId
      if (!withdrawalId || !withdrawalId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Некорректный ID вывода');
      }
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/withdrawals/${withdrawalId}`, { headers });
      
      console.log('API: Информация о выводе получена');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении информации о выводе:', error.response?.data || error.message);
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error('Запрос на вывод не найден');
        } else if (error.response.status === 403) {
          throw new Error('Доступ к выводу запрещен');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Получает историю выводов пользователя
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {Object} params - Параметры запроса
   * @returns {Object} - История выводов
   */
  async getUserWithdrawals(telegramUser, params = {}) {
    try {
      console.log(`API: Получаем историю выводов для пользователя ${telegramUser.id}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get('/withdrawals', { 
        headers,
        params
      });
      
      console.log('API: История выводов получена');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении истории выводов:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Отменяет запрос на вывод
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} withdrawalId - ID вывода
   * @returns {Object} - Результат отмены
   */
  async cancelWithdrawal(telegramUser, withdrawalId) {
    try {
      console.log(`API: Отменяем вывод ${withdrawalId} для пользователя ${telegramUser.id}`);
      
      // Валидация withdrawalId
      if (!withdrawalId || !withdrawalId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new Error('Некорректный ID вывода');
      }
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.delete(`/withdrawals/${withdrawalId}`, { headers });
      
      console.log('API: Вывод отменен');
      
      return response.data;
    } catch (error) {
      console.error('API: Ошибка при отмене вывода:', error.response?.data || error.message);
      
      if (error.response) {
        const message = error.response.data?.message || 'Ошибка отмены вывода';
        throw new Error(message);
      }
      
      throw error;
    }
  }
  
  /**
   * Проверяет доступность API
   * @returns {boolean} - true если API доступен
   */
  async checkApiHealth() {
    try {
      console.log('API: Проверяем доступность API...');
      
      const response = await this.api.get('/health');
      
      const isHealthy = response.data.success === true;
      console.log(`API: Статус здоровья - ${isHealthy ? 'OK' : 'ERROR'}`);
      
      return isHealthy;
    } catch (error) {
      console.error('API: API недоступен:', error.message);
      return false;
    }
  }
  
  /**
   * Проверяет доступность платежного API
   * @returns {boolean} - true если платежный API доступен
   */
  async checkPaymentApiHealth() {
    try {
      console.log('API: Проверяем доступность платежного API...');
      
      const response = await this.api.get('/payments/health');
      
      const isHealthy = response.data.success === true;
      console.log(`API: Платежный API - ${isHealthy ? 'OK' : 'ERROR'}`);
      
      return isHealthy;
    } catch (error) {
      console.error('API: Платежный API недоступен:', error.message);
      return false;
    }
  }
  
  /**
   * Полная проверка всех API сервисов
   * @returns {Object} - Статус всех сервисов
   */
  async fullHealthCheck() {
    const results = {
      api: await this.checkApiHealth(),
      payments: await this.checkPaymentApiHealth(),
      timestamp: new Date().toISOString()
    };
    
    console.log('API: Полная проверка здоровья:', results);
    
    return results;
  }


  /**
   * Найти пользователя по username
   * @param {string} username - Username пользователя
   * @returns {Object} - Данные пользователя
   */
  async findUserByUsername(username) {
    try {
      console.log(`API: Поиск пользователя по username: ${username}`);
      
      const response = await this.api.get(`/users/search?username=${encodeURIComponent(username)}`);
      
      console.log(`API: Пользователь найден:`, response.data.data);
      return response.data.data;
    } catch (error) {
      console.error(`API: Ошибка поиска пользователя ${username}:`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Пользователь не найден');
    }
  }

  // ============ МЕТОДЫ ДЛЯ ДУЭЛЕЙ ============

  /**
   * Создание дуэли
   * @param {Object} duelData - Данные дуэли
   * @returns {Object} - Результат создания
   */
  async createDuel(duelData, telegramUser = null) {
    try {
      console.log('API: Создаем дуэль:', duelData);
      
      // Добавляем заголовки аутентификации если есть пользователь
      const headers = telegramUser ? this.createTelegramAuthHeaders(telegramUser) : {};
      
      const response = await this.api.post('/duels', duelData, { headers });
      
      console.log('API: Дуэль создана успешно:', response.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка создания дуэли:', error.response?.data || error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка создания дуэли' 
      };
    }
  }

  /**
   * Принятие дуэли
   * @param {string} sessionId - ID сессии дуэли
   * @param {string} userId - ID пользователя
   * @returns {Object} - Результат принятия
   */
  async acceptDuel(sessionId, userId, telegramUser) {
    try {
      console.log(`API: Принимаем дуэль ${sessionId} пользователем ${userId}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.post(`/duels/${sessionId}/accept`, { 
        userId,
        username: telegramUser.username || telegramUser.first_name || 'Unknown'
      }, { headers });
      
      console.log('API: Дуэль принята успешно:', response.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка принятия дуэли:', error.response?.data || error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка принятия дуэли' 
      };
    }
  }

  /**
   * Отклонение дуэли
   * @param {string} sessionId - ID сессии дуэли
   * @param {string} userId - ID пользователя
   * @returns {Object} - Результат отклонения
   */
  async declineDuel(sessionId, userId) {
    try {
      console.log(`API: Отклоняем дуэль ${sessionId} пользователем ${userId}`);
      
      const response = await this.api.post(`/duels/${sessionId}/decline`, { userId });
      
      console.log('API: Дуэль отклонена');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('API: Ошибка отклонения дуэли:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка отклонения дуэли' 
      };
    }
  }

  /**
   * Сохранение результата раунда
   * @param {string} sessionId - ID сессии дуэли
   * @param {Object} roundData - Данные раунда
   * @returns {Object} - Результат сохранения
   */
  async saveDuelRound(sessionId, roundData) {
    try {
      console.log(`API: Сохраняем результат раунда для дуэли ${sessionId}:`, roundData);
      
      const response = await this.api.post(`/duels/${sessionId}/rounds`, roundData);
      
      console.log('API: Результат раунда сохранен');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка сохранения раунда:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка сохранения раунда' 
      };
    }
  }

  /**
   * Завершение дуэли
   * @param {string} sessionId - ID сессии дуэли
   * @param {string} winnerId - ID победителя
   * @returns {Object} - Результат завершения
   */
  async finishDuel(sessionId, winnerId) {
    try {
      console.log(`API: Завершаем дуэль ${sessionId}, победитель: ${winnerId}`);
      
      const response = await this.api.post(`/duels/${sessionId}/finish`, { winnerId });
      
      console.log('API: Дуэль завершена успешно');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка завершения дуэли:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка завершения дуэли' 
      };
    }
  }

  /**
   * Отмена дуэли
   * @param {string} sessionId - ID сессии дуэли
   * @param {string} userId - ID пользователя (может быть null для системной отмены)
   * @returns {Object} - Результат отмены
   */
  async cancelDuel(sessionId, userId, telegramUser) {
    try {
      console.log(`API: Отменяем дуэль ${sessionId}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.post(`/duels/${sessionId}/cancel`, { userId }, { headers });
      
      console.log('API: Дуэль отменена:', response.data);
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка отмены дуэли:', error.response?.data || error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка отмены дуэли' 
      };
    }
  }

  /**
   * Получение данных дуэли
   * @param {string} sessionId - ID сессии дуэли
   * @param {string} userId - ID пользователя (для проверки прав)
   * @returns {Object} - Данные дуэли
   */
  async getDuelData(sessionId, userId, telegramUser = null) {
    try {
      console.log(`API: Получаем данные дуэли ${sessionId} для пользователя ${userId}`);
      
      // Создаем заголовки для аутентификации бота  
      const headers = telegramUser 
        ? this.createTelegramAuthHeaders(telegramUser)
        : {
            'Authorization': `Bot ${config.BOT_TOKEN}`,
            'X-Telegram-User-Id': userId,
            'Content-Type': 'application/json'
          };
      
      console.log('API: Отправляем заголовки для GET duel:', {
        'Authorization': `Bot ${config.BOT_TOKEN ? 'ТОКЕН_ЕСТЬ' : 'ТОКЕН_НЕ_НАЙДЕН'}`,
        'X-Telegram-User-Id': userId,
        userId,
        sessionId
      });
      
      // Если есть полные данные пользователя, используем их
      if (telegramUser) {
        Object.assign(headers, this.createTelegramAuthHeaders(telegramUser));
      }
      
      const response = await this.api.get(`/duels/${sessionId}?userId=${userId}`, { headers });
      
      // Детальное логирование отключено для безопасности
      
      // ИСПРАВЛЕНИЕ: Правильно извлекаем duel из ответа
      let duelData;
      
      // Проверяем структуру ответа - сначала самый вложенный случай
      if (response.data.data && response.data.data.duel) {
        // Случай: { success: true, data: { duel: {...} } }
        duelData = response.data.data.duel;
        console.log('🔧 API: Извлечены данные из data.data.duel');
      } else if (response.data.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)) {
        // Случай: { success: true, data: {...} } где data - это сама дуэль
        duelData = response.data.data;
        console.log('🔧 API: Использованы данные из data.data напрямую');
      } else if (response.data && response.data.duel) {
        // Случай: { success: true, duel: {...} }
        duelData = response.data.duel;
        console.log('🔧 API: Извлечены данные из data.duel');
      } else {
        console.error('❌ API: Неожиданная структура ответа:', response.data);
        console.error('❌ API: response.data.data:', response.data.data);
        console.error('❌ API: typeof response.data.data:', typeof response.data.data);
        throw new Error('Неожиданная структура ответа API');
      }
      
      console.log('✅ API: Извлеченные данные дуэли:', {
        gameType: duelData.gameType,
        format: duelData.format,
        sessionId: duelData.sessionId,
        status: duelData.status,
        hasGameType: !!duelData.gameType,
        hasFormat: !!duelData.format
      });
      
      console.log('API: Данные дуэли получены');
      return { success: true, data: duelData };
    } catch (error) {
      console.error('API: Ошибка получения данных дуэли:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Ошибка получения данных дуэли' 
      };
    }
  }

  /**
   * Получение статистики дуэлей пользователя
   * @param {string} userId - ID пользователя
   * @returns {Object} - Статистика дуэлей
   */
  async getUserDuelStats(userId) {
    try {
      console.log(`API: Получаем статистику дуэлей для пользователя ${userId}`);
      
      const response = await this.api.get(`/duels/stats/${userId}`);
      
      console.log('API: Статистика дуэлей получена');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка получения статистики дуэлей:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Статистика недоступна' 
      };
    }
  }

  /**
   * Получение истории дуэлей пользователя
   * @param {string} userId - ID пользователя
   * @param {number} limit - Лимит записей
   * @param {number} offset - Смещение
   * @returns {Object} - История дуэлей
   */
  async getUserDuelHistory(userId, limit = 20, offset = 0) {
    try {
      console.log(`API: Получаем историю дуэлей для пользователя ${userId}`);
      
      const response = await this.api.get(`/duels/history/${userId}?limit=${limit}&offset=${offset}`);
      
      console.log('API: История дуэлей получена');
      return { success: true, data: response.data.data };
    } catch (error) {
      console.error('API: Ошибка получения истории дуэлей:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'История недоступна' 
      };
    }
  }

  /**
   * Получение активных дуэлей пользователя
   * @param {string} userId - ID пользователя
   * @returns {Array} - Массив активных дуэлей
   */
  async getUserActiveDuels(userId) {
    try {
      console.log(`API: Получаем активные дуэли для пользователя ${userId}`);
      
      const response = await this.api.get(`/duels/user/active?userId=${userId}`);
      
      console.log('API: Активные дуэли получены');
      return response.data.data || [];
    } catch (error) {
      console.error('API: Ошибка получения активных дуэлей:', error.response?.data || error.message);
      return [];
    }
  }

  // ============ СОВМЕСТИМОСТЬ СО СТАРЫМИ МЕТОДАМИ ============

  /**
   * Создание PvP вызова (совместимость со старым API)
   * @param {Object} challengeData - Данные вызова
   * @returns {Object} - Результат создания
   */
  async createPvPChallenge(challengeData) {
    console.log('API: Создание PvP вызова (совместимость)');
    return this.createDuel({
      challengerId: challengeData.challengerId,
      challengerUsername: challengeData.challengerUsername,
      opponentUsername: challengeData.opponentUsername,
      amount: challengeData.amount,
      gameType: challengeData.gameType,
      format: challengeData.format,
      winsRequired: challengeData.winsRequired,
      chatId: challengeData.chatId,
      chatType: challengeData.chatType,
      messageId: challengeData.messageId
    });
  }

  /**
   * Ответ на PvP вызов (совместимость со старым API)
   * @param {string} duelId - ID дуэли
   * @param {string} opponentId - ID оппонента
   * @param {string} response - Ответ ('accept' или 'decline')
   * @returns {Object} - Результат ответа
   */
  async respondToPvPChallenge(duelId, opponentId, response) {
    console.log(`API: Ответ на PvP вызов (совместимость): ${response}`);
    
    if (response === 'accept') {
      return this.acceptDuel(duelId, opponentId);
    } else {
      return this.declineDuel(duelId, opponentId);
    }
  }

  /**
   * Получение PvP сессии (совместимость со старым API)
   * @param {string} sessionId - ID сессии
   * @param {string} userId - ID пользователя
   * @returns {Object} - Данные сессии
   */
  async getPvPSession(sessionId, userId) {
    console.log('API: Получение PvP сессии (совместимость)');
    return this.getDuelData(sessionId, userId);
  }

  /**
   * Завершение PvP дуэли (совместимость со старым API)
   * @param {string} sessionId - ID сессии
   * @param {string} winnerId - ID победителя
   * @returns {Object} - Результат завершения
   */
  async finishPvPDuel(sessionId, winnerId) {
    console.log('API: Завершение PvP дуэли (совместимость)');
    return this.finishDuel(sessionId, winnerId);
  }

  /**
   * Активирует промокод
   * @param {number} userId - ID пользователя Telegram
   * @param {string} promoCode - Промокод для активации
   * @returns {Object} - Результат активации
   */
  async activatePromoCode(userId, promoCode) {
    try {
      console.log(`API: Активируем промокод ${promoCode} для пользователя ${userId}`);
      
      const headers = {
        'Authorization': `Bot ${config.BOT_TOKEN || process.env.BOT_TOKEN}`,
        'X-Telegram-User-Id': userId.toString(),
        'Content-Type': 'application/json'
      };
      
      const response = await this.api.post('/promocodes/activate', { 
        code: promoCode 
      }, { headers });
      
      console.log('API: Промокод активирован:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('API: Ошибка активации промокода:', error.response?.data || error.message);
      
      if (error.response) {
        // Возвращаем структурированную ошибку
        return {
          success: false,
          message: error.response.data?.message || 'Ошибка активации промокода'
        };
      }
      
      throw error;
    }
  }
}

// Экспортируем singleton instance
const apiService = new ApiService();

module.exports = apiService;