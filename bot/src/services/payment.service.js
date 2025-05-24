// payment.service.js
const axios = require('axios');
const config = require('../config');

/**
 * Сервис для работы с платежами
 */
class PaymentService {
  /**
   * Создает инвойс для оплаты через CryptoBot
   * @param {number} userId - ID пользователя Telegram
   * @param {number} amount - Сумма для оплаты
   * @returns {Object} - Данные созданного инвойса
   */
  async createInvoice(userId, amount) {
    try {
      const { token, apiUrl } = config.cryptoBot;
      
      // Проверяем наличие конфигурации
      if (!token) {
        throw new Error('CRYPTO_PAY_API_TOKEN не настроен');
      }
      
      if (!apiUrl) {
        throw new Error('CRYPTO_PAY_API_URL не настроен');
      }
      
      // Формируем данные для запроса
      const data = {
        asset: 'USDT',
        amount: amount.toString(),
        description: `Пополнение баланса в Greenlight Casino`,
        hidden_message: `Пополнение для пользователя #${userId}`,
        paid_btn_name: 'callback', // Изменено с 'return' на 'callback'
        paid_btn_url: config.webAppUrl || 'https://t.me/greenlight_casino_bot',
        allow_comments: false,
        allow_anonymous: true,
        expires_in: 3600 // 1 час на оплату
      };
      
      console.log('Создание инвойса CryptoBot:');
      console.log('- URL:', `${apiUrl}/createInvoice`);
      console.log('- Данные:', JSON.stringify(data, null, 2));
      console.log('- Токен (первые 20 символов):', token ? token.substring(0, 20) + '...' : 'не указан');
      
      // Отправляем запрос к API CryptoBot
      const response = await axios.post(
        `${apiUrl}/createInvoice`,
        data,
        {
          headers: {
            'Crypto-Pay-API-Token': token,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      console.log('Ответ от CryptoBot:', JSON.stringify(response.data, null, 2));
      
      // Проверяем успешность ответа
      if (!response.data.ok) {
        const errorInfo = response.data.error || {};
        const errorMessage = `CryptoBot API Error: ${errorInfo.name || 'Unknown'} - ${errorInfo.code || 'No code'}`;
        console.error('Детали ошибки CryptoBot:', errorInfo);
        throw new Error(errorMessage);
      }
      
      // Возвращаем данные инвойса
      return response.data.result;
    } catch (error) {
      console.error('Полная ошибка при создании инвойса:', error);
      
      // Детальное логирование ошибки axios
      if (error.response) {
        console.error('Ответ сервера:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
        
        // Если это ошибка от CryptoBot API
        if (error.response.data && error.response.data.error) {
          const cryptoBotError = error.response.data.error;
          throw new Error(`CryptoBot API Error: ${cryptoBotError.name || cryptoBotError.code || 'Unknown error'}`);
        }
      } else if (error.request) {
        console.error('Запрос не получил ответ:', error.request);
        throw new Error('Не удалось связаться с платежной системой');
      } else {
        console.error('Ошибка настройки запроса:', error.message);
      }
      
      throw new Error('Не удалось создать счет для оплаты. Пожалуйста, попробуйте позже.');
    }
  }
  
  /**
   * Проверяет статус инвойса
   * @param {string} invoiceId - ID инвойса
   * @returns {Object} - Данные инвойса
   */
  async checkInvoice(invoiceId) {
    try {
      const { token, apiUrl } = config.cryptoBot;
      
      if (!token || !apiUrl) {
        throw new Error('CryptoBot API не настроен');
      }
      
      console.log(`Проверка статуса инвойса: ${invoiceId}`);
      
      // Отправляем запрос к API CryptoBot
      const response = await axios.get(
        `${apiUrl}/getInvoices`,
        {
          params: {
            invoice_ids: invoiceId
          },
          headers: {
            'Crypto-Pay-API-Token': token
          },
          timeout: 30000
        }
      );
      
      console.log('Ответ проверки инвойса:', JSON.stringify(response.data, null, 2));
      
      if (!response.data.ok) {
        const errorInfo = response.data.error || {};
        throw new Error(`CryptoBot API Error: ${errorInfo.name || 'Unknown'}`);
      }
      
      // Возвращаем данные инвойса
      const invoices = response.data.result.items;
      return invoices.length > 0 ? invoices[0] : null;
    } catch (error) {
      console.error('Ошибка при проверке инвойса:', error);
      
      if (error.response) {
        console.error('Детали ошибки:', error.response.data);
      }
      
      throw new Error('Не удалось проверить статус платежа.');
    }
  }
}

// Экспортируем экземпляр сервиса
const paymentService = new PaymentService();

module.exports = paymentService;