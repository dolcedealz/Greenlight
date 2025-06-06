// admin/src/handlers/index.js
const { registerCallbackHandlers } = require('./callback.handler');
const { registerMessageHandlers } = require('./message.handler');

/**
 * Регистрирует все обработчики для админ-бота
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerHandlers(bot) {
  console.log('🚀 Регистрация всех handlers...');
  
  // Регистрируем callback handlers
  registerCallbackHandlers(bot);
  
  // Регистрируем message handlers
  registerMessageHandlers(bot);
  
  console.log('✅ Все handlers зарегистрированы успешно');
  
  return bot;
}

module.exports = {
  registerHandlers
};
