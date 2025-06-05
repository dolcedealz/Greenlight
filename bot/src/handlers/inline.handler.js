// bot/src/handlers/inline.handler.js
const config = require('../config');
const { Markup } = require('telegraf');

function registerInlineHandlers(bot) {
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.toLowerCase().trim();
      const results = [];
      
      // Простой тест - любой запрос
      results.push({
        type: 'article',
        id: 'test_casino_' + Date.now(),
        title: '🎰 Открыть казино',
        description: 'Нажмите чтобы отправить кнопку казино',
        thumb_url: 'https://cdn-icons-png.flaticon.com/512/3163/3163238.png',
        input_message_content: {
          message_text: '🎰 **Greenlight Casino** 🎰\n\n🎮 Играйте и выигрывайте!',
          parse_mode: 'Markdown'
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🎮 Открыть казино',
              web_app: { url: config.webAppUrl }
            }
          ]]
        }
      });
      
      // Тест с обычной callback кнопкой
      results.push({
        type: 'article',
        id: 'test_callback_' + Date.now(),
        title: '🔘 Тест callback кнопки',
        description: 'Проверка работы callback',
        input_message_content: {
          message_text: '🧪 Тест callback кнопки'
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '👋 Нажми меня',
              callback_data: 'test_button'
            }
          ]]
        }
      });
      
      // Тест с URL кнопкой
      results.push({
        type: 'article',
        id: 'test_url_' + Date.now(),
        title: '🔗 Тест URL кнопки',
        description: 'Проверка работы URL',
        input_message_content: {
          message_text: '🔗 Тест URL кнопки'
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🌐 Google',
              url: 'https://google.com'
            }
          ]]
        }
      });
      
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true
      });
      
    } catch (error) {
      console.error('Ошибка inline query:', error);
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'error',
        title: '❌ Ошибка',
        description: error.message,
        input_message_content: {
          message_text: '❌ Произошла ошибка: ' + error.message
        }
      }]);
    }
  });
}

module.exports = {
  registerInlineHandlers
};