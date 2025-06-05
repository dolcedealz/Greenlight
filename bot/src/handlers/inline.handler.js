// bot/src/handlers/inline.handler.js
const config = require('../config');

function registerInlineHandlers(bot) {
  // Обработчик inline запросов
  bot.on('inline_query', async (ctx) => {
    try {
      console.log('Inline запрос получен от:', ctx.inlineQuery.from.username);
      
      // Создаем один результат - кнопку для открытия казино
      const results = [{
        type: 'article',
        id: 'casino_' + Date.now(),
        title: '🎰 Открыть Greenlight Casino',
        description: 'Нажмите чтобы отправить кнопку казино',
        thumb_url: 'https://cdn-icons-png.flaticon.com/512/3163/3163238.png',
        input_message_content: {
          message_text: '🎰 **Greenlight Casino**\n\nНажмите кнопку ниже чтобы играть!',
          parse_mode: 'Markdown'
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🎮 Играть',
              web_app: { url: config.webAppUrl }
            }
          ]]
        }
      }];
      
      // Отправляем результат
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true
      });
      
      console.log('Inline ответ отправлен');
      
    } catch (error) {
      console.error('Ошибка в inline handler:', error);
    }
  });
  
  // Логируем когда пользователь выбрал результат
  bot.on('chosen_inline_result', async (ctx) => {
    console.log('Пользователь выбрал inline результат:', {
      resultId: ctx.chosenInlineResult.result_id,
      user: ctx.chosenInlineResult.from.username
    });
  });
}

module.exports = {
  registerInlineHandlers
};