// duel.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Улучшенная система дуэлей через эмоджи Telegram
 * Поддерживает все игры: 🎲🎯🏀⚽🎳🎰
 * Включает систему безопасности и финансовую логику
 */

// Константы безопасности (логика перенесена в Backend)
const CHALLENGE_TIMEOUT = 5 * 60 * 1000; // 5 минут
const MOVE_TIMEOUT = 60 * 1000; // 60 секунд на ход
const COOLDOWN_TIME = 30 * 1000; // 30 секунд между дуэлями
const MAX_ACTIVE_DUELS = 3; // максимум активных дуэлей на игрока
const MIN_BET = 1;
const MAX_BET = 1000;
const CASINO_COMMISSION = 0.05; // 5% комиссия

// Временное хранение для UI состояний (НЕ для бизнес-логики)
const pendingDuels = new Map(); // Только для callback кнопок

function registerDuelHandlers(bot) {
  
  // Команда /duel для групповых чатов
  bot.command('duel', async (ctx) => {
    try {
      if (ctx.chat.type === 'private') {
        await ctx.reply('❌ Команда /duel работает только в группах. Для личных чатов используйте инлайн-режим: @greenlight_bot duel');
        return;
      }

      const args = ctx.message.text.split(' ').slice(1);
      
      // Проверяем формат команды
      if (args.length < 2) {
        await ctx.reply(
          '📝 **Форматы команд:**\n\n' +
          '🔸 `/duel 50 🎲` - открытый вызов\n' +
          '🔸 `/duel @username 100 🎯 bo3` - персональный вызов\n' +
          '🔸 `/duel_help` - подробная справка',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let targetUser, amount, gameType, format;
      
      // Персональный вызов: /duel @username 100 🎲 bo3
      if (args[0].startsWith('@')) {
        targetUser = args[0].substring(1);
        amount = parseInt(args[1]);
        gameType = args[2] || '🎲';
        format = args[3] || 'bo1';
      } else {
        // Открытый вызов: /duel 50 🎲 bo3
        amount = parseInt(args[0]);
        gameType = args[1] || '🎲';
        format = args[2] || 'bo1';
      }

      // Валидация
      const validation = validateDuelRequest(ctx.from.id, amount, gameType, format);
      if (!validation.valid) {
        await ctx.reply(`❌ ${validation.error}`);
        return;
      }

      // Создаем дуэль
      await createDuelChallenge(ctx, targetUser, amount, gameType, format);
      
    } catch (error) {
      console.error('Ошибка команды /duel:', error);
      await ctx.reply('❌ Произошла ошибка при создании дуэли');
    }
  });

  // Команды справки и статистики
  bot.command('duel_help', async (ctx) => {
    await ctx.reply(
      '🎮 **СПРАВКА ПО ДУЭЛЯМ** 🎮\n\n' +
      '**Доступные игры:**\n' +
      '🎲 Кости - у кого больше\n' +
      '🎯 Дартс - точность (6 = центр)\n' +
      '🏀 Баскетбол - попадание (4-5 = гол)\n' +
      '⚽ Футбол - забить гол (3-5 = гол)\n' +
      '🎳 Боулинг - больше кеглей\n' +
      '🎰 Слоты - лучшая комбинация\n\n' +
      '**Форматы:**\n' +
      '• Bo1 - один раунд\n' +
      '• Bo3 - до 2 побед\n' +
      '• Bo5 - до 3 побед\n' +
      '• Bo7 - до 4 побед\n\n' +
      '**Команды:**\n' +
      '• `/duel 50 🎲` - открытый вызов\n' +
      '• `/duel @user 100 🎯 bo3` - персональный\n' +
      '• `/duel_stats` - моя статистика\n' +
      '• `/duel_history` - история дуэлей\n' +
      '• `/duel_cancel` - отменить активную дуэль\n\n' +
      '**Лимиты:**\n' +
      '• Ставка: 1-1000 USDT\n' +
      '• Комиссия: 5% с выигрыша\n' +
      '• Время на ответ: 5 минут\n' +
      '• Время на ход: 60 секунд\n' +
      '• Cooldown: 30 секунд между дуэлями',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('duel_stats', async (ctx) => {
    try {
      const stats = await apiService.getUserDuelStats(ctx.from.id);
      if (stats.success) {
        await ctx.reply(
          `📊 **СТАТИСТИКА ДУЭЛЕЙ** 📊\n\n` +
          `👤 @${ctx.from.username}\n` +
          `🏆 Побед: ${stats.data.wins}\n` +
          `😔 Поражений: ${stats.data.losses}\n` +
          `📈 Винрейт: ${((stats.data.wins / (stats.data.wins + stats.data.losses)) * 100 || 0).toFixed(1)}%\n` +
          `💰 Общий выигрыш: ${stats.data.totalWinnings} USDT\n` +
          `💸 Общий проигрыш: ${stats.data.totalLosses} USDT\n` +
          `🎮 Любимая игра: ${getGameName(stats.data.favoriteGame)}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      await ctx.reply('❌ Не удалось получить статистику');
    }
  });

  bot.command('duel_cancel', async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      const userDuels = await apiService.getUserActiveDuels(userId);
      
      if (userDuels.length === 0) {
        await ctx.reply('❌ У вас нет активных дуэлей для отмены');
        return;
      }

      // Отменяем все активные дуэли пользователя
      for (const duel of userDuels) {
        await apiService.cancelDuel(duel.sessionId, userId);
      }

      await ctx.reply(`✅ Отменено ${userDuels.length} активных дуэлей`);
      
    } catch (error) {
      console.error('Ошибка отмены дуэли:', error);
      await ctx.reply('❌ Произошла ошибка при отмене дуэли');
    }
  });

  // Обработка упоминания бота в группах (инлайн-дуэли)
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message.text;
      const botUsername = ctx.botInfo.username;
      
      // Проверяем упоминание бота в группах/каналах
      if (ctx.chat.type !== 'private' && text.includes(`@${botUsername}`)) {
        
        // Парсим инлайн команду дуэли: @bot duel @username 50 🎲 bo3
        const duelMatch = text.match(/@\w+\s+duel\s+@(\w+)\s+(\d+)\s*(🎲|🎯|⚽|🏀|🎰|🎳)?\s*(bo\d+)?/i);
        
        if (duelMatch) {
          const opponentUsername = duelMatch[1];
          const amount = parseInt(duelMatch[2]);
          const gameType = duelMatch[3] || '🎲';
          const format = duelMatch[4] || 'bo1';
          
          // Валидация
          const validation = validateDuelRequest(ctx.from.id, amount, gameType, format);
          if (!validation.valid) {
            await ctx.reply(`❌ ${validation.error}`);
            return;
          }
          
          await createDuelChallenge(ctx, opponentUsername, amount, gameType, format);
        }
      }
    } catch (error) {
      console.error('Ошибка обработки упоминания:', error);
    }
  });

  // Обработка принятия дуэли
  bot.action(/^duel_accept_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();
      
      await ctx.answerCbQuery('⏳ Принимаем дуэль...');
      
      // Принимаем дуэль через Backend API
      const response = await apiService.acceptDuel(sessionId, userId);
      
      if (!response.success) {
        await ctx.answerCbQuery(`❌ ${response.error}`, true);
        return;
      }

      // Получаем обновленные данные дуэли
      const duelInfo = await apiService.getDuelData(sessionId, userId);
      if (!duelInfo.success) {
        await ctx.answerCbQuery('❌ Ошибка получения данных дуэли', true);
        return;
      }
      
      const duel = duelInfo.data;

      // Обновляем сообщение
      await ctx.editMessageText(
        `${duel.gameType} **ДУЭЛЬ ПРИНЯТА!** ${duel.gameType}\n\n` +
        `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}\n` +
        `💰 Банк: ${duel.amount * 2} USDT\n` +
        `🏆 Формат: ${duel.format.toUpperCase()}\n` +
        `🎮 Игра: ${getGameName(duel.gameType)}\n\n` +
        `🚀 Начинаем через 3 секунды...`,
        { parse_mode: 'Markdown' }
      );
      
      // Запускаем игру через 3 секунды
      setTimeout(async () => {
        await startDuel(ctx, duel);
      }, 3000);
      
    } catch (error) {
      console.error('Ошибка принятия дуэли:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });

  // Обработка отклонения дуэли
  bot.action(/^duel_decline_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const duel = activeDuels.get(sessionId);
      
      if (!duel) {
        await ctx.answerCbQuery('❌ Дуэль недоступна', true);
        return;
      }

      activeDuels.delete(sessionId);
      await apiService.declineDuel(sessionId, ctx.from.id);
      
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
  bot.action(/^duel_rematch_(.+)$/, async (ctx) => {
    try {
      const oldSessionId = ctx.match[1];
      await createRematch(ctx, oldSessionId);
    } catch (error) {
      console.error('Ошибка создания реванша:', error);
      await ctx.answerCbQuery('❌ Не удалось создать реванш', true);
    }
  });

  // Очистка устаревших данных каждые 30 секунд
  setInterval(() => {
    cleanupExpiredData();
  }, 30000);
}

/**
 * Создание вызова на дуэль
 */
async function createDuelChallenge(ctx, targetUser, amount, gameType, format) {
  try {
    const challengerId = ctx.from.id.toString();
    const challengerUsername = ctx.from.username;
    const winsRequired = getWinsRequired(format);
    
    // Создаем дуэль через Backend API
    const duelData = await apiService.createDuel({
      challengerId,
      challengerUsername,
      opponentUsername: targetUser,
      amount,
      gameType,
      format,
      winsRequired,
      chatId: ctx.chat.id.toString(),
      chatType: ctx.chat.type
    });

    if (!duelData.success) {
      await ctx.reply(`❌ ${duelData.error}`);
      return;
    }

    const sessionId = duelData.data.sessionId;
    
    // Сохраняем только для UI callbacks (временно)
    pendingDuels.set(sessionId, {
      sessionId,
      challengerId,
      challengerUsername,
      opponentUsername: targetUser,
      amount,
      gameType,
      format,
      chatId: ctx.chat.id.toString(),
      messageId: null // будет установлено позже
    });

    // Создаем кнопки
    const buttons = targetUser ? [
      [
        Markup.button.callback(`✅ Принять ${gameType}`, `duel_accept_${sessionId}`),
        Markup.button.callback('❌ Отклонить', `duel_decline_${sessionId}`)
      ]
    ] : [
      [Markup.button.callback(`✅ Принять вызов ${gameType}`, `duel_accept_${sessionId}`)]
    ];

    const challengeText = targetUser ? 
      `${gameType} **ВЫЗОВ НА ДУЭЛЬ** ${gameType}\n\n` +
      `👤 @${challengerUsername} вызывает @${targetUser}!\n` +
      `💰 Ставка: ${amount} USDT (за всю серию)\n` +
      `🎮 Игра: ${getGameName(gameType)}\n` +
      `🏆 Формат: ${format.toUpperCase()} (до ${winsRequired} побед)\n` +
      `⏱ Время на ответ: 5 минут`
      :
      `${gameType} **ОТКРЫТЫЙ ВЫЗОВ** ${gameType}\n\n` +
      `👤 @${challengerUsername} ищет противника!\n` +
      `💰 Ставка: ${amount} USDT\n` +
      `🎮 Игра: ${getGameName(gameType)}\n` +
      `🏆 Формат: ${format.toUpperCase()}\n` +
      `⏱ Первый нажавший станет противником`;

    await ctx.reply(challengeText, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(buttons)
    });

    // Автоматическая отмена через 5 минут
    setTimeout(() => {
      if (activeDuels.has(sessionId)) {
        activeDuels.delete(sessionId);
        apiService.cancelDuel(sessionId, challengerId);
      }
    }, CHALLENGE_TIMEOUT);

  } catch (error) {
    console.error('Ошибка создания дуэли:', error);
    throw error;
  }
}

/**
 * Запуск дуэли
 */
async function startDuel(ctx, duel) {
  try {
    let currentRound = 0;
    let score = { challenger: 0, opponent: 0 };
    
    async function playRound() {
      currentRound++;
      
      await ctx.reply(
        `${duel.gameType} **РАУНД ${currentRound}** ${duel.gameType}\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📊 Счет: ${score.challenger}-${score.opponent}`,
        { parse_mode: 'Markdown' }
      );
      
      // Ход первого игрока
      await ctx.reply(`👤 @${duel.challengerUsername} бросает...`);
      const result1 = await ctx.replyWithDice({ emoji: duel.gameType });
      const value1 = result1.dice.value;
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Ход второго игрока
      await ctx.reply(`👤 @${duel.opponentUsername} бросает...`);
      const result2 = await ctx.replyWithDice({ emoji: duel.gameType });
      const value2 = result2.dice.value;
      
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Определяем победителя раунда
      const roundResult = determineRoundWinner(duel.gameType, value1, value2);
      
      if (roundResult === 'player1') {
        score.challenger++;
        await ctx.reply(`✅ Раунд выиграл @${duel.challengerUsername}! ${getResultText(duel.gameType, value1, value2)}`);
      } else if (roundResult === 'player2') {
        score.opponent++;
        await ctx.reply(`✅ Раунд выиграл @${duel.opponentUsername}! ${getResultText(duel.gameType, value1, value2)}`);
      } else {
        await ctx.reply(`🤝 Ничья! ${getResultText(duel.gameType, value1, value2)} Переигрываем...`);
        setTimeout(() => playRound(), 2000);
        return;
      }
      
      // Сохраняем результат раунда
      await apiService.saveDuelRound(duel.sessionId, {
        round: currentRound,
        challengerResult: value1,
        opponentResult: value2,
        winnerId: roundResult === 'player1' ? duel.challengerId : duel.opponentId
      });
      
      // Проверяем победителя серии
      if (score.challenger >= duel.winsRequired) {
        await finishDuel(ctx, duel, 'challenger', score);
      } else if (score.opponent >= duel.winsRequired) {
        await finishDuel(ctx, duel, 'opponent', score);
      } else {
        setTimeout(() => playRound(), 3000);
      }
    }
    
    await playRound();
    
  } catch (error) {
    console.error('Ошибка в дуэли:', error);
    await ctx.reply('❌ Произошла ошибка во время игры');
  }
}

/**
 * Завершение дуэли
 */
async function finishDuel(ctx, duel, winner, score) {
  try {
    const winnerId = winner === 'challenger' ? duel.challengerId : duel.opponentId;
    const winnerUsername = winner === 'challenger' ? duel.challengerUsername : duel.opponentUsername;
    const loserId = winner === 'challenger' ? duel.opponentId : duel.challengerId;
    const loserUsername = winner === 'challenger' ? duel.opponentUsername : duel.challengerUsername;
    
    // Завершаем дуэль через API
    const result = await apiService.finishDuel(duel.sessionId, winnerId);
    
    // Очищаем из памяти
    activeDuels.delete(duel.sessionId);
    
    // Рассчитываем выигрыш (95% от банка)
    const totalBank = duel.amount * 2;
    const winAmount = Math.floor(totalBank * (1 - CASINO_COMMISSION));
    
    await ctx.reply(
      `🏆 **ДУЭЛЬ ЗАВЕРШЕНА** 🏆\n` +
      `━━━━━━━━━━━━━━━\n` +
      `👑 Победитель: @${winnerUsername}\n` +
      `📊 Финальный счет: ${score.challenger}-${score.opponent}\n` +
      `💰 Выигрыш: ${winAmount} USDT\n` +
      `💸 Проигрыш: ${duel.amount} USDT\n` +
      `🏛 Комиссия казино: ${totalBank - winAmount} USDT\n\n` +
      `🎮 GG WP!`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Реванш', `duel_rematch_${duel.sessionId}`)]
        ])
      }
    );
    
  } catch (error) {
    console.error('Ошибка завершения дуэли:', error);
  }
}

/**
 * Создание реванша
 */
async function createRematch(ctx, oldSessionId) {
  try {
    const userId = ctx.from.id.toString();
    await ctx.answerCbQuery('⏳ Создаем реванш...');
    
    const oldDuel = await apiService.getDuelData(oldSessionId, userId);
    if (!oldDuel.success) {
      await ctx.answerCbQuery('❌ Не удалось получить данные дуэли', true);
      return;
    }
    
    const oldData = oldDuel.data;
    
    // Меняем местами игроков
    const isChallenger = oldData.challengerId === userId;
    const newChallenger = isChallenger ? oldData.opponentId : oldData.challengerId;
    const newChallengerUsername = isChallenger ? oldData.opponentUsername : oldData.challengerUsername;
    const newOpponent = isChallenger ? oldData.challengerId : oldData.opponentId;
    const newOpponentUsername = isChallenger ? oldData.challengerUsername : oldData.opponentUsername;
    
    // Создаем новую дуэль
    await createDuelChallenge(ctx, newOpponentUsername, oldData.amount, oldData.gameType, oldData.format);
    
  } catch (error) {
    console.error('Ошибка создания реванша:', error);
    throw error;
  }
}

/**
 * Базовая валидация параметров (остальная логика в Backend)
 */
function validateDuelRequest(userId, amount, gameType, format) {
  // Проверка суммы
  if (isNaN(amount) || amount < MIN_BET || amount > MAX_BET) {
    return { valid: false, error: `Сумма должна быть от ${MIN_BET} до ${MAX_BET} USDT` };
  }
  
  // Проверка типа игры
  const validGames = ['🎲', '🎯', '⚽', '🏀', '🎰', '🎳'];
  if (!validGames.includes(gameType)) {
    return { valid: false, error: 'Неподдерживаемый тип игры' };
  }
  
  // Проверка формата
  const validFormats = ['bo1', 'bo3', 'bo5', 'bo7'];
  if (!validFormats.includes(format.toLowerCase())) {
    return { valid: false, error: 'Неподдерживаемый формат (bo1, bo3, bo5, bo7)' };
  }
  
  return { valid: true };
}

/**
 * Очистка устаревших UI данных
 */
function cleanupExpiredData() {
  const now = Date.now();
  
  // Очистка устаревших pending дуэлей (только UI)
  for (const [sessionId, duel] of pendingDuels) {
    if (now - (duel.createdAt || 0) > CHALLENGE_TIMEOUT) {
      pendingDuels.delete(sessionId);
    }
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
    'bo7': 4
  };
  return formats[format.toLowerCase()] || 1;
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

function determineRoundWinner(gameType, value1, value2) {
  switch (gameType) {
    case '🎲':
    case '🎳':
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '🎯':
      if (value1 === 6 && value2 !== 6) return 'player1';
      if (value2 === 6 && value1 !== 6) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '⚽':
    case '🏀':
      const isGoal1 = value1 >= 4;
      const isGoal2 = value2 >= 4;
      if (isGoal1 && !isGoal2) return 'player1';
      if (isGoal2 && !isGoal1) return 'player2';
      return 'draw';
      
    case '🎰':
      if (value1 === 64 && value2 !== 64) return 'player1'; // Джекпот
      if (value2 === 64 && value1 !== 64) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
  }
  
  return 'draw';
}

function getResultText(gameType, value1, value2) {
  switch (gameType) {
    case '🎲':
      return `(${value1} vs ${value2})`;
      
    case '🎯':
      const dart1 = value1 === 6 ? 'ЦЕНТР!' : `${value1} очков`;
      const dart2 = value2 === 6 ? 'ЦЕНТР!' : `${value2} очков`;
      return `(${dart1} vs ${dart2})`;
      
    case '⚽':
      const goal1 = value1 >= 4 ? 'ГОЛ!' : 'Мимо';
      const goal2 = value2 >= 4 ? 'ГОЛ!' : 'Мимо';
      return `(${goal1} vs ${goal2})`;
      
    case '🏀':
      const basket1 = value1 >= 4 ? 'Попал!' : 'Мимо';
      const basket2 = value2 >= 4 ? 'Попал!' : 'Мимо';
      return `(${basket1} vs ${basket2})`;
      
    case '🎰':
      const slot1 = value1 === 64 ? 'ДЖЕКПОТ!' : (value1 >= 32 ? 'Выигрыш!' : 'Проигрыш');
      const slot2 = value2 === 64 ? 'ДЖЕКПОТ!' : (value2 >= 32 ? 'Выигрыш!' : 'Проигрыш');
      return `(${slot1} vs ${slot2})`;
      
    case '🎳':
      return `(${value1} кеглей vs ${value2} кеглей)`;
      
    default:
      return `(${value1} vs ${value2})`;
  }
}

module.exports = {
  registerDuelHandlers
};