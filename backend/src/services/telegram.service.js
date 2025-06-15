// backend/src/services/telegram.service.js
const axios = require('axios');

class TelegramService {
  constructor() {
    this.botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.channelId = process.env.TELEGRAM_CHANNEL_ID;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    if (!this.botToken) {
      console.warn('TELEGRAM_SERVICE: Токен бота не настроен');
    }
    
    if (!this.channelId) {
      console.warn('TELEGRAM_SERVICE: ID канала не настроен');
    }
  }

  /**
   * Бросок кубика в Telegram для получения случайного числа
   */
  async rollDice() {
    try {
      const response = await axios.post(`${this.baseUrl}/sendDice`, {
        chat_id: this.channelId,
        emoji: '🎲'
      });

      if (response.data.ok) {
        const diceMessage = response.data.result;
        return {
          value: diceMessage.dice.value,
          messageId: diceMessage.message_id,
          timestamp: new Date()
        };
      } else {
        throw new Error('Не удалось бросить кубик');
      }
    } catch (error) {
      console.error('Ошибка при броске кубика:', error);
      // Fallback: генерируем случайное число локально
      return {
        value: Math.floor(Math.random() * 6) + 1,
        messageId: null,
        timestamp: new Date(),
        fallback: true
      };
    }
  }

  /**
   * Отправка сообщения в канал
   */
  async sendToChannel(message, options = {}) {
    try {
      if (!this.channelId) {
        console.log('TELEGRAM_SERVICE: Сообщение не отправлено (канал не настроен):', message);
        return null;
      }

      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.channelId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      console.error('Ошибка отправки сообщения в канал:', error);
      throw error;
    }
  }

  /**
   * Отправка личного сообщения пользователю
   */
  async sendPrivateMessage(userId, message, options = {}) {
    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: userId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      console.error(`Ошибка отправки личного сообщения пользователю ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Отправка фото в канал
   */
  async sendPhotoToChannel(photoUrl, caption = '', options = {}) {
    try {
      if (!this.channelId) {
        console.log('TELEGRAM_SERVICE: Фото не отправлено (канал не настроен)');
        return null;
      }

      const response = await axios.post(`${this.baseUrl}/sendPhoto`, {
        chat_id: this.channelId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
        ...options
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      console.error('Ошибка отправки фото в канал:', error);
      throw error;
    }
  }

  /**
   * Редактирование сообщения
   */
  async editMessage(messageId, newText, options = {}) {
    try {
      const response = await axios.post(`${this.baseUrl}/editMessageText`, {
        chat_id: this.channelId,
        message_id: messageId,
        text: newText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      return response.data.ok;
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error);
      throw error;
    }
  }

  /**
   * Удаление сообщения
   */
  async deleteMessage(messageId) {
    try {
      const response = await axios.post(`${this.baseUrl}/deleteMessage`, {
        chat_id: this.channelId,
        message_id: messageId
      });

      return response.data.ok;
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      throw error;
    }
  }

  /**
   * Получение информации о канале
   */
  async getChannelInfo() {
    try {
      if (!this.channelId) {
        return null;
      }

      const response = await axios.post(`${this.baseUrl}/getChat`, {
        chat_id: this.channelId
      });

      if (response.data.ok) {
        return response.data.result;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      console.error('Ошибка получения информации о канале:', error);
      throw error;
    }
  }

  /**
   * Проверка доступности бота
   */
  async checkBotStatus() {
    try {
      const response = await axios.post(`${this.baseUrl}/getMe`);
      
      if (response.data.ok) {
        return {
          status: 'ok',
          botInfo: response.data.result
        };
      } else {
        return {
          status: 'error',
          error: response.data.description
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Отправка уведомления о начале розыгрыша
   */
  async announceGiveawayStart(giveaway) {
    try {
      const prizeEmoji = giveaway.prize?.type === 'telegram_gift' ? '🎁' : '🏆';
      const typeText = giveaway.type === 'daily' ? 'Ежедневный' : giveaway.type === 'weekly' ? 'Недельный' : 'Кастомный';
      
      const message = `${prizeEmoji} <b>${typeText} розыгрыш начался!</b>\n\n` +
                     `🎯 <b>Приз:</b> ${giveaway.prize?.name || 'Не указан'}\n` +
                     `🏆 <b>Победителей:</b> ${giveaway.winnersCount}\n` +
                     `⏰ <b>Окончание:</b> ${new Date(giveaway.endDate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n` +
                     `🎲 <b>Розыгрыш:</b> ${new Date(giveaway.drawDate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n\n` +
                     `💰 Для участия необходимо сделать депозит и зарегистрироваться в боте!\n\n` +
                     `🍀 Удачи всем участникам!`;

      return await this.sendToChannel(message);
    } catch (error) {
      console.error('Ошибка объявления о начале розыгрыша:', error);
      throw error;
    }
  }

  /**
   * Отправка напоминания о скором окончании розыгрыша
   */
  async sendGiveawayReminder(giveaway, participantsCount) {
    try {
      const typeText = giveaway.type === 'daily' ? 'ежедневного' : 'недельного';
      const hoursLeft = Math.ceil((new Date(giveaway.endDate) - new Date()) / (1000 * 60 * 60));
      
      const message = `⏰ <b>Напоминание!</b>\n\n` +
                     `До окончания ${typeText} розыгрыша осталось ${hoursLeft} час(ов)!\n\n` +
                     `🎯 <b>Приз:</b> ${giveaway.prize?.name}\n` +
                     `👥 <b>Участников сейчас:</b> ${participantsCount}\n\n` +
                     `💰 Успейте сделать депозит и принять участие!`;

      return await this.sendToChannel(message);
    } catch (error) {
      console.error('Ошибка отправки напоминания:', error);
      throw error;
    }
  }
}

module.exports = TelegramService;