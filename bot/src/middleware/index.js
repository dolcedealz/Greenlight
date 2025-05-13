// index.js
const loggerMiddleware = require('./logger.middleware');
const errorMiddleware = require('./error.middleware');

/**
 * Применяет все middleware к боту
 * @param {Object} bot - Экземпляр бота Telegraf
 * @returns {Object} - Бот с примененными middleware
 */
function applyMiddleware(bot) {
  // Применяем middleware
  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  
  return bot;
}

module.exports = {
  applyMiddleware
};