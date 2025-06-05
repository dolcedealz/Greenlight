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
  
  // Универсальный обработчик для необработанных callback (должен быть в конце)
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      console.log(`🔘 Необработанный callback: ${data} от ${ctx.from.username} (${ctx.from.id})`);
      
      // Отвечаем только если callback не был обработан ранее
      if (!ctx.answerCbQuery.called) {
        await ctx.answerCbQuery('🤖 Функция в разработке');
      }
      
    } catch (error) {
      console.error('Ошибка обработки необработанного callback:', error);
    }
  });
  
  console.log('✅ Callback обработчики зарегистрированы');
}

module.exports = {
  registerCallbackHandlers
};