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
    // Важно: getSessionKey должен быть определен для корректной работы с callback queries
    getSessionKey: (ctx) => {
      // Для callback queries
      if (ctx.from && ctx.chat) {
        return `${ctx.from.id}:${ctx.chat.id}`;
      }
      // Для обычных сообщений
      if (ctx.from && ctx.from.id) {
        return ctx.from.id.toString();
      }
      return null;
    }
  });
  
  // Применяем middleware в правильном порядке
  // Сначала сессии, чтобы они были доступны в других middleware
  bot.use(localSession.middleware());
  
  // Middleware для инициализации сессии
  bot.use((ctx, next) => {
    // Убеждаемся, что сессия всегда инициализирована
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Инициализируем поля сессии, если они не существуют
    ctx.session = {
      withdrawAmount: ctx.session.withdrawAmount || null,
      withdrawRecipient: ctx.session.withdrawRecipient || null,
      waitingForWithdrawAmount: ctx.session.waitingForWithdrawAmount || false,
      waitingForWithdrawRecipient: ctx.session.waitingForWithdrawRecipient || false,
      waitingForDepositAmount: ctx.session.waitingForDepositAmount || false,
      rejectingWithdrawalId: ctx.session.rejectingWithdrawalId || null,
      withdrawingProfit: ctx.session.withdrawingProfit || false,
      ...ctx.session // Сохраняем существующие значения
    };
    
    return next();
  });
  
  // Затем обработка ошибок
  bot.use(errorMiddleware);
  
  // И логирование
  bot.use(loggerMiddleware);
  
  return bot;
}

module.exports = {
  applyMiddleware
};
