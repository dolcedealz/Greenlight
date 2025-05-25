// Создать файл bot/src/services/notification.service.js

const { Telegraf } = require('telegraf');
const config = require('../config');

class NotificationService {
  constructor() {
    this.bot = new Telegraf(config.botToken);
  }
  
  /**
   * Отправляет уведомление об одобрении вывода
   */
  async notifyWithdrawalApproved(telegramId, withdrawalData) {
    try {
      await this.bot.telegram.sendMessage(
        telegramId,
        `✅ Ваш запрос на вывод одобрен!\n\n` +
        `💵 Сумма: ${withdrawalData.amount} USDT\n` +
        `📤 Получатель: @${withdrawalData.recipient}\n` +
        `⏳ Статус: Обрабатывается\n\n` +
        `Средства будут отправлены в течение 5-15 минут.`
      );
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }
  
  /**
   * Отправляет уведомление об отклонении вывода
   */
  async notifyWithdrawalRejected(telegramId, withdrawalData) {
    try {
      await this.bot.telegram.sendMessage(
        telegramId,
        `❌ Ваш запрос на вывод отклонен\n\n` +
        `💵 Сумма: ${withdrawalData.amount} USDT\n` +
        `📤 Получатель: @${withdrawalData.recipient}\n` +
        `📝 Причина: ${withdrawalData.rejectionReason}\n\n` +
        `Средства возвращены на ваш баланс.`
      );
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }
  
  /**
   * Отправляет уведомление о завершении вывода
   */
  async notifyWithdrawalCompleted(telegramId, withdrawalData) {
    try {
      await this.bot.telegram.sendMessage(
        telegramId,
        `✅ Вывод успешно выполнен!\n\n` +
        `💵 Сумма: ${withdrawalData.amount} USDT\n` +
        `📤 Получатель: @${withdrawalData.recipient}\n` +
        `🔗 ID транзакции: ${withdrawalData.cryptoBotData.transferId}\n\n` +
        `Спасибо за использование Greenlight Casino!`
      );
    } catch (error) {
      console.error('Ошибка отправки уведомления:', error);
    }
  }
}

module.exports = new NotificationService();