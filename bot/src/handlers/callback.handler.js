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
      
      // Специфические сообщения для разных типов callback
      let message = '🤖 Функция в разработке';
      
      if (data.includes('duel') || data.includes('accept') || data.includes('decline')) {
        message = '⚠️ Ошибка обработки дуэли. Попробуйте создать новую дуэль.';
      } else if (data.includes('deposit') || data.includes('withdraw')) {
        message = '💰 Обработка платежей временно недоступна';
      } else if (data.includes('game') || data.includes('play')) {
        message = '🎮 Игровая функция недоступна';
      }
      
      await ctx.answerCbQuery(message);
      
    } catch (error) {
      console.error('Ошибка обработки необработанного callback:', error);
      try {
        await ctx.answerCbQuery('❌ Произошла ошибка');
      } catch (answerError) {
        console.error('Ошибка отправки ответа на callback:', answerError);
      }
    }
  });
  
  console.log('✅ Callback обработчики зарегистрированы');
}

module.exports = {
  registerCallbackHandlers
};