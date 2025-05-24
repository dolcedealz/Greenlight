// backend/src/services/cryptobot-setup.service.js
const axios = require('axios');

/**
 * Сервис для настройки webhook'ов CryptoBot
 */
class CryptoBotSetupService {
  constructor() {
    this.cryptoBotApiUrl = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
    this.cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
    this.webhookUrl = process.env.CRYPTO_PAY_WEBHOOK_URL || 'https://greenlight-api-ghqh.onrender.com/webhooks/cryptobot';
    
    if (!this.cryptoBotToken) {
      console.warn('⚠️ CRYPTO_PAY_API_TOKEN не указан в переменных окружения');
      return;
    }
    
    // Создаем axios instance для работы с CryptoBot API
    this.api = axios.create({
      baseURL: this.cryptoBotApiUrl,
      headers: {
        'Crypto-Pay-API-Token': this.cryptoBotToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Тестирует соединение с CryptoBot API
   */
  async testConnection() {
    try {
      if (!this.cryptoBotToken) {
        console.log('❌ CryptoBot token не найден, тест пропущен');
        return false;
      }

      console.log('🧪 Тестирование соединения с CryptoBot API...');
      
      // ИСПРАВЛЕНО: Используем GET запрос для getMe
      const response = await this.api.get('/getMe');
      
      if (response.data.ok) {
        console.log('✅ Соединение с CryptoBot API работает');
        console.log(`🤖 App name: ${response.data.result.name}`);
        console.log(`🆔 App ID: ${response.data.result.app_id}`);
        return true;
      } else {
        console.error('❌ Ошибка соединения с CryptoBot API:', response.data.error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Не удалось подключиться к CryptoBot API:', error.message);
      
      if (error.response) {
        console.error('📡 HTTP Status:', error.response.status);
        console.error('📄 Response:', error.response.data);
      }
      
      return false;
    }
  }

  /**
   * Получает список доступных методов API
   */
  async getAvailableMethods() {
    try {
      console.log('🔍 Получение списка доступных методов API...');
      
      // Пробуем несколько методов для определения правильных endpoint'ов
      const testMethods = [
        { method: 'GET', endpoint: '/getMe' },
        { method: 'GET', endpoint: '/getBalance' },
        { method: 'GET', endpoint: '/getExchangeRates' },
        { method: 'GET', endpoint: '/getCurrencies' }
      ];
      
      const availableMethods = [];
      
      for (const test of testMethods) {
        try {
          const response = await this.api.request({
            method: test.method,
            url: test.endpoint
          });
          
          if (response.data.ok) {
            availableMethods.push(`${test.method} ${test.endpoint}`);
          }
        } catch (error) {
          // Игнорируем ошибки, просто проверяем что доступно
        }
      }
      
      console.log('📋 Доступные методы API:', availableMethods);
      return availableMethods;
      
    } catch (error) {
      console.error('❌ Ошибка получения списка методов:', error.message);
      return [];
    }
  }

  /**
   * Проверяет текущее состояние webhook (без попытки настройки)
   */
  async checkWebhookStatus() {
    console.log('ℹ️ Проверка webhook статуса...');
    console.log(`📡 Ожидаемый Webhook URL: ${this.webhookUrl}`);
    console.log('📝 Примечание: CryptoBot API не предоставляет методы для настройки webhook через API');
    console.log('🔧 Для настройки webhook используйте веб-интерфейс CryptoBot');
    console.log('🌐 Перейдите в настройки приложения на https://t.me/CryptoBot');
    return true;
  }

  /**
   * Полная проверка CryptoBot (без настройки webhook)
   */
  async fullSetup() {
    console.log('🚀 Начинаем проверку CryptoBot...');
    
    // Тестируем соединение
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      console.log('❌ Проверка CryptoBot прервана из-за проблем с соединением');
      return false;
    }
    
    // Получаем доступные методы
    await this.getAvailableMethods();
    
    // Проверяем webhook статус
    await this.checkWebhookStatus();
    
    console.log('✅ Проверка CryptoBot завершена');
    console.log('📌 Webhook нужно настроить вручную в CryptoBot');
    return true;
  }
}

// Создаем singleton instance
const cryptoBotSetup = new CryptoBotSetupService();

module.exports = cryptoBotSetup;