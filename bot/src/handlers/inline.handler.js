// bot/src/handlers/inline.handler.js - ТЕСТОВЫЙ КОД КАК У GAMEE
const config = require('../config');

function registerInlineHandlers(bot) {
  bot.on('inline_query', async (ctx) => {
    try {
      console.log('📥 Inline query от:', ctx.from.username);
      
      // Один результат как у Gamee
      const results = [{
        type: 'article',
        id: '1',
        title: '🎮 Greenlight Casino',
        description: 'Play now',
        thumb_url: 'https://cdn-icons-png.flaticon.com/128/1055/1055815.png',
        input_message_content: {
          message_text: '🎮 *Greenlight Casino*\n\nClick Play to start!',
          parse_mode: 'Markdown'
        },
        reply_markup: {
          inline_keyboard: [[
            {
              text: '▶️ Play',
              web_app: { url: config.webAppUrl }
            }
          ]]
        }
      }];
      
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: false
      });
      
      console.log('✅ Inline ответ отправлен');
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await ctx.answerInlineQuery([]);
    }
  });
}

module.exports = {
  registerInlineHandlers
};