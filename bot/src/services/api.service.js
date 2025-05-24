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
}

// Экспортируем singleton instance
const apiService = new ApiService();

module.exports = apiService;