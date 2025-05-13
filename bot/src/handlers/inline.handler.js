// inline.handler.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик inline запросов (запросы через @botname в чатах)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerInlineHandlers(bot) {
  // Обработка inline запросов для создания вызовов на игру в монетку
  bot.on('inline_query', async (ctx) => {
    try {
      const { webAppUrl } = config;
      const query = ctx.inlineQuery.query.toLowerCase();
      
      // Создаем варианты inline результатов
      const results = [
        {
          type: 'article',
          id: 'coin_challenge',
          title: 'Вызвать на игру в Монетку',
          description: 'Бросьте вызов другу в игре "Монетка"',
          thumb_url: 'https://i.imgur.com/YlQqmaH.png',
          input_message_content: {
            message_text: '🪙 Я вызываю тебя на игру в "Монетку"! Кто победит?'
          },
          reply_markup: Markup.inlineKeyboard([
            Markup.button.webApp('Принять вызов', `${webAppUrl}?game=coin&challenge=true`)
          ])
        }
      ];
      
      // Если запрос содержит "события" или "ивенты", добавляем вариант с событиями
      if (query.includes('событ') || query.includes('ивент')) {
        results.push({
          type: 'article',
          id: 'events',
          title: 'События и прогнозы',
          description: 'Делайте ставки на события и прогнозы',
          thumb_url: 'https://i.imgur.com/KgUvuHC.png',
          input_message_content: {
            message_text: '🔮 Проверьте новые события и сделайте свои прогнозы!'
          },
          reply_markup: Markup.inlineKeyboard([
            Markup.button.webApp('Открыть события', `${webAppUrl}?screen=events`)
          ])
        });
      }
      
      // Отправляем результаты
      await ctx.answerInlineQuery(results);
    } catch (error) {
      console.error('Ошибка при обработке inline запроса:', error);
      await ctx.answerInlineQuery([]);
    }
  });
  
  return bot;
}

module.exports = {
  registerInlineHandlers
};