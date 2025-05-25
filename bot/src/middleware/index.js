// bot/src/middleware/index.js
const loggerMiddleware = require('./logger.middleware');
const errorMiddleware = require('./error.middleware');
const LocalSession = require('telegraf-session-local');

/**
 * Применяет все middleware к боту
 * @param {Object} bot - Экземпляр бота Telegraf
 * @returns {Object} - Бот с примененными middleware
 */
function applyMiddleware(bot) {
  // Создаем локальную сессию для хранения временных данных
  const localSession = new LocalSession({
    database: 'session_db.json',
    property: 'session',
    storage: LocalSession.storageFileAsync,
    format: {
      serialize: (obj) => JSON.stringify(obj, null, 2),
      deserialize: (str) => JSON.parse(str),
    },
    state: { 
      withdrawAmount: null,
      withdrawRecipient: null,
      waitingForWithdrawAmount: false,
      waitingForWithdrawRecipient: false,
      waitingForDepositAmount: false,
      rejectingWithdrawalId: null
    }
  });
  
  // Применяем middleware в правильном порядке
  bot.use(localSession.middleware());
  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  
  return bot;
}

module.exports = {
  applyMiddleware
};