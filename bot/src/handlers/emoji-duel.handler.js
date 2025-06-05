// emoji-duel.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчики для PvP дуэлей через эмодзи
 */
function registerEmojiDuelHandlers(bot) {
  
  // Обработка упоминания бота в группах для дуэлей
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message.text;
      const botUsername = ctx.botInfo.username;
      
      // Проверяем упоминание бота в группах/каналах
      if (ctx.chat.type !== 'private' && text.includes(`@${botUsername}`)) {
        
        // Парсим команду дуэли: @bot duel @username 50 🎲 bo3
        const duelMatch = text.match(/@\w+\s+duel\s+@(\w+)\s+(\d+)\s*(🎲|🎯|⚽|🏀|🎰|🎳)?\s*(bo\d+)?/i);
        
        if (duelMatch) {
          const opponentUsername = duelMatch[1];
          const amount = parseInt(duelMatch[2]);
          const gameType = duelMatch[3] || '🎲';
          const format = duelMatch[4] || 'bo1';
          
          // Валидация суммы
          if (amount < 1 || amount > 1000) {
            await ctx.reply('❌ Сумма должна быть от 1 до 1000 USDT');
            return;
          }
          
          // Определяем количество побед для формата
          const winsRequired = getWinsRequired(format);
          
          // Создаем кнопки для дуэли
          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(`✅ Принять ${gameType}`, `emoji_accept_${ctx.from.id}_${amount}_${gameType}_${format}`),
              Markup.button.callback('❌ Отклонить', `emoji_decline_${ctx.from.id}`)
            ]
          ]);
          
          await ctx.reply(
            `${gameType} **ВЫЗОВ НА ДУЭЛЬ** ${gameType}\n\n` +
            `👤 @${ctx.from.username} вызывает @${opponentUsername}!\n` +
            `💰 Ставка: ${amount} USDT (за всю серию)\n` +
            `🎮 Игра: ${getGameName(gameType)}\n` +
            `🏆 Формат: ${format.toUpperCase()} (до ${winsRequired} побед)\n` +
            `⏱ Вызов действителен 5 минут`,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            }
          );
        }
      }
    } catch (error) {
      console.error('Ошибка обработки упоминания:', error);
    }
  });
  
  // Обработка принятия эмодзи дуэли
  bot.action(/^emoji_accept_(\d+)_(\d+)_(🎲|🎯|⚽|🏀|🎰|🎳)_(bo\d+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const amount = parseInt(ctx.match[2]);
      const gameType = ctx.match[3];
      const format = ctx.match[4];
      const opponentId = ctx.from.id.toString();
      
      // Проверяем, что это не тот же пользователь
      if (challengerId === opponentId) {
        await ctx.answerCbQuery('❌ Нельзя принять свой собственный вызов', true);
        return;
      }
      
      await ctx.answerCbQuery('⏳ Создаем дуэль...');
      
      // Извлекаем username из сообщения
      const messageText = ctx.callbackQuery.message.text;
      const challengerMatch = messageText.match(/@(\w+)\s+вызывает/);
      const challengerUsername = challengerMatch ? challengerMatch[1] : 'Unknown';
      
      // Создаем дуэль через API
      const duelData = await apiService.createPvPChallenge({
        challengerId,
        challengerUsername,
        opponentId,
        opponentUsername: ctx.from.username,
        amount,
        gameType,
        format,
        winsRequired: getWinsRequired(format),
        chatId: ctx.chat.id.toString(),
        chatType: ctx.chat.type,
        messageId: ctx.callbackQuery.message.message_id
      });
      
      // Сразу принимаем дуэль
      const response = await apiService.respondToPvPChallenge(
        duelData.data.duelId,
        opponentId,
        'accept'
      );
      
      // Обновляем сообщение
      await ctx.editMessageText(
        `${gameType} **ДУЭЛЬ ПРИНЯТА!** ${gameType}\n\n` +
        `⚔️ @${challengerUsername} VS @${ctx.from.username}\n` +
        `💰 Банк: ${amount * 2} USDT\n` +
        `🏆 Формат: ${format.toUpperCase()}\n\n` +
        `🎮 Начинаем через 3 секунды...`,
        { parse_mode: 'Markdown' }
      );
      
      // Запускаем игру через 3 секунды
      setTimeout(async () => {
        await startEmojiDuel(ctx, duelData.data, gameType);
      }, 3000);
      
    } catch (error) {
      console.error('Ошибка принятия дуэли:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });
  
  // Обработка отклонения эмодзи дуэли
  bot.action(/^emoji_decline_(\d+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      
      await ctx.answerCbQuery('❌ Дуэль отклонена');
      
      await ctx.editMessageText(
        `❌ **ДУЭЛЬ ОТКЛОНЕНА** ❌\n\n` +
        `@${ctx.from.username} отклонил(а) вызов`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Ошибка отклонения дуэли:', error);
    }
  });
  
  // Обработка реванша
  bot.action(/^emoji_rematch_(.+)$/, async (ctx) => {
    try {
      const oldSessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('⏳ Создаем реванш...');
      
      // Получаем данные старой дуэли
      const oldDuel = await apiService.getPvPSession(oldSessionId, userId);
      
      // Меняем местами игроков для реванша
      const isChallenger = oldDuel.data.challengerId === userId;
      const newChallenger = isChallenger ? oldDuel.data.opponentId : oldDuel.data.challengerId;
      const newChallengerUsername = isChallenger ? oldDuel.data.opponentUsername : oldDuel.data.challengerUsername;
      const newOpponent = isChallenger ? oldDuel.data.challengerId : oldDuel.data.opponentId;
      const newOpponentUsername = isChallenger ? oldDuel.data.challengerUsername : oldDuel.data.opponentUsername;
      
      // Создаем новую дуэль
      const newDuel = await apiService.createPvPChallenge({
        challengerId: newChallenger,
        challengerUsername: newChallengerUsername,
        opponentId: newOpponent,
        opponentUsername: newOpponentUsername,
        amount: oldDuel.data.amount,
        gameType: oldDuel.data.gameType,
        format: oldDuel.data.format,
        winsRequired: oldDuel.data.winsRequired,
        chatId: ctx.chat.id.toString(),
        chatType: ctx.chat.type,
        messageId: ctx.callbackQuery.message.message_id
      });
      
      await ctx.reply(
        `🔄 **РЕВАНШ!** 🔄\n\n` +
        `@${newChallengerUsername} вызывает @${newOpponentUsername} на реванш!\n` +
        `💰 Ставка: ${oldDuel.data.amount} USDT\n` +
        `🎮 Игра: ${getGameName(oldDuel.data.gameType)}\n` +
        `🏆 Формат: ${oldDuel.data.format.toUpperCase()}`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Принять реванш', `emoji_accept_${newChallenger}_${oldDuel.data.amount}_${oldDuel.data.gameType}_${oldDuel.data.format}`),
              Markup.button.callback('❌ Отклонить', `emoji_decline_${newChallenger}`)
            ]
          ])
        }
      );
      
    } catch (error) {
      console.error('Ошибка создания реванша:', error);
      await ctx.answerCbQuery('❌ Не удалось создать реванш', true);
    }
  });
}

/**
 * Запуск эмодзи дуэли
 */
async function startEmojiDuel(ctx, duelData, gameType) {
  try {
    const sessionId = duelData.sessionId;
    let currentRound = 0;
    let score = { challenger: 0, opponent: 0 };
    
    // Функция для игры одного раунда
    async function playRound() {
      currentRound++;
      
      await ctx.reply(
        `${gameType} **РАУНД ${currentRound}** ${gameType}\n` +
        `📊 Счет: ${score.challenger}-${score.opponent}`,
        { parse_mode: 'Markdown' }
      );
      
      // Отправляем эмодзи для первого игрока
      await ctx.reply(`@${duelData.challengerUsername} бросает...`);
      const result1 = await ctx.replyWithDice({ emoji: gameType });
      const value1 = result1.dice.value;
      
      // Пауза между бросками
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Отправляем эмодзи для второго игрока
      await ctx.reply(`@${duelData.opponentUsername} бросает...`);
      const result2 = await ctx.replyWithDice({ emoji: gameType });
      const value2 = result2.dice.value;
      
      // Пауза для анимации
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Определяем победителя раунда в зависимости от типа игры
      let roundWinner;
      const roundResult = determineRoundWinner(gameType, value1, value2);
      
      if (roundResult === 'player1') {
        roundWinner = 'challenger';
        score.challenger++;
        await ctx.reply(`✅ Раунд выиграл @${duelData.challengerUsername}! ${getResultText(gameType, value1, value2)}`);
      } else if (roundResult === 'player2') {
        roundWinner = 'opponent';
        score.opponent++;
        await ctx.reply(`✅ Раунд выиграл @${duelData.opponentUsername}! ${getResultText(gameType, value1, value2)}`);
      } else {
        await ctx.reply(`🤝 Ничья! ${getResultText(gameType, value1, value2)} Переигрываем...`);
        setTimeout(() => playRound(), 2000);
        return;
      }
      
      // Сохраняем результат раунда через API
      await apiService.saveDuelRound(sessionId, {
        round: currentRound,
        challengerResult: value1,
        opponentResult: value2,
        winnerId: roundWinner === 'challenger' ? duelData.challengerId : duelData.opponentId
      });
      
      // Проверяем, есть ли победитель серии
      if (score.challenger >= duelData.winsRequired) {
        await finishDuel(ctx, duelData, 'challenger', score);
      } else if (score.opponent >= duelData.winsRequired) {
        await finishDuel(ctx, duelData, 'opponent', score);
      } else {
        // Играем следующий раунд
        setTimeout(() => playRound(), 3000);
      }
    }
    
    // Начинаем первый раунд
    await playRound();
    
  } catch (error) {
    console.error('Ошибка в эмодзи дуэли:', error);
    await ctx.reply('❌ Произошла ошибка во время игры');
  }
}

/**
 * Завершение дуэли
 */
async function finishDuel(ctx, duelData, winner, score) {
  try {
    const winnerId = winner === 'challenger' ? duelData.challengerId : duelData.opponentId;
    const winnerUsername = winner === 'challenger' ? duelData.challengerUsername : duelData.opponentUsername;
    const loserId = winner === 'challenger' ? duelData.opponentId : duelData.challengerId;
    const loserUsername = winner === 'challenger' ? duelData.opponentUsername : duelData.challengerUsername;
    
    // Завершаем дуэль через API
    const result = await apiService.finishPvPDuel(duelData.sessionId, winnerId);
    
    // Отправляем финальное сообщение
    await ctx.reply(
      `🏆 **ПОБЕДИТЕЛЬ ДУЭЛИ** 🏆\n\n` +
      `👑 @${winnerUsername} побеждает со счетом ${score.challenger}-${score.opponent}!\n` +
      `💰 Выигрыш: ${result.data.winAmount} USDT\n` +
      `😔 @${loserUsername} проигрывает ${duelData.amount} USDT\n\n` +
      `🎮 GG WP!`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Реванш', `emoji_rematch_${duelData.sessionId}`)]
        ])
      }
    );
    
  } catch (error) {
    console.error('Ошибка завершения дуэли:', error);
  }
}

/**
 * Вспомогательные функции
 */
function getWinsRequired(format) {
  const formats = {
    'bo1': 1,
    'bo3': 2,
    'bo5': 3,
    'bo7': 4,
    'bo9': 5
  };
  return formats[format] || 1;
}

function getGameName(gameType) {
  const games = {
    '🎲': 'Кости',
    '🎯': 'Дартс',
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎰': 'Слоты',
    '🎳': 'Боулинг'
  };
  return games[gameType] || 'Игра';
}

/**
 * Определяет победителя раунда в зависимости от типа игры
 */
function determineRoundWinner(gameType, value1, value2) {
  switch (gameType) {
    case '🎲': // Кости - больше значение побеждает
    case '🎳': // Боулинг - больше кеглей побеждает
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '🎯': // Дартс - попадание в центр (6) побеждает
      if (value1 === 6 && value2 !== 6) return 'player1';
      if (value2 === 6 && value1 !== 6) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '⚽': // Футбол - гол (4,5) побеждает
    case '🏀': // Баскетбол - попадание (4,5) побеждает
      const isGoal1 = value1 >= 4;
      const isGoal2 = value2 >= 4;
      if (isGoal1 && !isGoal2) return 'player1';
      if (isGoal2 && !isGoal1) return 'player2';
      if (isGoal1 && isGoal2) return 'draw';
      if (!isGoal1 && !isGoal2) return 'draw';
      break;
      
    case '🎰': // Слоты - выигрышные комбинации
      const isWin1 = value1 >= 1 && value1 <= 64; // Есть выигрыш
      const isWin2 = value2 >= 1 && value2 <= 64;
      if (isWin1 && !isWin2) return 'player1';
      if (isWin2 && !isWin1) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
  }
  
  return 'draw';
}

/**
 * Получает текст результата для разных типов игр
 */
function getResultText(gameType, value1, value2) {
  switch (gameType) {
    case '🎲':
      return `(${value1} vs ${value2})`;
      
    case '🎯':
      const dartResult1 = value1 === 6 ? 'Центр!' : `${value1} очков`;
      const dartResult2 = value2 === 6 ? 'Центр!' : `${value2} очков`;
      return `(${dartResult1} vs ${dartResult2})`;
      
    case '⚽':
      const goal1 = value1 >= 4 ? 'ГОЛ!' : 'Мимо';
      const goal2 = value2 >= 4 ? 'ГОЛ!' : 'Мимо';
      return `(${goal1} vs ${goal2})`;
      
    case '🏀':
      const basket1 = value1 >= 4 ? 'Попал!' : 'Мимо';
      const basket2 = value2 >= 4 ? 'Попал!' : 'Мимо';
      return `(${basket1} vs ${basket2})`;
      
    case '🎰':
      const slot1 = value1 >= 1 && value1 <= 64 ? 'Выигрыш!' : 'Проигрыш';
      const slot2 = value2 >= 1 && value2 <= 64 ? 'Выигрыш!' : 'Проигрыш';
      return `(${slot1} vs ${slot2})`;
      
    case '🎳':
      return `(${value1} кеглей vs ${value2} кеглей)`;
      
    default:
      return `(${value1} vs ${value2})`;
  }
}

module.exports = {
  registerEmojiDuelHandlers
};