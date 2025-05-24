// bot/src/commands/balance.command.js
const apiService = require('../services/api.service');

/**
 * Обработчик команды /balance
 * @param {Object} ctx - Контекст Telegraf
 */
async function balanceCommand(ctx) {
  try {
    console.log(`БАЛАНС: Запрос баланса от пользователя ${ctx.from.id}`);
    
    // Показываем индикатор загрузки
    const loadingMessage = await ctx.reply('⏳ Получаем актуальный баланс...');
    
    try {
      // Получаем баланс через API
      const balance = await apiService.getUserBalance(ctx.from);
      
      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMessage.message_id).catch(() => {});
      
      // Отправляем информацию о балансе
      await ctx.reply(
        `💰 Ваш баланс\n\n` +
        `💵 ${balance.toFixed(2)} USDT\n` +
        `📊 ≈ ${(balance * 95).toFixed(2)} ₽\n\n` +
        `💡 Для пополнения баланса используйте команду /start`
      );
      
      console.log(`БАЛАНС: Баланс пользователя ${ctx.from.id}: ${balance} USDT`);
      
    } catch (apiError) {
      console.error('БАЛАНС: Ошибка API при получении баланса:', apiError);
      
      // Удаляем сообщение о загрузке
      await ctx.deleteMessage(loadingMessage.message_id).catch(() => {});
      
      await ctx.reply(
        '❌ Не удалось получить баланс\n\n' +
        'Попробуйте:\n' +
        '• Команду /start для обновления профиля\n' +
        '• Повторить запрос через несколько секунд\n' +
        '• Обратиться в поддержку, если проблема повторяется'
      );
    }
    
  } catch (error) {
    console.error('БАЛАНС: Ошибка при обработке команды /balance:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
  }
}

module.exports = balanceCommand;

// ===== Добавить в bot/src/commands/index.js =====

// В файл bot/src/commands/index.js добавить:
// const balanceCommand = require('./balance.command');

// И в функцию registerCommands добавить:
// bot.command('balance', balanceCommand);