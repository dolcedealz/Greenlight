// bot/src/handlers/duel/duel-game.handler.js

const { getGameConfig, getFormatConfig, formatRoundResults, getTelegramDiceEmoji } = require('./duel-utils');
const apiService = require('../../services/api.service');

/**
 * Общая логика игры в дуэли
 */
class DuelGameHandler {
  
  /**
   * Выполнение хода в дуэли
   */
  async makeMove(ctx, sessionId, userId, username) {
    try {
      // Получаем данные дуэли
      const duelData = await apiService.getDuelData(sessionId, userId, ctx.from);
      
      if (!duelData.success) {
        await ctx.answerCbQuery('❌ Ошибка получения данных дуэли');
        return null;
      }
      
      const duel = duelData.data;
      
      // DEBUG: Логируем полученные данные дуэли
      console.log('🔍 DEBUG: Полученные данные дуэли:', {
        sessionId: duel.sessionId,
        gameType: duel.gameType,
        format: duel.format,
        status: duel.status,
        challengerId: duel.challengerId,
        opponentId: duel.opponentId,
        duelKeys: Object.keys(duel),
        fullDuel: JSON.stringify(duel, null, 2)
      });
      
      const gameConfig = getGameConfig(duel.gameType);
      const telegramEmoji = getTelegramDiceEmoji(duel.gameType);
      
      console.log(`🎲 DEBUG DICE: Используем gameType="${duel.gameType}" -> display="${gameConfig.emoji}" -> telegram="${telegramEmoji}" (${gameConfig.name})`);
      console.log(`🔍 DEBUG DETAILED: gameType bytes=[${Array.from(duel.gameType).map(c => c.charCodeAt(0)).join(',')}], telegramEmoji bytes=[${Array.from(telegramEmoji).map(c => c.charCodeAt(0)).join(',')}]`);
      
      await ctx.answerCbQuery(`${gameConfig.emoji} ${gameConfig.processText}`);
      
      // Отправляем соответствующий Telegram dice
      // ВАЖНО: replyWithDice принимает базовый emoji без variation selector
      
      // Дополнительная проверка для футбола
      if (telegramEmoji === '⚽') {
        console.log(`🔍 FOOTBALL CHECK: Отправляем именно футбольный dice ⚽`);
        console.log(`🔍 gameType was: "${duel.gameType}", converted to: "${telegramEmoji}"`);
      }
      
      // Попробуем разные способы отправки dice
      console.log(`🚀 TRYING: ctx.replyWithDice("${telegramEmoji}")`);
      let diceMessage;
      
      try {
        // Способ 1: Через replyWithDice с emoji в опциях
        diceMessage = await ctx.replyWithDice({ emoji: telegramEmoji });
        console.log(`✅ SUCCESS: replyWithDice с emoji в опциях`);
      } catch (error) {
        console.log(`❌ FAILED: replyWithDice с emoji в опциях:`, error.message);
        
        try {
          // Способ 2: Через прямой вызов sendDice API
          diceMessage = await ctx.telegram.sendDice(ctx.chat.id, telegramEmoji);
          console.log(`✅ SUCCESS: sendDice с emoji как второй параметр`);
        } catch (error2) {
          console.log(`❌ FAILED: sendDice как второй параметр:`, error2.message);
          
          try {
            // Способ 3: Через sendDice с объектом
            diceMessage = await ctx.telegram.sendDice(ctx.chat.id, { emoji: telegramEmoji });
            console.log(`✅ SUCCESS: sendDice с emoji объектом`);
          } catch (error3) {
            console.log(`❌ FAILED: sendDice с emoji объектом:`, error3.message);
            
            // Способ 4: Fallback на базовый replyWithDice (всегда кости)
            diceMessage = await ctx.replyWithDice();
            console.log(`⚠️ FALLBACK: базовый replyWithDice без параметров - всегда кости!`);
          }
        }
      }
      console.log(`🎲 DEBUG DICE: Отправлен ${telegramEmoji}, получен результат ${diceMessage.dice.value}`);
      console.log(`🔍 DICE OBJECT:`, JSON.stringify(diceMessage.dice, null, 2));
      let gameResult = diceMessage.dice.value;
      
      // Корректируем результат для игр с ограниченным диапазоном
      if (gameResult > gameConfig.maxValue) {
        gameResult = gameConfig.maxValue;
        console.log(`🔧 Результат ${diceMessage.dice.value} обрезан до ${gameResult} для игры ${duel.gameType}`);
      }
      
      console.log(`🎮 Игрок ${username} (${userId}) сыграл ${duel.gameType}: ${gameResult} в дуэли ${sessionId}`);
      
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
      console.error('Ошибка выполнения хода:', error);
      await ctx.answerCbQuery('❌ Ошибка выполнения хода');
      return null;
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