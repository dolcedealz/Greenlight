// index.js
const { registerCallbackHandlers } = require('./callback.handler');
const { registerMessageHandlers } = require('./message.handler');
const { initializeDuelHandlers } = require('./duel');

// Регистрация всех обработчиков
function registerHandlers(bot) {
  console.log('🤖 Регистрация обработчиков...');
  
  // Регистрируем остальные обработчики сначала
  registerCallbackHandlers(bot);
  registerMessageHandlers(bot);
  
  // Регистрируем новые обработчики дуэлей (включая inline)
  initializeDuelHandlers(bot);
  
  console.log('✅ Все обработчики зарегистрированы');
  
  return bot;
}

module.exports = {
  registerHandlers
};