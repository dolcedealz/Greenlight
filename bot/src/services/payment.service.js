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
      
      // Формируем данные для запроса
      const data = {
        asset: 'USDT',
        amount: amount.toString(),
        description: `Пополнение баланса в Greenlight Casino`,
        hidden_message: `Пополнение для пользователя #${userId}`,
        paid_btn_name: 'return',
        paid_btn_url: config.webAppUrl
      };
      
      // Отправляем запрос к API CryptoBot
      const response = await axios.post(
        `${apiUrl}/createInvoice`,
        data,
        {
          headers: {
            'Crypto-Pay-API-Token': token,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Возвращаем данные инвойса
      return response.data.result;
    } catch (error) {
      console.error('Ошибка при создании инвойса:', error);
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
      
      // Отправляем запрос к API CryptoBot
      const response = await axios.get(
        `${apiUrl}/getInvoice`,
        {
          params: {
            invoice_id: invoiceId
          },
          headers: {
            'Crypto-Pay-API-Token': token
          }
        }
      );
      
      // Возвращаем данные инвойса
      return response.data.result;
    } catch (error) {
      console.error('Ошибка при проверке инвойса:', error);
      throw new Error('Не удалось проверить статус платежа.');
    }
  }
}

// Экспортируем экземпляр сервиса
const paymentService = new PaymentService();

module.exports = paymentService;