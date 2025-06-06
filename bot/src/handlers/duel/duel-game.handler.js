// bot/src/handlers/duel/duel-game.handler.js

const { getGameConfig, getFormatConfig, formatRoundResults, getTelegramDiceEmoji } = require('./duel-utils');
const apiService = require('../../services/api.service');

/**
 * Общая логика игры в дуэли
 */
class DuelGameHandler {
  
  constructor() {
    // Защита от race conditions - отслеживаем активные ходы
    this.activeMoves = new Set();
  }
  
  /**
   * Выполнение хода в дуэли
   */
  async makeMove(ctx, sessionId, userId, username) {
    // Защита от race conditions
    const moveKey = `${sessionId}_${userId}`;
    
    if (this.activeMoves.has(moveKey)) {
      await ctx.answerCbQuery('⏳ Ход уже выполняется, подождите...');
      return null;
    }
    
    this.activeMoves.add(moveKey);
    
    try {
      // Получаем данные дуэли
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (!duelData.success) {
        await ctx.answerCbQuery('❌ Ошибка получения данных дуэли');
        return null;
      }
      
      const duel = duelData.data;
      
      const gameConfig = getGameConfig(duel.gameType);
      const telegramEmoji = getTelegramDiceEmoji(duel.gameType);
      
      await ctx.answerCbQuery(`${gameConfig.emoji} ${gameConfig.processText}`);
      
      // Отправляем соответствующий Telegram dice с правильным эмодзи
      let diceMessage;
      
      try {
        // Основной способ: replyWithDice с emoji в опциях
        diceMessage = await ctx.replyWithDice({ emoji: telegramEmoji });
      } catch (error) {
        console.error('Ошибка отправки dice с emoji:', error);
        // Fallback на базовые кости если эмодзи не поддерживается
        diceMessage = await ctx.replyWithDice();
      }
      let gameResult = diceMessage.dice.value;
      
      // Корректируем результат для игр с ограниченным диапазоном
      if (gameResult > gameConfig.maxValue) {
        gameResult = gameConfig.maxValue;
      }
      
      // Сохраняем результат в API
      const roundData = {
        userId,
        username,
        gameType: duel.gameType,
        result: gameResult,
        timestamp: Date.now()
      };
      
      const saveResult = await apiService.saveDuelRound(sessionId, roundData);
      
      if (!saveResult.success) {
        console.error('Ошибка сохранения хода:', saveResult.error);
        return null;
      }
      
      // Получаем обновленные данные дуэли
      const updatedDuelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (updatedDuelData.success) {
        return {
          duel: updatedDuelData.data,
          gameResult,
          gameConfig
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Ошибка выполнения хода в дуэли:', sessionId, error.message);
      await ctx.answerCbQuery('❌ Ошибка выполнения хода');
      return null;
    } finally {
      // Обязательно освобождаем блокировку
      this.activeMoves.delete(moveKey);
    }
  }
  
  /**
   * Проверка завершения дуэли и форматирование результата
   */
  formatGameResult(duel, gameResult, gameConfig, currentUserId, currentUsername) {
    const isCompleted = duel.status === 'completed';
    const opponentId = duel.challengerId === currentUserId ? duel.opponentId : duel.challengerId;
    const opponentUsername = duel.challengerId === currentUserId ? duel.opponentUsername : duel.challengerUsername;
    
    if (isCompleted) {
      // Дуэль завершена
      const isWinner = duel.winnerId === currentUserId;
      const winnerUsername = duel.winnerId === currentUserId ? currentUsername : opponentUsername;
      const roundsText = formatRoundResults(duel.rounds, duel.challengerUsername, duel.opponentUsername);
      
      return {
        isCompleted: true,
        isWinner,
        message: `🏆 **ДУЭЛЬ ЗАВЕРШЕНА!** 🏆\n\n` +
                `${isWinner ? '🎉 **ПОЗДРАВЛЯЕМ!**' : '😢 **К СОЖАЛЕНИЮ...**'}\n\n` +
                `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
                `📊 Финальный счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
                `👑 Победитель: @${winnerUsername}\n` +
                `💰 Выигрыш: ${duel.winAmount} USDT\n\n` +
                `🎯 Ваш результат: **${gameResult}**\n\n` +
                `${roundsText}\n` +
                `📋 ID дуэли: \`${duel.sessionId}\``,
        opponentId,
        opponentUsername,
        roundsText
      };
    } else {
      // Дуэль продолжается
      const formatConfig = getFormatConfig(duel.format);
      
      return {
        isCompleted: false,
        message: `${gameConfig.emoji} **${gameConfig.resultText}**\n\n` +
                `🎯 Ваш результат: **${gameResult}**\n` +
                `📊 Текущий счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
                `🏆 Играем до: ${formatConfig.winsRequired} ${formatConfig.winsRequired === 1 ? 'победы' : 'побед'}\n` +
                `📋 Сессия: \`${duel.sessionId}\`\n\n` +
                `⏳ Ожидание хода противника...`,
        opponentId,
        opponentUsername
      };
    }
  }
  
  /**
   * Уведомление противника о ходе/завершении
   */
  async notifyOpponent(ctx, opponentId, duel, gameConfig, isCompleted, roundsText = '') {
    try {
      if (isCompleted) {
        // Уведомление о завершении дуэли
        const isOpponentWinner = duel.winnerId === opponentId;
        const winnerUsername = isOpponentWinner ? duel.opponentUsername : duel.challengerUsername;
        
        await ctx.telegram.sendMessage(
          opponentId,
          `🏆 **ДУЭЛЬ ЗАВЕРШЕНА!** 🏆\n\n` +
          `${isOpponentWinner ? '🎉 **ПОЗДРАВЛЯЕМ!**' : '😢 **К СОЖАЛЕНИЮ...**'}\n\n` +
          `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
          `📊 Финальный счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
          `👑 Победитель: @${winnerUsername}\n` +
          `💰 Выигрыш: ${duel.winAmount} USDT\n\n` +
          `${roundsText}\n` +
          `📋 ID дуэли: \`${duel.sessionId}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Уведомление о ходе противника
        const formatConfig = getFormatConfig(duel.format);
        
        await ctx.telegram.sendMessage(
          opponentId,
          `🎯 **Противник сделал ход!**\n\n` +
          `${gameConfig.emoji} Игра: ${gameConfig.name}\n` +
          `📊 Текущий счёт: ${duel.challengerScore}:${duel.opponentScore}\n` +
          `🏆 Играем до: ${formatConfig.winsRequired} ${formatConfig.winsRequired === 1 ? 'победы' : 'побед'}\n\n` +
          `⏰ Ваш ход!`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Ошибка уведомления противника:', error.message);
    }
  }
  
  /**
   * Определение текущего игрока в очереди (для групповых дуэлей)
   */
  getCurrentPlayer(duel) {
    if (!duel.rounds || duel.rounds.length === 0) {
      // Первый раунд - ходит challenger
      return {
        currentPlayerId: duel.challengerId,
        currentPlayerUsername: duel.challengerUsername,
        isChallenger: true
      };
    }
    
    const currentRound = duel.rounds[duel.rounds.length - 1];
    
    // Если challenger еще не ходил
    if (currentRound.challengerResult === null) {
      return {
        currentPlayerId: duel.challengerId,
        currentPlayerUsername: duel.challengerUsername,
        isChallenger: true
      };
    }
    
    // Если opponent еще не ходил
    if (currentRound.opponentResult === null) {
      return {
        currentPlayerId: duel.opponentId,
        currentPlayerUsername: duel.opponentUsername,
        isChallenger: false
      };
    }
    
    // Оба походили - раунд завершен, нужен новый раунд
    return {
      currentPlayerId: duel.challengerId,
      currentPlayerUsername: duel.challengerUsername,
      isChallenger: true
    };
  }
  
  /**
   * Проверка может ли игрок сделать ход
   */
  canPlayerMove(duel, userId) {
    const currentPlayer = this.getCurrentPlayer(duel);
    return currentPlayer.currentPlayerId === userId;
  }
}

module.exports = new DuelGameHandler();