// ===== 3. backend/src/services/cryptobot-setup.service.js (НОВЫЙ ФАЙЛ) =====

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
   * Настраивает webhook URL в CryptoBot
   */
  async setupWebhook() {
    try {
      if (!this.cryptoBotToken) {
        console.log('❌ CryptoBot token не найден, пропускаем настройку webhook');
        return false;
      }

      console.log('🔧 Настройка CryptoBot webhook...');
      console.log(`📡 Webhook URL: ${this.webhookUrl}`);
      
      // Устанавливаем webhook
      const response = await this.api.post('/setWebhook', {
        url: this.webhookUrl
      });
      
      if (response.data.ok) {
        console.log('✅ CryptoBot webhook успешно настроен');
        console.log('📝 Ответ:', response.data.result);
        return true;
      } else {
        console.error('❌ Ошибка настройки CryptoBot webhook:', response.data.error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Критическая ошибка настройки CryptoBot webhook:', error.message);
      
      if (error.response) {
        console.error('📡 Статус ответа:', error.response.status);
        console.error('📄 Данные ответа:', error.response.data);
      }
      
      return false;
    }
  }

  /**
   * Получает информацию о текущем webhook
   */
  async getWebhookInfo() {
    try {
      if (!this.cryptoBotToken) {
        console.log('❌ CryptoBot token не найден');
        return null;
      }

      console.log('🔍 Получение информации о CryptoBot webhook...');
      
      const response = await this.api.post('/getWebhookInfo');
      
      if (response.data.ok) {
        const webhookInfo = response.data.result;
        console.log('📋 Текущий webhook info:');
        console.log(`   URL: ${webhookInfo.url || 'не установлен'}`);
        console.log(`   Статус: ${webhookInfo.has_custom_certificate ? 'с сертификатом' : 'без сертификата'}`);
        console.log(`   Pending updates: ${webhookInfo.pending_update_count || 0}`);
        
        if (webhookInfo.last_error_date) {
          const errorDate = new Date(webhookInfo.last_error_date * 1000);
          console.log(`⚠️ Последняя ошибка: ${webhookInfo.last_error_message} (${errorDate.toISOString()})`);
        }
        
        return webhookInfo;
      } else {
        console.error('❌ Ошибка получения webhook info:', response.data.error);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Ошибка получения CryptoBot webhook info:', error.message);
      return null;
    }
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
      
      const response = await this.api.post('/getMe');
      
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
   * Полная настройка CryptoBot (тест + webhook)
   */
  async fullSetup() {
    console.log('🚀 Начинаем полную настройку CryptoBot...');
    
    // Тестируем соединение
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      console.log('❌ Настройка CryptoBot прервана из-за проблем с соединением');
      return false;
    }
    
    // Получаем текущую информацию о webhook
    await this.getWebhookInfo();
    
    // Настраиваем webhook
    const webhookOk = await this.setupWebhook();
    if (!webhookOk) {
      console.log('❌ Не удалось настроить webhook');
      return false;
    }
    
    // Проверяем результат
    await this.getWebhookInfo();
    
    console.log('✅ Полная настройка CryptoBot завершена');
    return true;
  }
}

// Создаем singleton instance
const cryptoBotSetup = new CryptoBotSetupService();

module.exports = cryptoBotSetup;