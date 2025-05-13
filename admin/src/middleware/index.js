// src/middleware/index.js
/**
 * Middleware для проверки доступа администраторов
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Функция next
 * @param {Array} adminIds - Массив ID администраторов
 */
function adminCheckMiddleware(ctx, next, adminIds) {
    const userId = ctx.from?.id;
    
    if (!userId || !adminIds.includes(userId)) {
      console.log(`Отказано в доступе пользователю ${userId}`);
      return ctx.reply('⛔ Доступ запрещен. Этот бот только для администраторов.');
    }
    
    return next();
  }
  
  /**
   * Middleware для логирования активности
   * @param {Object} ctx - Контекст Telegraf
   * @param {Function} next - Функция next
   */
  function loggerMiddleware(ctx, next) {
    const start = new Date();
    const userId = ctx.from?.id;
    const username = ctx.from?.username || 'нет';
    const name = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'нет';
    const text = ctx.message?.text || ctx.update?.callback_query?.data || '';
    
    console.log(`[${start.toISOString()}] Запрос от ${userId} (@${username}, ${name}): ${text}`);
    
    return next().then(() => {
      const ms = new Date() - start;
      console.log(`[${start.toISOString()}] Запрос обработан за ${ms}ms`);
    });
  }
  
  /**
   * Применяет все middleware к боту
   * @param {Object} bot - Экземпляр Telegraf
   * @param {Array} adminIds - Массив ID администраторов
   */
  function applyMiddleware(bot, adminIds) {
    // Прикрепляем middleware для проверки прав администратора
    bot.use((ctx, next) => adminCheckMiddleware(ctx, next, adminIds));
    
    // Прикрепляем middleware для логирования
    bot.use(loggerMiddleware);
    
    return bot;
  }
  
  module.exports = {
    applyMiddleware
  };