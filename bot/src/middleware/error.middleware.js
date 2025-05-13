// error.middleware.js
/**
 * Middleware для обработки ошибок
 * @param {Object} ctx - Контекст Telegraf
 * @param {Function} next - Функция next
 */
async function errorMiddleware(ctx, next) {
  try {
    // Передаем управление следующему middleware
    await next();
  } catch (error) {
    // Логируем ошибку
    console.error('Ошибка в боте:', error);
    
    // Отправляем сообщение пользователю об ошибке
    await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    
    // Отправляем ошибку администратору
    if (process.env.ADMIN_ID) {
      try {
        await ctx.telegram.sendMessage(
          process.env.ADMIN_ID,
          `🚨 Ошибка в боте:\n\nПользователь: ${ctx.from.id} (${ctx.from.first_name} ${ctx.from.last_name || ''})\n\nОшибка: ${error.message}\n\nStack: ${error.stack}`
        );
      } catch (e) {
        console.error('Не удалось отправить сообщение об ошибке администратору:', e);
      }
    }
  }
}

module.exports = errorMiddleware;