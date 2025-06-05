const { Markup } = require('telegraf');
const apiService = require('../services/api.service');
const config = require('../config');

// Игры и их эмодзи
const GAMES = {
  '🎲': { name: 'Кости', emoji: '🎲', rules: 'У кого больше - тот выиграл' },
  '🎯': { name: 'Дартс', emoji: '🎯', rules: '6 = центр мишени, побеждает точность' },
  '⚽': { name: 'Футбол', emoji: '⚽', rules: '4-5 = гол, побеждает меткость' },
  '🏀': { name: 'Баскетбол', emoji: '🏀', rules: '4-5 = попадание, побеждает точность' },
  '🎳': { name: 'Боулинг', emoji: '🎳', rules: 'У кого больше кеглей - тот выиграл' },
  '🎰': { name: 'Слоты', emoji: '🎰', rules: 'Лучшая комбинация побеждает' }
};

// Форматы дуэлей
const FORMATS = {
  'bo1': { name: 'Bo1', description: '1 раунд', wins: 1 },
  'bo3': { name: 'Bo3', description: 'до 2 побед', wins: 2 },
  'bo5': { name: 'Bo5', description: 'до 3 побед', wins: 3 },
  'bo7': { name: 'Bo7', description: 'до 4 побед', wins: 4 }
};

/**
 * Создание открытой дуэли в группе
 * Синтаксис: /duel [ставка] [игра] [формат]
 * Пример: /duel 50 🎲 bo3
 */
async function createOpenDuel(ctx) {
  try {
    // Проверяем что команда в группе
    if (ctx.chat.type === 'private') {
      return ctx.reply(
        '❌ Команда /duel работает только в группах\n\n' +
        '💡 Для личных дуэлей используйте inline-режим:\n' +
        '👉 @greenlight_bot duel @username 100 🎲'
      );
    }

    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0) {
      return showDuelHelp(ctx);
    }

    const amount = parseFloat(args[0]);
    const gameType = args[1] || '🎲';
    const format = args[2] || 'bo1';

    // Валидация
    if (isNaN(amount) || amount < 1 || amount > 1000) {
      return ctx.reply('❌ Ставка должна быть от 1 до 1000 USDT');
    }

    if (!GAMES[gameType]) {
      return ctx.reply(
        '❌ Неподдерживаемая игра\n\n' +
        '🎮 Доступные игры:\n' +
        Object.entries(GAMES).map(([emoji, game]) => 
          `${emoji} ${game.name} - ${game.rules}`
        ).join('\n')
      );
    }

    if (!FORMATS[format]) {
      return ctx.reply(
        '❌ Неподдерживаемый формат\n\n' +
        '🏆 Доступные форматы:\n' +
        Object.entries(FORMATS).map(([key, fmt]) => 
          `${key} - ${fmt.description}`
        ).join('\n')
      );
    }

    // Создаем дуэль через API
    const duelData = await apiService.createDuel({
      challengerId: ctx.from.id.toString(),
      challengerUsername: ctx.from.username,
      gameType,
      format,
      amount,
      chatId: ctx.chat.id.toString(),
      chatType: ctx.chat.type,
      messageId: ctx.message.message_id
    });

    if (!duelData.success) {
      throw new Error(duelData.error || 'Не удалось создать дуэль');
    }

    const sessionId = duelData.data.sessionId;
    const game = GAMES[gameType];
    const formatInfo = FORMATS[format];

    // Отправляем сообщение с дуэлью
    const message = await ctx.reply(
      `${gameType} **ОТКРЫТЫЙ ВЫЗОВ НА ДУЭЛЬ** ${gameType}\n\n` +
      `🎮 Игра: ${game.name}\n` +
      `💰 Ставка: ${amount} USDT каждый\n` +
      `🏆 Формат: ${formatInfo.name} (${formatInfo.description})\n` +
      `👤 Инициатор: @${ctx.from.username}\n\n` +
      `📋 Правила: ${game.rules}\n` +
      `⏱ Ожидание противника...`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('⚔️ Принять вызов', `accept_open_duel_${sessionId}`)],
          [Markup.button.callback('📊 Правила игры', `duel_rules_${gameType}`)],
          [Markup.button.callback('❌ Отменить', `cancel_duel_${sessionId}`)]
        ])
      }
    );

    // Сохраняем ID сообщения (заглушка, так как метод updateDuelMessage не реализован)
    // TODO: Реализовать метод updateDuelMessage если нужно

  } catch (error) {
    console.error('Ошибка создания открытой дуэли:', error);
    ctx.reply('❌ Не удалось создать дуэль. ' + (error.message || 'Попробуйте позже.'));
  }
}

/**
 * Создание персонального вызова в группе
 * Синтаксис: /duel @username [ставка] [игра] [формат]
 * Пример: /duel @ivan 100 🎯 bo3
 */
async function createPersonalDuel(ctx) {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 2) {
      return ctx.reply(
        '❌ Неверный формат команды\n\n' +
        '📝 Правильно: /duel @username ставка игра [формат]\n' +
        '📝 Пример: /duel @ivan 100 🎲 bo3'
      );
    }

    let targetUsername = args[0];
    const amount = parseFloat(args[1]);
    const gameType = args[2] || '🎲';
    const format = args[3] || 'bo1';

    // Очищаем username
    if (targetUsername.startsWith('@')) {
      targetUsername = targetUsername.slice(1);
    }

    // Проверяем что не вызывает себя
    if (targetUsername === ctx.from.username) {
      return ctx.reply('❌ Нельзя вызвать самого себя на дуэль');
    }

    // Валидация (аналогично открытой дуэли)
    if (isNaN(amount) || amount < 1 || amount > 1000) {
      return ctx.reply('❌ Ставка должна быть от 1 до 1000 USDT');
    }

    if (!GAMES[gameType] || !FORMATS[format]) {
      return showDuelHelp(ctx);
    }

    // Создаем персональную дуэль
    const duelData = await apiService.createDuel({
      challengerId: ctx.from.id.toString(),
      challengerUsername: ctx.from.username,
      opponentUsername: targetUsername,
      gameType,
      format,
      amount,
      chatId: ctx.chat.id.toString(),
      chatType: ctx.chat.type,
      messageId: ctx.message.message_id
    });

    if (!duelData.success) {
      throw new Error(duelData.error || 'Не удалось создать дуэль');
    }

    const sessionId = duelData.data.sessionId;
    const game = GAMES[gameType];
    const formatInfo = FORMATS[format];

    const message = await ctx.reply(
      `${gameType} **ПЕРСОНАЛЬНЫЙ ВЫЗОВ** ${gameType}\n\n` +
      `🎯 @${ctx.from.username} вызывает @${targetUsername}\n` +
      `🎮 Игра: ${game.name}\n` +
      `💰 Ставка: ${amount} USDT каждый\n` +
      `🏆 Формат: ${formatInfo.name} (${formatInfo.description})\n\n` +
      `📋 Правила: ${game.rules}\n` +
      `⏱ Ожидание ответа...`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Принять', `accept_personal_duel_${sessionId}`),
            Markup.button.callback('❌ Отклонить', `decline_personal_duel_${sessionId}`)
          ],
          [Markup.button.callback('📊 Правила игры', `duel_rules_${gameType}`)]
        ])
      }
    );

    // TODO: Сохранить ID сообщения если нужно

  } catch (error) {
    console.error('Ошибка создания персональной дуэли:', error);
    ctx.reply('❌ Не удалось создать дуэль. ' + (error.message || 'Попробуйте позже.'));
  }
}

/**
 * Показать справку по дуэлям
 */
async function showDuelHelp(ctx) {
  const helpText = `🎮 **СПРАВКА ПО ДУЭЛЯМ** 🎮\n\n` +
    `**📝 Команды в группах:**\n` +
    `• /duel [ставка] [игра] [формат] - открытый вызов\n` +
    `• /duel @username [ставка] [игра] [формат] - личный вызов\n\n` +
    `**📝 Команды в личке:**\n` +
    `• /duel_help - эта справка\n` +
    `• /duel_stats - моя статистика\n` +
    `• /duel_history - история дуэлей\n\n` +
    `**🎮 Доступные игры:**\n` +
    Object.entries(GAMES).map(([emoji, game]) => 
      `${emoji} ${game.name} - ${game.rules}`
    ).join('\n') + '\n\n' +
    `**🏆 Форматы дуэлей:**\n` +
    Object.entries(FORMATS).map(([key, fmt]) => 
      `${key} - ${fmt.description}`
    ).join('\n') + '\n\n' +
    `**💰 Ставки:**\n` +
    `• Минимум: 1 USDT\n` +
    `• Максимум: 1000 USDT\n` +
    `• Комиссия: 5% с выигрыша\n\n` +
    `**📋 Примеры:**\n` +
    `• /duel 50 🎲 - открытые кости за 50 USDT\n` +
    `• /duel @ivan 100 🎯 bo3 - вызов Ивана на дартс Bo3\n\n` +
    `**⚡ Inline режим для личных чатов:**\n` +
    `@greenlight_bot duel @username ставка игра`;

  return ctx.reply(helpText, { parse_mode: 'Markdown' });
}

/**
 * Статистика дуэлей пользователя
 */
async function showDuelStats(ctx) {
  try {
    const stats = await apiService.getUserDuelStats(ctx.from.id.toString());
    
    if (!stats.data || !stats.data.total) {
      return ctx.reply(
        '📊 **СТАТИСТИКА ДУЭЛЕЙ** 📊\n\n' +
        '🚫 У вас пока нет завершенных дуэлей\n\n' +
        '💡 Создайте первую дуэль:\n' +
        '👉 /duel 10 🎲'
      );
    }

    const { total, byGame } = stats.data;
    const winRate = total.totalGames > 0 ? 
      ((total.totalWins / total.totalGames) * 100).toFixed(1) : 0;

    let statsText = `📊 **СТАТИСТИКА ДУЭЛЕЙ** 📊\n\n` +
      `🎮 Всего игр: ${total.totalGames}\n` +
      `🏆 Побед: ${total.totalWins}\n` +
      `📉 Поражений: ${total.totalGames - total.totalWins}\n` +
      `📈 Винрейт: ${winRate}%\n` +
      `💰 Общий P&L: ${total.totalProfit > 0 ? '+' : ''}${total.totalProfit} USDT\n\n`;

    if (byGame && byGame.length > 0) {
      statsText += `**📊 По играм:**\n`;
      byGame.forEach(game => {
        const gameInfo = GAMES[game.gameType];
        const gameWinRate = game.totalGames > 0 ? 
          ((game.wins / game.totalGames) * 100).toFixed(1) : 0;
        
        statsText += `${game.gameType} ${gameInfo?.name}: ${game.totalGames} игр, ` +
          `${gameWinRate}% побед, ${game.totalProfit > 0 ? '+' : ''}${game.totalProfit} USDT\n`;
      });
    }

    return ctx.reply(statsText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    ctx.reply('❌ Не удалось получить статистику');
  }
}

/**
 * История дуэлей пользователя
 */
async function showDuelHistory(ctx) {
  try {
    const history = await apiService.getUserDuelHistory(ctx.from.id.toString(), 10, 0); // Последние 10 дуэлей
    
    if (!history.data || !history.data.duels || history.data.duels.length === 0) {
      return ctx.reply(
        '📚 **ИСТОРИЯ ДУЭЛЕЙ** 📚\n\n' +
        '🚫 У вас пока нет завершенных дуэлей\n\n' +
        '💡 Создайте первую дуэль:\n' +
        '👉 /duel 10 🎲'
      );
    }

    let historyText = `📚 **ИСТОРИЯ ДУЭЛЕЙ** 📚\n\n`;
    
    history.data.duels.forEach((duel, index) => {
      const game = GAMES[duel.gameType];
      const isWinner = duel.winnerId === ctx.from.id.toString();
      const opponent = duel.challengerId === ctx.from.id.toString() ? 
        duel.opponentUsername : duel.challengerUsername;
      
      const result = isWinner ? '🏆 Победа' : '😔 Поражение';
      const profit = isWinner ? `+${duel.winAmount}` : `-${duel.amount}`;
      const date = new Date(duel.completedAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      historyText += `${index + 1}. ${duel.gameType} vs @${opponent}\n` +
        `   ${result} • ${profit} USDT • ${date}\n` +
        `   Счет: ${duel.challengerScore}-${duel.opponentScore}\n\n`;
    });

    if (history.data.total > 10) {
      historyText += `📊 Показано 10 из ${history.data.total} дуэлей`;
    }

    return ctx.reply(historyText, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Ошибка получения истории:', error);
    ctx.reply('❌ Не удалось получить историю дуэлей');
  }
}

/**
 * Отмена собственной дуэли
 */
async function cancelDuel(ctx) {
  try {
    // TODO: Реализовать получение активных дуэлей пользователя
    // const activeDuels = await apiService.getActiveDuels();
    return ctx.reply('❌ Функция отмены дуэлей временно недоступна');
    
    if (!activeDuels.data || !activeDuels.data.duels || activeDuels.data.duels.length === 0) {
      return ctx.reply('❌ У вас нет активных дуэлей для отмены');
    }

    // Находим дуэли которые можно отменить (только pending и только свои)
    const cancelableDuels = activeDuels.data.duels.filter(duel => 
      duel.status === 'pending' && duel.challengerId === ctx.from.id.toString()
    );

    if (cancelableDuels.length === 0) {
      return ctx.reply('❌ Нет дуэлей доступных для отмены');
    }

    // Если одна дуэль - отменяем сразу
    if (cancelableDuels.length === 1) {
      const duel = cancelableDuels[0];
      await apiService.cancelDuel(duel.sessionId);
      
      return ctx.reply(
        `✅ Дуэль отменена\n\n` +
        `🎮 Игра: ${GAMES[duel.gameType]?.name}\n` +
        `💰 Ставка: ${duel.amount} USDT\n` +
        `⏱ Средства разблокированы`
      );
    }

    // Если несколько дуэлей - показываем список для выбора
    const buttons = cancelableDuels.map(duel => [
      Markup.button.callback(
        `${duel.gameType} ${duel.amount} USDT`,
        `cancel_my_duel_${duel.sessionId}`
      )
    ]);

    return ctx.reply(
      '❌ **ОТМЕНА ДУЭЛИ** ❌\n\n' +
      'Выберите дуэль для отмены:',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons)
      }
    );

  } catch (error) {
    console.error('Ошибка отмены дуэли:', error);
    ctx.reply('❌ Не удалось отменить дуэль');
  }
}

module.exports = {
  createOpenDuel,
  createPersonalDuel,
  showDuelHelp,
  showDuelStats,
  showDuelHistory,
  cancelDuel,
  GAMES,
  FORMATS
};