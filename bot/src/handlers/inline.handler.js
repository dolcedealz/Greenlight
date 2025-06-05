// bot/src/handlers/inline.handler.js
const config = require('../config');
const apiService = require('../services/api.service');
const duelService = require('../services/duel.service');

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
        const winsRequired = duelService.getWinsRequired(format);
        
        // Создаем URL для Deep Link
        const deepLinkData = `duel_${challengerId}_${targetUsername}_${amount}_${gameType}_${format}`;
        const botUsername = bot.botInfo?.username || 'Greenlightgames_bot';
        
        results.push({
          type: 'article',
          id: `duel_${Date.now()}`,
          title: `${gameType} Дуэль с @${targetUsername}`,
          description: `${amount} USDT, ${format.toUpperCase()}`,
          url: `https://t.me/${botUsername}?start=${deepLinkData}`,
          input_message_content: {
            message_text: `${gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${gameType}\n\n` +
              `@${username} приглашает вас на дуэль!\n` +
              `💰 Ставка: ${amount} USDT\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `🏆 Формат: ${format.toUpperCase()}\n\n` +
              `📱 Для участия нажмите: https://t.me/${botUsername}?start=${deepLinkData}`,
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
          description: 'Формат: duel @username сумма',
          input_message_content: {
            message_text: `📖 **Как создать дуэль:**\n\n` +
              `Введите: \`duel @username 50\`\n` +
              `Доступные игры: 🎲 🎯 ⚽ 🏀 🎰 🎳`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      // Добавляем тестовый результат для отладки
      if (query.includes('test')) {
        results.unshift({
          type: 'article',
          id: 'test_result',
          title: '🧪 Тестовый результат',
          description: 'Проверка inline mode',
          input_message_content: {
            message_text: 'Тестовое сообщение от inline бота'
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
        userId: ctx.from.id,
        inlineMessageId: ctx.chosenInlineResult.inline_message_id,
        fullEvent: ctx.chosenInlineResult
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
    const { challengerId, challengerUsername, targetUsername, amount, gameType, format } = data;
    
    console.log('🎯 Создание безопасной дуэли:', data);
    
    // Создаем дуэль через безопасный сервис
    const duel = duelService.createDuel(
      challengerId.toString(),
      challengerUsername,
      targetUsername,
      amount,
      gameType,
      format,
      'private'
    );
    
    // Пытаемся найти пользователя для прямой отправки
    try {
      const response = await apiService.findUserByUsername(targetUsername);
      
      if (response && response.telegramId) {
        // Создаем безопасные callback кнопки
        const keyboard = {
          inline_keyboard: [[
            { 
              text: `✅ Принять ${gameType}`, 
              callback_data: `private_accept_${duel.id}` 
            },
            { 
              text: '❌ Отклонить', 
              callback_data: `private_decline_${duel.id}` 
            }
          ]]
        };
        
        // Отправляем приглашение оппоненту
        const opponentMessage = await bot.telegram.sendMessage(
          response.telegramId,
          `${gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${gameType}\n\n` +
          `👤 @${challengerUsername} приглашает вас на дуэль!\n` +
          `💰 Ставка: ${amount} USDT\n` +
          `🎮 Игра: ${duelService.getGameName(gameType)}\n` +
          `🏆 Формат: ${format.toUpperCase()} (до ${duelService.getWinsRequired(format)} побед)\n\n` +
          `⏱ Время на ответ: 5 минут`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
        
        // Отправляем подтверждение инициатору
        const challengerMessage = await bot.telegram.sendMessage(
          challengerId,
          `✅ **Приглашение отправлено!**\n\n` +
          `🎮 Игра: ${duelService.getGameName(gameType)}\n` +
          `💰 Ставка: ${amount} USDT\n` +
          `🏆 Формат: ${format.toUpperCase()}\n` +
          `👤 Оппонент: @${targetUsername}\n\n` +
          `⏱ Ожидаем ответ...`,
          {
            parse_mode: 'Markdown'
          }
        );
        
        // Сохраняем ссылки на сообщения в дуэли
        duel.messages.challenger = {
          chatId: challengerId,
          messageId: challengerMessage.message_id
        };
        duel.messages.opponent = {
          chatId: response.telegramId,
          messageId: opponentMessage.message_id
        };
        
        console.log(`✅ Дуэль ${duel.id} создана и отправлена пользователю ${targetUsername}`);
        
      } else {
        throw new Error('Пользователь не найден в базе данных');
      }
      
    } catch (apiError) {
      console.log(`⚠️ Не удалось найти @${targetUsername}, удаляем дуэль`);
      
      // Удаляем созданную дуэль
      duelService.removeDuel(duel.id);
      
      // Отправляем инициатору сообщение об ошибке
      await bot.telegram.sendMessage(
        challengerId,
        `❌ **Не удалось создать дуэль**\n\n` +
        `Пользователь @${targetUsername} не найден в системе.\n` +
        `Попросите их сначала написать боту /start`,
        {
          parse_mode: 'Markdown'
        }
      );
    }
    
  } catch (error) {
    console.error('❌ Ошибка создания дуэли:', error.message);
    
    // Отправляем сообщение об ошибке инициатору
    try {
      await bot.telegram.sendMessage(
        challengerId,
        `❌ **Ошибка создания дуэли**\n\n${error.message}`,
        { parse_mode: 'Markdown' }
      );
    } catch (sendError) {
      console.error('❌ Не удалось отправить сообщение об ошибке:', sendError);
    }
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
      // Создаем inline кнопки для принятия дуэли (используем emoji callback pattern)
      const keyboard = {
        inline_keyboard: [[
          { 
            text: `✅ Принять ${invite.gameType}`, 
            callback_data: `emoji_accept_${invite.challengerId}_${invite.amount}_${invite.gameType}_${invite.format}` 
          },
          { 
            text: '❌ Отклонить', 
            callback_data: `emoji_decline_${invite.challengerId}` 
          }
        ]]
      };
      
      // Отправляем приглашение
      await bot.telegram.sendMessage(
        userId,
        `${invite.gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${invite.gameType}\n\n` +
        `@${invite.challengerUsername} приглашает вас на дуэль!\n` +
        `💰 Ставка: ${invite.amount} USDT\n` +
        `🎮 Игра: ${getGameName(invite.gameType)}\n` +
        `🏆 Формат: ${invite.format.toUpperCase()} (до ${invite.winsRequired} побед)\n\n` +
        `Принять дуэль?`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
      
      // Удаляем отправленное приглашение
      delete global.pendingDuelInvites[inviteId];
    }
  }
}


module.exports = {
  registerInlineHandlers,
  checkPendingInvites
};