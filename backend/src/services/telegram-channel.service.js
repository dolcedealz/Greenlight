// backend/src/services/telegram-channel.service.js
const axios = require('axios');

class TelegramChannelService {
  constructor() {
    this.botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.channelId = process.env.TELEGRAM_CHANNEL_ID; // например: @greenlight_casino или -1001234567890
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Отправить сообщение в канал
   */
  async sendMessage(text, options = {}) {
    try {
      console.log('📢 КАНАЛ: Отправка сообщения');
      console.log('📢 КАНАЛ: BOT_TOKEN:', this.botToken ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
      console.log('📢 КАНАЛ: CHANNEL_ID:', this.channelId || 'НЕ УСТАНОВЛЕН');
      
      if (!this.channelId) {
        console.warn('TELEGRAM_CHANNEL_ID не настроен');
        return null;
      }

      if (!this.botToken) {
        console.warn('BOT_TOKEN не настроен');
        return null;
      }

      const payload = {
        chat_id: this.channelId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        ...options
      };

      console.log('📢 КАНАЛ: URL:', `${this.baseUrl}/sendMessage`);
      console.log('📢 КАНАЛ: Payload (first 200 chars):', JSON.stringify(payload).substring(0, 200));

      const response = await axios.post(`${this.baseUrl}/sendMessage`, payload);
      console.log('📢 КАНАЛ: Сообщение отправлено успешно');
      return response.data;
    } catch (error) {
      console.error('❌ КАНАЛ: Ошибка отправки сообщения:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Отправить фото с подписью в канал
   */
  async sendPhoto(photo, caption, options = {}) {
    try {
      console.log('📸 КАНАЛ: Отправка фото');
      console.log('📸 КАНАЛ: BOT_TOKEN:', this.botToken ? 'Установлен' : 'НЕ УСТАНОВЛЕН');
      console.log('📸 КАНАЛ: CHANNEL_ID:', this.channelId || 'НЕ УСТАНОВЛЕН');
      
      if (!this.channelId) {
        console.warn('TELEGRAM_CHANNEL_ID не настроен');
        return null;
      }

      if (!this.botToken) {
        console.warn('BOT_TOKEN не настроен');
        return null;
      }

      const payload = {
        chat_id: this.channelId,
        photo: photo,
        caption: caption,
        parse_mode: 'HTML',
        ...options
      };

      console.log('📸 КАНАЛ: URL:', `${this.baseUrl}/sendPhoto`);
      console.log('📸 КАНАЛ: Photo URL:', photo);

      const response = await axios.post(`${this.baseUrl}/sendPhoto`, payload);
      console.log('📸 КАНАЛ: Фото отправлено успешно');
      return response.data;
    } catch (error) {
      console.error('❌ КАНАЛ: Ошибка отправки фото:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Опубликовать анонс розыгрыша
   */
  async postGiveawayAnnouncement(giveaway) {
    try {
      const emoji = giveaway.type === 'daily' ? '🏆' : giveaway.type === 'weekly' ? '💎' : '🎯';
      const typeText = giveaway.type === 'daily' ? 'ЕЖЕДНЕВНЫЙ' : giveaway.type === 'weekly' ? 'НЕДЕЛЬНЫЙ' : 'КАСТОМНЫЙ';
      
      let message = `${emoji} <b>${typeText} РОЗЫГРЫШ</b>\n\n`;
      
      if (giveaway.prize) {
        message += `🎁 <b>Приз:</b> ${giveaway.prize.name}\n`;
        if (giveaway.prize.description) {
          message += `📝 ${giveaway.prize.description}\n`;
        }
        if (giveaway.prize.value) {
          message += `💰 <b>Ценность:</b> ${giveaway.prize.value} USDT\n`;
        }
      }
      
      message += `\n👥 <b>Победителей:</b> ${giveaway.winnersCount}\n`;
      
      if (giveaway.minDepositAmount) {
        message += `💳 <b>Минимальный депозит:</b> ${giveaway.minDepositAmount} USDT\n`;
      }
      
      
      const drawTime = new Date(giveaway.drawDate).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      message += `⏰ <b>Розыгрыш:</b> ${drawTime} МСК\n\n`;
      message += `🎯 <b>Участвуйте в боте:</b> @Greenlightgames_bot\n`;
      message += `📋 <i>Для участия сделайте депозит ${giveaway.minDepositAmount || 1} USDT и нажмите "Участвовать" в профиле</i>`;

      // Если есть изображение приза, отправляем с фото
      if (giveaway.prize?.imageUrl) {
        return await this.sendPhoto(giveaway.prize.imageUrl, message);
      } else {
        return await this.sendMessage(message);
      }
    } catch (error) {
      console.error('Ошибка публикации анонса розыгрыша:', error);
      throw error;
    }
  }

  /**
   * Опубликовать результаты розыгрыша
   */
  async postGiveawayResults(giveaway, winners) {
    try {
      const emoji = giveaway.type === 'daily' ? '🏆' : giveaway.type === 'weekly' ? '💎' : '🎯';
      const typeText = giveaway.type === 'daily' ? 'ЕЖЕДНЕВНОГО' : giveaway.type === 'weekly' ? 'НЕДЕЛЬНОГО' : 'КАСТОМНОГО';
      
      let message = `${emoji} <b>РЕЗУЛЬТАТЫ ${typeText} РОЗЫГРЫША</b>\n\n`;
      
      if (giveaway.prize) {
        message += `🎁 <b>Приз:</b> ${giveaway.prize.name}\n`;
        if (giveaway.prize.value) {
          message += `💰 <b>Ценность:</b> ${giveaway.prize.value} USDT\n`;
        }
      }
      
      message += `\n👥 <b>Участников:</b> ${giveaway.participationCount || 0}\n`;
      
      if (winners && winners.length > 0) {
        message += `\n🏆 <b>ПОБЕДИТЕЛИ:</b>\n`;
        winners.forEach((winner, index) => {
          const place = index + 1;
          const userName = winner.user?.firstName || winner.user?.username || 'Пользователь';
          message += `${place}. ${userName}\n`;
        });
        
        message += `\n🎉 <b>Поздравляем победителей!</b>\n`;
        message += `💌 Призы будут отправлены в личных сообщениях бота\n\n`;
      } else {
        message += `\n😔 <b>Участников не было</b>\n`;
        message += `🔄 Приз переносится на следующий розыгрыш\n\n`;
      }
      
      message += `🎯 <b>Участвуйте в новых розыгрышах:</b> @Greenlightgames_bot`;

      // Если есть изображение приза, отправляем с фото
      if (giveaway.prize?.imageUrl) {
        return await this.sendPhoto(giveaway.prize.imageUrl, message);
      } else {
        return await this.sendMessage(message);
      }
    } catch (error) {
      console.error('Ошибка публикации результатов розыгрыша:', error);
      throw error;
    }
  }

  /**
   * Опубликовать напоминание о розыгрыше
   */
  async postGiveawayReminder(giveaway, participantsCount) {
    try {
      const emoji = giveaway.type === 'daily' ? '🏆' : giveaway.type === 'weekly' ? '💎' : '🎯';
      const typeText = giveaway.type === 'daily' ? 'ЕЖЕДНЕВНОГО' : giveaway.type === 'weekly' ? 'НЕДЕЛЬНОГО' : 'КАСТОМНОГО';
      
      let message = `⏰ <b>НАПОМИНАНИЕ О ${typeText} РОЗЫГРЫШЕ</b>\n\n`;
      
      if (giveaway.prize) {
        message += `🎁 <b>Приз:</b> ${giveaway.prize.name}\n`;
        if (giveaway.prize.description) {
          message += `📝 ${giveaway.prize.description}\n`;
        }
        if (giveaway.prize.value) {
          message += `💰 <b>Ценность:</b> ${giveaway.prize.value} USDT\n`;
        }
      }
      
      message += `\n👥 <b>Победителей:</b> ${giveaway.winnersCount}\n`;
      
      if (giveaway.minDepositAmount) {
        message += `💳 <b>Минимальный депозит:</b> ${giveaway.minDepositAmount} USDT\n`;
      }
      
      const now = new Date();
      const drawDate = new Date(giveaway.drawDate);
      const timeLeft = Math.max(0, Math.floor((drawDate - now) / (1000 * 60 * 60)));
      
      message += `⏰ <b>До розыгрыша:</b> ${timeLeft} часов\n`;
      message += `👥 <b>Участников:</b> ${participantsCount}\n\n`;
      
      message += `🚨 <b>УСПЕЙ ПРИНЯТЬ УЧАСТИЕ!</b>\n`;
      message += `🎯 <b>Участвуйте в боте:</b> @Greenlightgames_bot\n`;
      message += `📋 <i>Для участия сделайте депозит ${giveaway.minDepositAmount || 1} USDT и нажмите "Участвовать" в профиле</i>`;

      // Если есть изображение приза, отправляем с фото
      if (giveaway.prize?.imageUrl) {
        return await this.sendPhoto(giveaway.prize.imageUrl, message);
      } else {
        return await this.sendMessage(message);
      }
    } catch (error) {
      console.error('Ошибка публикации напоминания о розыгрыше:', error);
      throw error;
    }
  }

  /**
   * Проверить подключение к каналу
   */
  async checkChannelAccess() {
    try {
      if (!this.channelId) {
        return { success: false, error: 'TELEGRAM_CHANNEL_ID не настроен' };
      }

      const response = await axios.post(`${this.baseUrl}/getChat`, {
        chat_id: this.channelId
      });

      return { 
        success: true, 
        channel: response.data.result 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.description || error.message 
      };
    }
  }
}

module.exports = new TelegramChannelService();