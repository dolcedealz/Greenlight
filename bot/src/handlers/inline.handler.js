// bot/src/handlers/inline.handler.js

const config = require('../config'); // Добавить импорт config
const { Markup } = require('telegraf'); // Добавить импорт Markup

function registerInlineHandlers(bot) {
  bot.on('inline_query', async (ctx) => {
    try {
      const { webAppUrl } = config;
      const query = ctx.inlineQuery.query.toLowerCase().trim();
      const userId = ctx.inlineQuery.from.id.toString();
      const username = ctx.inlineQuery.from.username;
      
      const results = [];
      
      // Обработка дуэли
      const duelMatch = query.match(/^дуэль\s*(@?\w+)?\s*(\d+(?:\.\d+)?)?$/);
      
      if (duelMatch) {
        const targetUsername = duelMatch[1]?.replace('@', '');
        const amount = parseFloat(duelMatch[2]) || 50; // По умолчанию 50
        
        results.push({
          type: 'article',
          id: `pvp_duel_${Date.now()}`,
          title: `🪙 Дуэль на ${amount} USDT`,
          description: targetUsername 
            ? `Вызвать @${targetUsername} на дуэль` 
            : `Открытый вызов на ${amount} USDT`,
          thumb_url: 'https://i.imgur.com/coin.png',
          input_message_content: {
            message_text: `🪙 **ВЫЗОВ НА ДУЭЛЬ** 🪙\n\n` +
              `👤 @${username} ${targetUsername ? `вызывает @${targetUsername}` : 'бросает открытый вызов'}!\n` +
              `💰 Ставка: ${amount} USDT каждый\n` +
              `🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n` +
              `⚔️ Игра: Монетка\n\n` +
              `⏱ Вызов действителен 5 минут`,
            parse_mode: 'Markdown'
          },
          reply_markup: {
            inline_keyboard: [[
              {
                text: '⚔️ Принять вызов',
                callback_data: `pvp_accept_${userId}_${amount}_${targetUsername || 'any'}`
              },
              {
                text: '❌ Отклонить',
                callback_data: `pvp_decline_${userId}`
              }
            ]]
          }
        });
      }
      
      // Если ничего не нашли, показываем подсказку
      if (results.length === 0) {
        results.push({
          type: 'article',
          id: 'help',
          title: '💡 Как создать дуэль',
          description: 'Напишите: дуэль @username сумма',
          input_message_content: {
            message_text: `📖 **Как создать дуэль:**\n\n` +
              `• \`дуэль @username 50\` - вызвать конкретного игрока\n` +
              `• \`дуэль 100\` - открытый вызов\n\n` +
              `Примеры:\n` +
              `• @${ctx.botInfo.username} дуэль @alice 25\n` +
              `• @${ctx.botInfo.username} дуэль 100\n\n` +
              `💰 Лимиты: 1-1000 USDT`,
            parse_mode: 'Markdown'
          }
        });
      }
      
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true
      });
      
    } catch (error) {
      console.error('Ошибка inline query:', error);
      await ctx.answerInlineQuery([]);
    }
  });
}

// ВАЖНО: Добавить экспорт!
module.exports = {
  registerInlineHandlers
};