// api.service.js
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
      const data = {
        user: telegramUser,
        referralCode
      };
      
      const response = await this.api.post('/users/auth', data);
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при создании/обновлении пользователя:', error);
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
      console.log('API: Заголовки аутентификации:', headers);
      
      const response = await this.api.post('/payments/deposits', depositData, { headers });
      
      console.log('API: Депозит создан успешно:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при создании депозита:', error);
      
      if (error.response) {
        console.error('API: Статус ответа:', error.response.status);
        console.error('API: Данные ответа:', error.response.data);
        
        // Пробрасываем ошибку с понятным сообщением
        const errorMessage = error.response.data?.message || 'Ошибка API при создании депозита';
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }
  
  /**
   * Получает статус депозита
   * @param {Object} telegramUser - Данные пользователя из Telegram
   * @param {string} depositId - ID депозита
   * @returns {Object} - Статус депозита
   */
  async getDepositStatus(telegramUser, depositId) {
    try {
      console.log(`API: Проверяем статус депозита ${depositId} для пользователя ${telegramUser.id}`);
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/payments/deposits/${depositId}/status`, { headers });
      
      console.log('API: Статус депозита получен:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении статуса депозита:', error);
      
      if (error.response) {
        console.error('API: Статус ответа:', error.response.status);
        console.error('API: Данные ответа:', error.response.data);
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
      
      // Добавляем заголовки аутентификации
      const headers = this.createTelegramAuthHeaders(telegramUser);
      
      const response = await this.api.get(`/payments/deposits/${depositId}`, { headers });
      
      console.log('API: Информация о депозите получена:', response.data);
      
      return response.data.data;
    } catch (error) {
      console.error('API: Ошибка при получении информации о депозите:', error);
      throw error;
    }
  }
  
  /**
   * Получает баланс пользователя
   * @param {number} telegramId - ID пользователя Telegram
   * @returns {number} - Баланс пользователя
   */
  async getUserBalance(telegramId) {
    try {
      // В реальном приложении здесь должен быть запрос к API
      // через механизм авторизации
      const mockBalance = 1000.50; // Заглушка
      return mockBalance;
    } catch (error) {
      console.error('Ошибка при получении баланса:', error);
      throw error;
    }
  }
  
  /**
   * Получает реферальный код пользователя
   * @param {number} telegramId - ID пользователя Telegram
   * @returns {string} - Реферальный код
   */
  async getUserReferralCode(telegramId) {
    try {
      // В реальном приложении здесь должен быть запрос к API
      // через механизм авторизации
      const mockReferralCode = 'ABC123'; // Заглушка
      return mockReferralCode;
    } catch (error) {
      console.error('Ошибка при получении реферального кода:', error);
      throw error;
    }
  }
  
  /**
   * Проверяет доступность API
   * @returns {boolean} - true если API доступен
   */
  async checkApiHealth() {
    try {
      const response = await this.api.get('/health');
      return response.data.success === true;
    } catch (error) {
      console.error('API недоступен:', error.message);
      return false;
    }
  }
}

// Экспортируем экземпляр сервиса
const apiService = new ApiService();

module.exports = apiService;