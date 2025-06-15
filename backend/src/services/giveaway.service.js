// backend/src/services/giveaway.service.js
const { 
  Giveaway, 
  GiveawayParticipation, 
  User 
} = require('../models');
const crypto = require('crypto');
const TelegramService = require('./telegram.service');

class GiveawayService {
  constructor() {
    this.telegramService = new TelegramService();
  }

  /**
   * Автоматический выбор победителей для розыгрыша
   */
  async conductAutomaticGiveaway(giveawayId) {
    try {
      console.log(`Проведение автоматического розыгрыша: ${giveawayId}`);

      const giveaway = await Giveaway.findById(giveawayId)
        .populate('prize');

      if (!giveaway) {
        throw new Error('Розыгрыш не найден');
      }

      if (giveaway.status !== 'active') {
        throw new Error('Розыгрыш не активен');
      }

      // Получаем всех участников
      const participants = await GiveawayParticipation.find({
        giveaway: giveawayId
      }).populate('user', 'firstName lastName username telegramId');

      if (participants.length === 0) {
        console.log(`Розыгрыш ${giveawayId}: нет участников`);
        // Переносим розыгрыш или отменяем
        await this.postponeOrCancelGiveaway(giveaway);
        return { success: false, message: 'Нет участников' };
      }

      if (participants.length < giveaway.winnersCount) {
        console.log(`Розыгрыш ${giveawayId}: недостаточно участников (${participants.length}/${giveaway.winnersCount})`);
        // Уменьшаем количество победителей или переносим
        return await this.handleInsufficientParticipants(giveaway, participants);
      }

      // Получаем случайное число от Telegram (бросок кубика)
      const diceResult = await this.telegramService.rollDice();
      
      // Используем результат кубика как seed для генератора
      const seed = this.generateSeedFromDice(diceResult, participants.length);
      const winners = this.selectWinners(participants, giveaway.winnersCount, seed);

      // Обновляем базу данных
      await this.updateGiveawayResults(giveaway, winners, diceResult);

      // Публикуем результаты в Telegram канале
      await this.publishResultsToChannel(giveaway, winners, participants.length, diceResult);

      // Отправляем уведомления победителям
      await this.notifyWinners(winners, giveaway);

      console.log(`Розыгрыш ${giveawayId} успешно проведен`);
      return { 
        success: true, 
        winners: winners.map(w => ({
          user: w.user,
          position: w.position,
          participationNumber: w.participationNumber
        }))
      };

    } catch (error) {
      console.error(`Ошибка при проведении розыгрыша ${giveawayId}:`, error);
      throw error;
    }
  }

  /**
   * Генерация seed на основе результата кубика
   */
  generateSeedFromDice(diceResult, participantsCount) {
    const diceValue = diceResult.value;
    const timestamp = Date.now();
    const seedString = `${diceValue}-${timestamp}-${participantsCount}`;
    return crypto.createHash('sha256').update(seedString).digest('hex');
  }

  /**
   * Выбор победителей на основе seed
   */
  selectWinners(participants, winnersCount, seed) {
    // Создаем детерминированный генератор случайных чисел
    const random = this.createSeededRandom(seed);
    const winners = [];
    const availableParticipants = [...participants];

    for (let i = 0; i < winnersCount && availableParticipants.length > 0; i++) {
      const randomIndex = Math.floor(random() * availableParticipants.length);
      const winner = availableParticipants.splice(randomIndex, 1)[0];
      
      winners.push({
        user: winner.user,
        position: i + 1,
        participationNumber: winner.participationNumber,
        selectedAt: new Date()
      });
    }

    return winners;
  }

  /**
   * Создание детерминированного генератора случайных чисел
   */
  createSeededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return function() {
      hash = ((hash * 9301) + 49297) % 233280;
      return hash / 233280;
    };
  }

  /**
   * Обновление результатов розыгрыша в базе данных
   */
  async updateGiveawayResults(giveaway, winners, diceResult) {
    // Обновляем розыгрыш
    giveaway.winners = winners.map(w => ({
      user: w.user._id,
      position: w.position,
      selectedAt: w.selectedAt
    }));
    giveaway.status = 'completed';
    giveaway.diceResult = diceResult;
    await giveaway.save();

    // Обновляем участия
    for (const winner of winners) {
      await GiveawayParticipation.findOneAndUpdate(
        { 
          giveaway: giveaway._id, 
          user: winner.user._id 
        },
        {
          isWinner: true,
          winnerPosition: winner.position,
          status: 'winner'
        }
      );
    }

    // Обновляем остальных участников
    await GiveawayParticipation.updateMany(
      { 
        giveaway: giveaway._id, 
        isWinner: false 
      },
      { status: 'not_winner' }
    );
  }

  /**
   * Публикация результатов в Telegram канале
   */
  async publishResultsToChannel(giveaway, winners, totalParticipants, diceResult) {
    try {
      const message = this.formatResultsMessage(giveaway, winners, totalParticipants, diceResult);
      const messageId = await this.telegramService.sendToChannel(message);
      
      // Сохраняем ID сообщения в розыгрыше
      giveaway.telegramMessageId = messageId;
      await giveaway.save();

    } catch (error) {
      console.error('Ошибка публикации результатов в канале:', error);
      // Не прерываем процесс, если не удалось опубликовать
    }
  }

  /**
   * Форматирование сообщения с результатами
   */
  formatResultsMessage(giveaway, winners, totalParticipants, diceResult) {
    const prizeEmoji = giveaway.prize?.type === 'telegram_gift' ? '🎁' : '🏆';
    const typeText = giveaway.type === 'daily' ? 'Ежедневный' : giveaway.type === 'weekly' ? 'Недельный' : 'Кастомный';
    
    let message = `${prizeEmoji} <b>${typeText} розыгрыш завершен!</b>\n\n`;
    message += `🎯 <b>Приз:</b> ${giveaway.prize?.name || 'Не указан'}\n`;
    message += `👥 <b>Участников:</b> ${totalParticipants}\n`;
    message += `🎲 <b>Результат кубика:</b> ${diceResult.value}\n\n`;
    
    message += `🏆 <b>Победители:</b>\n`;
    winners.forEach((winner, index) => {
      const userName = winner.user.firstName + (winner.user.lastName ? ` ${winner.user.lastName}` : '');
      message += `${index + 1}. ${userName} (участник #${winner.participationNumber})\n`;
    });

    message += `\n🎉 Поздравляем победителей!\n`;
    message += `📢 Следующий розыгрыш скоро!`;

    return message;
  }

  /**
   * Уведомление победителей
   */
  async notifyWinners(winners, giveaway) {
    for (const winner of winners) {
      try {
        const message = `🎉 Поздравляем! Вы выиграли в розыгрыше!\n\n` +
                       `🏆 Приз: ${giveaway.prize?.name}\n` +
                       `📍 Ваша позиция: ${winner.position}\n\n` +
                       `Свяжитесь с администрацией для получения приза.`;
        
        await this.telegramService.sendPrivateMessage(winner.user.telegramId, message);
      } catch (error) {
        console.error(`Ошибка отправки уведомления пользователю ${winner.user.telegramId}:`, error);
      }
    }
  }

  /**
   * Обработка недостаточного количества участников
   */
  async handleInsufficientParticipants(giveaway, participants) {
    // Если участников меньше, чем нужно победителей, но больше 0
    // Проводим розыгрыш с меньшим количеством победителей
    if (participants.length > 0) {
      const diceResult = await this.telegramService.rollDice();
      const seed = this.generateSeedFromDice(diceResult, participants.length);
      const winners = this.selectWinners(participants, participants.length, seed);

      await this.updateGiveawayResults(giveaway, winners, diceResult);
      await this.publishResultsToChannel(giveaway, winners, participants.length, diceResult);
      await this.notifyWinners(winners, giveaway);

      return { 
        success: true, 
        message: `Розыгрыш проведен с ${participants.length} победителями`,
        winners 
      };
    }

    return { success: false, message: 'Недостаточно участников' };
  }

  /**
   * Перенос или отмена розыгрыша
   */
  async postponeOrCancelGiveaway(giveaway) {
    // Логика переноса или отмены
    // Пока просто отменяем
    giveaway.status = 'cancelled';
    await giveaway.save();
  }

  /**
   * Получение розыгрышей, готовых к проведению
   */
  async getReadyGiveaways() {
    const now = new Date();
    
    return await Giveaway.find({
      status: 'active',
      drawDate: { $lte: now }
    }).populate('prize');
  }

  /**
   * Планирование автоматических розыгрышей
   */
  async scheduleAutomaticGiveaways() {
    try {
      const readyGiveaways = await this.getReadyGiveaways();
      
      for (const giveaway of readyGiveaways) {
        try {
          await this.conductAutomaticGiveaway(giveaway._id);
        } catch (error) {
          console.error(`Ошибка при проведении розыгрыша ${giveaway._id}:`, error);
        }
      }

      return readyGiveaways.length;
    } catch (error) {
      console.error('Ошибка при планировании автоматических розыгрышей:', error);
      throw error;
    }
  }
}

module.exports = GiveawayService;