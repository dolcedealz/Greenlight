// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Регистрация обработчиков callback query (без дуэлей)
 */
function registerCallbackHandlers(bot) {
  console.log('🎯 Регистрация callback обработчиков (без дуэлей)...');
  
  // Здесь можно добавить другие callback обработчики, не связанные с дуэлями
  // Например: профиль, баланс, настройки, другие игры и т.д.
  
  // Обработчик неизвестных callback
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      
      // Если это не дуэльные callback, обрабатываем их здесь
      if (!data.includes('duel') && !data.includes('play_game') && !data.includes('inline_')) {
        console.log(`🔘 Неизвестный callback: ${data}`);
        await ctx.answerCbQuery('🤖 Функция в разработке');
      }
      
    } catch (error) {
      console.error('Ошибка обработки callback:', error);
      await ctx.answerCbQuery('❌ Ошибка обработки');
    }
  });
  
  console.log('✅ Callback обработчики зарегистрированы');
}

module.exports = {
  registerCallbackHandlers
};