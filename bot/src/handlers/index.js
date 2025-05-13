// index.js
const { registerCallbackHandlers } = require('./callback.handler');
const { registerInlineHandlers } = require('./inline.handler');
const { registerMessageHandlers } = require('./message.handler');

// Регистрация всех обработчиков
function registerHandlers(bot) {
  // Регистрируем обработчики
  registerCallbackHandlers(bot);
  registerInlineHandlers(bot);
  registerMessageHandlers(bot);
  
  return bot;
}

module.exports = {
  registerHandlers
};