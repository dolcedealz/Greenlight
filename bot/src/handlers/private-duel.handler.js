// bot/src/handlers/private-duel.handler.js
const duelService = require('../services/duel.service');

/**
 * Обработчики для личных дуэлей
 */
function registerPrivateDuelHandlers(bot) {
  console.log('🔧 Регистрируем обработчики личных дуэлей...');

  // Принятие дуэли
  bot.action(/^private_accept_(.+)$/, async (ctx) => {
    try {
      const duelId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;

      console.log(`🎯 Принятие дуэли: ${duelId} пользователем ${username} (${userId})`);

      await ctx.answerCbQuery('⏳ Принимаем дуэль...');

      // Получаем дуэль
      const duel = duelService.getDuel(duelId);
      if (!duel) {
        await ctx.answerCbQuery('❌ Дуэль не найдена или истекла', true);
        return;
      }

      // Принимаем дуэль
      const acceptedDuel = duelService.acceptDuel(duelId, userId, username);

      // Обновляем сообщение у оппонента
      await ctx.editMessageText(
        `✅ **ДУЭЛЬ ПРИНЯТА!**\n\n` +
        `🎮 Игра: ${duelService.getGameName(acceptedDuel.game.type)}\n` +
        `💰 Ставка: ${acceptedDuel.settings.amount} USDT\n` +
        `🏆 Формат: ${acceptedDuel.game.format.toUpperCase()}\n` +
        `👤 Противник: @${acceptedDuel.players.challenger.username}\n\n` +
        `🚀 Игра начинается...`,
        {
          parse_mode: 'Markdown'
        }
      );

      // Обновляем сообщение у инициатора
      if (acceptedDuel.messages.challenger) {
        await bot.telegram.editMessageText(
          acceptedDuel.messages.challenger.chatId,
          acceptedDuel.messages.challenger.messageId,
          undefined,
          `✅ **ДУЭЛЬ ПРИНЯТА!**\n\n` +
          `🎮 Игра: ${duelService.getGameName(acceptedDuel.game.type)}\n` +
          `💰 Ставка: ${acceptedDuel.settings.amount} USDT\n` +
          `🏆 Формат: ${acceptedDuel.game.format.toUpperCase()}\n` +
          `👤 Противник: @${acceptedDuel.players.opponent.username}\n\n` +
          `🚀 Игра начинается...`,
          {
            parse_mode: 'Markdown'
          }
        );
      }

      // Начинаем игру - отправляем игровые сообщения обоим
      await startPrivateDuelGame(bot, acceptedDuel);

    } catch (error) {
      console.error('❌ Ошибка принятия дуэли:', error.message);
      await ctx.answerCbQuery(`❌ ${error.message}`, true);
    }
  });

  // Отклонение дуэли
  bot.action(/^private_decline_(.+)$/, async (ctx) => {
    try {
      const duelId = ctx.match[1];
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;

      console.log(`❌ Отклонение дуэли: ${duelId} пользователем ${username} (${userId})`);

      await ctx.answerCbQuery('❌ Дуэль отклонена');

      // Получаем дуэль для информации
      const duel = duelService.getDuel(duelId);
      if (!duel) {
        await ctx.answerCbQuery('❌ Дуэль не найдена или истекла', true);
        return;
      }

      // Отклоняем дуэль
      duelService.declineDuel(duelId, userId);

      // Обновляем сообщение у оппонента
      await ctx.editMessageText(
        `❌ **ДУЭЛЬ ОТКЛОНЕНА**\n\n` +
        `🎮 Игра: ${duelService.getGameName(duel.game.type)}\n` +
        `💰 Ставка: ${duel.settings.amount} USDT\n` +
        `👤 От: @${duel.players.challenger.username}\n\n` +
        `😔 Вы отклонили это приглашение`,
        {
          parse_mode: 'Markdown'
        }
      );

      // Уведомляем инициатора
      if (duel.messages.challenger) {
        await bot.telegram.editMessageText(
          duel.messages.challenger.chatId,
          duel.messages.challenger.messageId,
          undefined,
          `❌ **ДУЭЛЬ ОТКЛОНЕНА**\n\n` +
          `🎮 Игра: ${duelService.getGameName(duel.game.type)}\n` +
          `💰 Ставка: ${duel.settings.amount} USDT\n` +
          `👤 Оппонент: @${duel.players.opponent.username}\n\n` +
          `😔 @${username} отклонил ваше приглашение`,
          {
            parse_mode: 'Markdown'
          }
        );
      }

    } catch (error) {
      console.error('❌ Ошибка отклонения дуэли:', error.message);
      await ctx.answerCbQuery(`❌ ${error.message}`, true);
    }
  });

  // Игровые действия
  bot.action(/^private_move_(.+)_(.+)$/, async (ctx) => {
    try {
      const duelId = ctx.match[1];
      const action = ctx.match[2]; // dice, dart, etc
      const userId = ctx.from.id.toString();

      console.log(`🎮 Игровое действие: ${action} в дуэли ${duelId} от ${userId}`);

      await ctx.answerCbQuery('🎲 Бросаем...');

      // Получаем дуэль
      const duel = duelService.getDuel(duelId);
      if (!duel || duel.status !== 'active') {
        await ctx.answerCbQuery('❌ Дуэль не активна', true);
        return;
      }

      // Проверяем, что пользователь участвует в дуэли
      const isChallenger = duel.players.challenger.id === userId;
      const isOpponent = duel.players.opponent.id === userId;
      
      if (!isChallenger && !isOpponent) {
        await ctx.answerCbQuery('❌ Вы не участвуете в этой дуэли', true);
        return;
      }

      // Обрабатываем ход через игровой движок
      await handleGameMove(bot, duel, userId, action);

    } catch (error) {
      console.error('❌ Ошибка игрового действия:', error.message);
      await ctx.answerCbQuery(`❌ ${error.message}`, true);
    }
  });
}

/**
 * Начинает игру между двумя игроками
 */
async function startPrivateDuelGame(bot, duel) {
  try {
    console.log(`🚀 Начинаем игру в дуэли ${duel.id}`);

    // Переходим к первому раунду
    duel.game.currentRound = 1;

    // Создаем игровые кнопки
    const gameKeyboard = {
      inline_keyboard: [[
        { 
          text: `🎲 Бросить ${duelService.getGameName(duel.game.type)}`, 
          callback_data: `private_move_${duel.id}_${getGameAction(duel.game.type)}` 
        }
      ]]
    };

    const gameMessage = 
      `🎮 **ДУЭЛЬ НАЧАЛАСЬ!**\n\n` +
      `👤 @${duel.players.challenger.username} VS @${duel.players.opponent.username}\n` +
      `🎯 ${duelService.getGameName(duel.game.type)}\n` +
      `💰 Ставка: ${duel.settings.amount} USDT\n` +
      `🏆 Формат: ${duel.game.format.toUpperCase()} (до ${duel.game.maxRounds} побед)\n\n` +
      `📍 **Раунд ${duel.game.currentRound}**\n` +
      `Сделайте свой ход!`;

    // Отправляем игровые сообщения обоим игрокам
    const challengerGameMessage = await bot.telegram.sendMessage(
      duel.players.challenger.id,
      gameMessage,
      {
        parse_mode: 'Markdown',
        reply_markup: gameKeyboard
      }
    );

    const opponentGameMessage = await bot.telegram.sendMessage(
      duel.players.opponent.id,
      gameMessage,
      {
        parse_mode: 'Markdown',
        reply_markup: gameKeyboard
      }
    );

    // Обновляем ссылки на игровые сообщения
    duel.messages.challenger.gameMessageId = challengerGameMessage.message_id;
    duel.messages.opponent.gameMessageId = opponentGameMessage.message_id;

    console.log(`✅ Игра началась в дуэли ${duel.id}`);

  } catch (error) {
    console.error('❌ Ошибка начала игры:', error);
  }
}

/**
 * Обрабатывает игровой ход
 */
async function handleGameMove(bot, duel, userId, action) {
  // TODO: Реализуем в следующем этапе
  console.log('🎮 Обработка хода - будет реализовано в следующем этапе');
}

/**
 * Получает действие для типа игры
 */
function getGameAction(gameType) {
  const actions = {
    '🎲': 'dice',
    '🎯': 'dart',
    '⚽': 'football',
    '🏀': 'basketball',
    '🎰': 'slot',
    '🎳': 'bowling'
  };
  return actions[gameType] || 'dice';
}

module.exports = {
  registerPrivateDuelHandlers
};