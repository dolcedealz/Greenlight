// index.js
const { registerCallbackHandlers } = require('./callback.handler');
const { registerInlineHandlers } = require('./inline.handler');
const { registerMessageHandlers } = require('./message.handler');
const { initializeDuelHandlers } = require('./duel');

// Регистрация всех обработчиков
function registerHandlers(bot) {
  console.log('🤖 Регистрация обработчиков...');
  
  // Регистрируем новые обработчики дуэлей
  initializeDuelHandlers(bot);
  
  // Регистрируем остальные обработчики (пока оставляем для совместимости)
  registerCallbackHandlers(bot);
  registerInlineHandlers(bot);
  registerMessageHandlers(bot);
  
  console.log('✅ Все обработчики зарегистрированы');
  
  return bot;
}

module.exports = {
  registerHandlers
};