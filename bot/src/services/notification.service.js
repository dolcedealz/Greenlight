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

  /**
   * Отправляет массовое уведомление пользователям
   * @param {Array} users - Массив пользователей [{telegramId, username}]
   * @param {String} message - Текст сообщения
   * @param {Object} options - Дополнительные опции
   */
  async sendMassNotification(users, message, options = {}) {
    const { priority = 'normal', batchSize = 30 } = options;
    
    console.log(`📢 Начинаем массовую рассылку для ${users.length} пользователей`);
    
    let successCount = 0;
    let failedCount = 0;
    const failedUsers = [];
    
    // Разбиваем на батчи для избежания лимитов Telegram API
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      // Отправляем батч с задержкой между батчами
      await Promise.all(
        batch.map(async (user) => {
          try {
            await this.bot.telegram.sendMessage(
              user.telegramId,
              `📢 ${message}`,
              {
                parse_mode: 'HTML',
                disable_notification: priority !== 'high'
              }
            );
            successCount++;
          } catch (error) {
            failedCount++;
            failedUsers.push({
              telegramId: user.telegramId,
              username: user.username,
              error: error.message
            });
            
            // Логируем только критичные ошибки
            if (!error.message.includes('bot was blocked') && 
                !error.message.includes('user is deactivated')) {
              console.error(`❌ Ошибка отправки для ${user.telegramId}:`, error.message);
            }
          }
        })
      );
      
      // Задержка между батчами (1 секунда)
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Логируем прогресс каждые 100 пользователей
      if ((i + batchSize) % 100 === 0 || i + batchSize >= users.length) {
        console.log(`📊 Прогресс: ${Math.min(i + batchSize, users.length)}/${users.length}`);
      }
    }
    
    console.log(`✅ Рассылка завершена. Успешно: ${successCount}, Ошибок: ${failedCount}`);
    
    return {
      total: users.length,
      success: successCount,
      failed: failedCount,
      failedUsers: failedUsers.slice(0, 10) // Возвращаем только первые 10 ошибок
    };
  }
}

module.exports = new NotificationService();