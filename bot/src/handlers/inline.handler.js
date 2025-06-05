// bot/src/handlers/inline.handler.js
const config = require('../config');
const apiService = require('../services/api.service');
const duelService = require('../services/duel.service');

function registerInlineHandlers(bot) {
  console.log('🔧 Регистрируем inline handlers...');
  
  // Добавляем тестовый обработчик для отладки
  bot.on('inline_query', async (ctx) => {
    console.log('🔥 INLINE QUERY ПОЛУЧЕН! Полные данные:', JSON.stringify(ctx.inlineQuery, null, 2));
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
      const duelMatch = query.match(/^duel\s+@?(\w+)(?:\s+(\d+))?(?:\s*(🎲|🎯|⚽|🏀|🎰|🎳))?(?:\s*(bo\d+))?/i);
      
      console.log('🔍 Проверка duel match:', {
        query: query,
        matched: !!duelMatch,
        matchGroups: duelMatch
      });
      
      if (duelMatch) {
        const targetUsername = duelMatch[1].replace('@', '');
        const amount = duelMatch[2] ? parseInt(duelMatch[2]) : 10; // Default 10 USDT
        const gameType = duelMatch[3] || '🎲';
        const format = duelMatch[4] || 'bo1';
        
        // Определяем количество побед
        const winsRequired = duelService.getWinsRequired(format);
        
        // Создаем URL для Deep Link
        const challengerId = ctx.from.id;
        const deepLinkData = `duel_${challengerId}_${targetUsername}_${amount}_${gameType}_${format}`;
        const botUsername = bot.botInfo?.username || 'Greenlightgames_bot';
        
        results.push({
          type: 'article',
          id: `duel_${Date.now()}`,
          title: `${gameType} Дуэль с @${targetUsername}`,
          description: `${amount} USDT, ${format.toUpperCase()} - ${getGameName(gameType)}`,
          input_message_content: {
            message_text: `${gameType} **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** ${gameType}\n\n` +
              `@${username} приглашает @${targetUsername} на дуэль!\n` +
              `💰 Ставка: ${amount} USDT каждый\n` +
              `🎮 Игра: ${getGameName(gameType)}\n` +
              `🏆 Формат: ${format.toUpperCase()}\n\n` +
              `⏱️ Нажмите кнопку ниже для ответа`,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [[
              {
                text: `✅ Принять дуэль ${gameType}`,
                callback_data: `inline_accept_${challengerId}_${username}_${targetUsername}_${amount}_${gameType}_${format}`
              },
              {
                text: '❌ Отклонить',
                callback_data: `inline_decline_${challengerId}`
              }
            ]]
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
      
      // ВСЕГДА добавляем базовые результаты для тестирования
      results.push({
        type: 'article',
        id: 'always_test',
        title: '🧪 Тест inline mode',
        description: `Запрос: "${ctx.inlineQuery.query || 'пустой'}"`,
        input_message_content: {
          message_text: `✅ Inline mode работает!\n\nВаш запрос: "${ctx.inlineQuery.query}"\nВремя: ${new Date().toLocaleString()}`
        }
      });
      
      // Если ничего не найдено, показываем подсказку
      if (results.length === 1) { // 1 потому что test уже добавлен
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
        results: results.map(r => ({ 
          id: r.id, 
          title: r.title,
          hasButtons: !!r.reply_markup?.inline_keyboard,
          buttonCount: r.reply_markup?.inline_keyboard?.[0]?.length || 0
        }))
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
      
      // Inline результаты дуэлей обрабатываются через callback кнопки
      console.log('✅ Inline результат выбран (обработка через callback кнопки)');
      
    } catch (error) {
      console.error('❌ Ошибка chosen_inline_result:', error);
    }
  });
}

/**
 * Получаем название игры по эмодзи
 */
function getGameName(gameType) {
  const gameNames = {
    '🎲': 'Кости',
    '🎯': 'Дартс', 
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎰': 'Слоты',
    '🎳': 'Боулинг'
  };
  return gameNames[gameType] || 'Неизвестная игра';
}

module.exports = {
  registerInlineHandlers
};