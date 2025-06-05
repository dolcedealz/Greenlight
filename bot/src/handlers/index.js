// index.js
const { registerCallbackHandlers } = require('./callback.handler');
const { registerMessageHandlers } = require('./message.handler');
const { initializeDuelHandlers } = require('./duel');

// Регистрация всех обработчиков
function registerHandlers(bot) {
  console.log('🤖 Регистрация обработчиков...');
  
  // ВАЖНО: Сначала регистрируем специфические обработчики (дуэли)
  initializeDuelHandlers(bot);
  
  // Затем общие обработчики
  registerMessageHandlers(bot);
  registerCallbackHandlers(bot);
  
  console.log('✅ Все обработчики зарегистрированы');
  
  return bot;
}

module.exports = {
  registerHandlers
};