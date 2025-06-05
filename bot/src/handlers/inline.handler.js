// bot/src/handlers/inline.handler.js
const config = require('../config');
const apiService = require('../services/api.service');

function registerInlineHandlers(bot) {
  console.log('🔧 Регистрируем inline handlers...');
  
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.toLowerCase().trim();
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      
      console.log('📥 Inline query получен:', {
        query: query,
        user: username,
        userId: userId,
        rawQuery: ctx.inlineQuery.query,
        queryId: ctx.inlineQuery.id
      });
      
      const results = [];
      
      // Парсим команду дуэли для личных сообщений
      // Формат: duel @username 50 🎲 bo3 (более гибкий парсинг)
      const duelMatch = query.match(/^duel\s+@?(\w+)\s+(\d+)(?:\s*(🎲|🎯|⚽|🏀|🎰|🎳))?(?:\s*(bo\d+))?/i);
      
      console.log('🔍 Проверка duel match:', {
        query: query,
        matched: !!duelMatch,
        matchGroups: duelMatch
      });
      
      if (duelMatch) {
        const targetUsername = duelMatch[1].replace('@', '');
        const amount = parseInt(duelMatch[2]);
        const gameType = duelMatch[3] || '🎲';
        const format = duelMatch[4] || 'bo1';
        
        // Определяем количество побед
        const winsRequired = getWinsRequired(format);
        
        results.push({
          type: 'article',
          id: `duel_${Date.now()}`,
          title: `${gameType} Дуэль с @${targetUsername}`,
          description: `${amount} USDT, ${format.toUpperCase()} (до ${winsRequired} побед)`,
          thumb_url: 'https://cdn-icons-png.flaticon.com/128/1055/1055815.png',
          input_message_content: {
            message_text: `${gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${gameType}\n\n` +
              `@${username} приглашает вас на дуэль!\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `🏆 Формат: ${format.toUpperCase()}\n\n` +
              `📱 Проверьте личные сообщения от @${bot.botInfo?.username || 'Greenlightgames_bot'}`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      // Проверяем простые команды
      if (query.startsWith('duel') && results.length === 0) {
        results.push({
          type: 'article',
          id: 'duel_help',
          title: '⚠️ Неправильный формат дуэли',
          description: 'Используйте: duel @username сумма',
          input_message_content: {
            message_text: `❌ **Неправильный формат команды**\n\n` +
              `Правильный формат:\n` +
              `• \`duel @username 50\` - быстрая дуэль\n` +
              `• \`duel @username 100 🎯\` - дартс\n` +
              `• \`duel @username 50 🎲 bo3\` - кости до 2 побед\n\n` +
              `Ваш запрос: \`${ctx.inlineQuery.query}\``,
            parse_mode: 'Markdown'
          }
        });
      }
      
      // Если ничего не найдено, показываем подсказку
      if (results.length === 0) {
        results.push({
          type: 'article',
          id: 'help',
          title: '💡 Как создать дуэль',
          description: 'Формат: duel @username сумма эмодзи формат',
          input_message_content: {
            message_text: `📖 **Как создать дуэль в личных сообщениях:**\n\n` +
              `Введите в поиске inline:\n` +
              `• \`duel @username 50\` - быстрая игра в кости\n` +
              `• \`duel @username 100 🎯\` - дартс\n` +
              `• \`duel @username 50 🎲 bo3\` - кости до 2 побед\n\n` +
              `Доступные игры: 🎲 🎯 ⚽ 🏀 🎰 🎳\n` +
              `Форматы: bo1, bo3, bo5, bo7, bo9`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      console.log('📤 Отправляем inline результаты:', {
        resultsCount: results.length,
        results: results.map(r => ({ id: r.id, title: r.title }))
      });
      
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true
      });
      
    } catch (error) {
      console.error('❌ Ошибка inline query:', error);
      await ctx.answerInlineQuery([]);
    }
  });
  
  // Обработка выбора inline результата (когда пользователь отправляет сообщение)
  bot.on('chosen_inline_result', async (ctx) => {
    try {
      console.log('✅ Inline результат выбран:', {
        resultId: ctx.chosenInlineResult.result_id,
        query: ctx.chosenInlineResult.query,
        from: ctx.from.username,
        userId: ctx.from.id
      });
      
      const resultId = ctx.chosenInlineResult.result_id;
      const query = ctx.chosenInlineResult.query;
      
      // Если это дуэль, отправляем приглашения в личку
      if (resultId.startsWith('duel_')) {
        const duelMatch = query.match(/^duel\s+@?(\w+)\s+(\d+)(?:\s*(🎲|🎯|⚽|🏀|🎰|🎳))?(?:\s*(bo\d+))?/i);
        
        if (duelMatch) {
          const challengerId = ctx.from.id;
          const challengerUsername = ctx.from.username;
          const targetUsername = duelMatch[1];
          const amount = parseInt(duelMatch[2]);
          const gameType = duelMatch[3] || '🎲';
          const format = duelMatch[4] || 'bo1';
          
          // Отправляем уведомления обоим игрокам
          await sendDuelInvitations(bot, {
            challengerId,
            challengerUsername,
            targetUsername,
            amount,
            gameType,
            format,
            inlineMessageId: ctx.chosenInlineResult.inline_message_id
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Ошибка chosen_inline_result:', error);
    }
  });
}

/**
 * Отправка приглашений на дуэль в личку
 */
async function sendDuelInvitations(bot, data) {
  try {
    const { challengerId, challengerUsername, targetUsername, amount, gameType, format, inlineMessageId } = data;
    
    console.log('🎯 Отправка приглашения на дуэль:', data);
    
    // Отправляем инициатору подтверждение
    await bot.telegram.sendMessage(
      challengerId,
      `✅ **Приглашение отправлено!**\n\n` +
      `🎮 Игра: ${getGameName(gameType)}\n` +
      `💰 Ставка: ${amount} USDT\n` +
      `🏆 Формат: ${format.toUpperCase()}\n` +
      `👤 Оппонент: @${targetUsername}\n\n` +
      `⏱ Ожидаем подтверждение от @${targetUsername}...\n\n` +
      `💡 Попросите @${targetUsername} написать боту /start для получения приглашения`,
      {
        parse_mode: 'Markdown'
      }
    );
    
    // Сохраняем приглашение для обработки эмодзи дуэли
    global.pendingDuelInvites = global.pendingDuelInvites || {};
    const inviteId = `invite_${Date.now()}`;
    global.pendingDuelInvites[inviteId] = {
      challengerId,
      challengerUsername,
      targetUsername,
      amount,
      gameType,
      format,
      winsRequired: getWinsRequired(format),
      timestamp: Date.now(),
      inlineMessageId
    };
    
    console.log(`📋 Приглашение сохранено: ${inviteId} для @${targetUsername}`);
    
    // Удаляем через 10 минут
    setTimeout(() => {
      delete global.pendingDuelInvites[inviteId];
    }, 10 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ Ошибка отправки приглашений:', error);
  }
}

/**
 * Проверка и отправка ожидающих приглашений
 */
async function checkPendingInvites(bot, username, userId) {
  if (!global.pendingDuelInvites) return;
  
  // Ищем приглашения для этого пользователя
  for (const [inviteId, invite] of Object.entries(global.pendingDuelInvites)) {
    if (invite.targetUsername === username) {
      // Отправляем приглашение
      await bot.telegram.sendMessage(
        userId,
        `${invite.gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${invite.gameType}\n\n` +
        `@${invite.challengerUsername} приглашает вас на дуэль!\n` +
        `💰 Ставка: ${invite.amount} USDT\n` +
        `🎮 Игра: ${getGameName(invite.gameType)}\n` +
        `🏆 Формат: ${invite.format.toUpperCase()} (до ${invite.winsRequired} побед)\n\n` +
        `⏱ Приглашение действительно еще ${Math.ceil((invite.timestamp + 5 * 60 * 1000 - Date.now()) / 60000)} минут`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Принять', callback_data: `accept_private_duel_${inviteId}` },
              { text: '❌ Отклонить', callback_data: `decline_private_duel_${inviteId}` }
            ]]
          }
        }
      );
      
      // Удаляем отправленное приглашение
      delete global.pendingDuelInvites[inviteId];
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

module.exports = {
  registerInlineHandlers,
  checkPendingInvites
};