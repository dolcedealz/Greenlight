// logger.middleware.js
/**
 * Middleware для логирования запросов к боту
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Функция next
 */
async function loggerMiddleware(ctx, next) {
    const start = new Date();
    const { from, chat, updateType, updateSubType } = ctx;
    
    // Логируем входящий запрос
    console.log(`${start.toISOString()} - Запрос: тип=${updateType}, подтип=${updateSubType || 'нет'}`);
    
    if (from) {
      console.log(`От пользователя: ${from.id} (${from.first_name} ${from.last_name || ''}) ${from.username ? '@' + from.username : ''}`);
    }
    
    if (chat && chat.id !== from.id) {
      console.log(`В чате: ${chat.id} (${chat.title || 'Личные сообщения'})`);
    }
    
    // Передаем управление следующему middleware
    await next();
    
    // Логируем время выполнения
    const ms = new Date() - start;
    console.log(`${start.toISOString()} - Запрос обработан за ${ms}ms`);
  }
  
  module.exports = loggerMiddleware;