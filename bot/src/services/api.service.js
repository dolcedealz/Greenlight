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
      }
    });
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
}

// Экспортируем экземпляр сервиса
const apiService = new ApiService();

module.exports = apiService;