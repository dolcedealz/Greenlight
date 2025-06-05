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
    // Создаем простую имитацию Telegram WebApp initData
    const initData = `user=${encodeURIComponent(JSON.stringify({
      id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      username: telegramUser.username,
      language_code: telegramUser.language_code || 'ru'
    }))}`;
    
    return {
      'telegram-data': initData
    };
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
      
      const response = await this.api.get('/users/profile', { headers });
      
      console.log('API: Профиль пользователя получен');
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении профиля:', error.response?.data || error.message);
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

  // ===== PvP ДУЭЛИ МЕТОДЫ =====

  /**
   * Создает вызов на PvP дуэль
   * @param {Object} challengeData - Данные вызова
   * @returns {Object} - Результат создания вызова
   */
  async createPvPChallenge(challengeData) {
    try {
      console.log('API: Создание PvP вызова:', challengeData);
      
      const response = await this.api.post('/pvp/challenge', challengeData, {
        headers: this.createTelegramAuthHeaders({
          id: challengeData.challengerId,
          username: challengeData.challengerUsername
        })
      });
      
      console.log('API: PvP вызов создан:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка создания PvP вызова:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка создания вызова');
    }
  }

  /**
   * Отвечает на вызов PvP дуэли (принять/отклонить)
   * @param {string} duelId - ID дуэли
   * @param {string} userId - ID пользователя
   * @param {string} action - Действие ('accept' или 'decline')
   * @returns {Object} - Результат ответа
   */
  async respondToPvPChallenge(duelId, userId, action) {
    try {
      console.log(`API: Ответ на PvP вызов ${duelId}: ${action}`);
      
      const response = await this.api.post(`/pvp/respond/${duelId}`, { action }, {
        headers: this.createTelegramAuthHeaders({ id: userId })
      });
      
      console.log('API: Ответ на PvP вызов:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка ответа на PvP вызов:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка ответа на вызов');
    }
  }

  /**
   * Получает информацию о PvP сессии
   * @param {string} sessionId - ID сессии
   * @param {string} userId - ID пользователя
   * @returns {Object} - Данные сессии
   */
  async getPvPSession(sessionId, userId) {
    try {
      console.log(`API: Получение PvP сессии ${sessionId}`);
      
      const response = await this.api.get(`/pvp/session/${sessionId}`, {
        headers: this.createTelegramAuthHeaders({ id: userId })
      });
      
      console.log('API: PvP сессия получена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка получения PvP сессии:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка получения сессии');
    }
  }

  /**
   * Присоединяется к PvP сессии
   * @param {string} sessionId - ID сессии
   * @param {string} userId - ID пользователя
   * @returns {Object} - Результат присоединения
   */
  async joinPvPSession(sessionId, userId) {
    try {
      console.log(`API: Присоединение к PvP сессии ${sessionId}`);
      
      const response = await this.api.post(`/pvp/join/${sessionId}`, {}, {
        headers: this.createTelegramAuthHeaders({ id: userId })
      });
      
      console.log('API: Присоединение к PvP сессии:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка присоединения к PvP сессии:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка присоединения к сессии');
    }
  }

  /**
   * Устанавливает готовность игрока в PvP сессии
   * @param {string} sessionId - ID сессии
   * @param {string} userId - ID пользователя
   * @param {boolean} ready - Готовность
   * @returns {Object} - Результат установки готовности
   */
  async setPvPReady(sessionId, userId, ready = true) {
    try {
      console.log(`API: Установка готовности PvP ${sessionId}: ${ready}`);
      
      const response = await this.api.post(`/pvp/ready/${sessionId}`, { ready }, {
        headers: this.createTelegramAuthHeaders({ id: userId })
      });
      
      console.log('API: Готовность PvP установлена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка установки готовности PvP:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка установки готовности');
    }
  }

  /**
   * Сохраняет результат раунда эмодзи дуэли
   * @param {string} sessionId - ID сессии
   * @param {Object} roundData - Данные раунда
   * @returns {Object} - Результат сохранения
   */
  async saveDuelRound(sessionId, roundData) {
    try {
      console.log(`API: Сохранение раунда дуэли ${sessionId}:`, roundData);
      
      const response = await this.api.post(`/pvp/round/${sessionId}`, roundData);
      
      console.log('API: Раунд сохранен:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка сохранения раунда:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка сохранения раунда');
    }
  }

  /**
   * Завершает PvP дуэль
   * @param {string} sessionId - ID сессии
   * @param {string} winnerId - ID победителя
   * @returns {Object} - Результат завершения
   */
  async finishPvPDuel(sessionId, winnerId) {
    try {
      console.log(`API: Завершение дуэли ${sessionId}, победитель: ${winnerId}`);
      
      const response = await this.api.post(`/pvp/finish/${sessionId}`, { winnerId });
      
      console.log('API: Дуэль завершена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка завершения дуэли:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка завершения дуэли');
    }
  }

  /**
   * Запускает PvP игру
   * @param {string} sessionId - ID сессии
   * @param {string} userId - ID пользователя
   * @returns {Object} - Результат игры
   */
  async startPvPGame(sessionId, userId) {
    try {
      console.log(`API: Запуск PvP игры ${sessionId}`);
      
      const response = await this.api.post(`/pvp/start/${sessionId}`, {}, {
        headers: this.createTelegramAuthHeaders({ id: userId })
      });
      
      console.log('API: PvP игра запущена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка запуска PvP игры:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка запуска игры');
    }
  }

  /**
   * Получает активные PvP дуэли пользователя
   * @param {Object} telegramUser - Данные пользователя
   * @returns {Object} - Список активных дуэлей
   */
  async getActivePvPDuels(telegramUser) {
    try {
      console.log(`API: Получение активных PvP дуэлей для ${telegramUser.id}`);
      
      const response = await this.api.get('/pvp/active', {
        headers: this.createTelegramAuthHeaders(telegramUser)
      });
      
      console.log('API: Активные PvP дуэли получены:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка получения активных PvP дуэлей:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка получения активных дуэлей');
    }
  }

  /**
   * Получает историю PvP игр пользователя
   * @param {Object} telegramUser - Данные пользователя
   * @param {number} limit - Количество записей
   * @returns {Object} - История PvP игр
   */
  async getPvPHistory(telegramUser, limit = 20) {
    try {
      console.log(`API: Получение истории PvP для ${telegramUser.id}`);
      
      const response = await this.api.get(`/pvp/history?limit=${limit}`, {
        headers: this.createTelegramAuthHeaders(telegramUser)
      });
      
      console.log('API: История PvP получена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка получения истории PvP:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка получения истории');
    }
  }

  /**
   * Получает статистику PvP игр пользователя
   * @param {Object} telegramUser - Данные пользователя
   * @returns {Object} - Статистика PvP игр
   */
  async getPvPStats(telegramUser) {
    try {
      console.log(`API: Получение статистики PvP для ${telegramUser.id}`);
      
      const response = await this.api.get('/pvp/stats', {
        headers: this.createTelegramAuthHeaders(telegramUser)
      });
      
      console.log('API: Статистика PvP получена:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка получения статистики PvP:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка получения статистики');
    }
  }

  /**
   * Валидирует возможность создания PvP вызова
   * @param {Object} telegramUser - Данные пользователя
   * @param {string} opponentId - ID оппонента
   * @param {number} amount - Сумма ставки
   * @returns {Object} - Результат валидации
   */
  async validatePvPChallenge(telegramUser, opponentId, amount) {
    try {
      console.log(`API: Валидация PvP вызова ${telegramUser.id} -> ${opponentId}: ${amount}`);
      
      const response = await this.api.post('/pvp/validate-challenge', 
        { opponentId, amount }, 
        {
          headers: this.createTelegramAuthHeaders(telegramUser)
        }
      );
      
      console.log('API: Валидация PvP вызова:', response.data);
      return response.data;
    } catch (error) {
      console.error('API: Ошибка валидации PvP вызова:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Ошибка валидации вызова');
    }
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
}

// Экспортируем singleton instance
const apiService = new ApiService();

module.exports = apiService;