// bot/src/commands/withdraw.command.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик команды /withdraw
 * @param {Object} ctx - Контекст Telegraf
 */
async function withdrawCommand(ctx) {
  try {
    const { webAppUrl } = config;
    
    // Отправляем инструкцию и кнопку для перехода в WebApp
    await ctx.reply(
      '💸 Вывод средств\n\n' +
      '📋 Инструкция:\n' +
      '1. Минимальная сумма вывода: 1 USDT\n' +
      '2. Максимальная сумма вывода: 10,000 USDT\n' +
      '3. Выводы до 300 USDT обрабатываются автоматически\n' +
      '4. Выводы свыше 300 USDT требуют одобрения администратора\n' +
      '5. Время обработки: от 5 минут до 48 часов\n\n' +
      '⚠️ Важно:\n' +
      '• Убедитесь, что указываете правильный Telegram username получателя\n' +
      '• Username должен быть без символа @\n' +
      '• Получатель должен быть зарегистрирован в @CryptoBot\n\n' +
      'Нажмите кнопку ниже для оформления вывода:',
      Markup.inlineKeyboard([
        [Markup.button.webApp('💸 Оформить вывод', `${webAppUrl}?screen=withdraw`)],
        [Markup.button.callback('📋 История выводов', 'withdrawals_history')]
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /withdraw:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = withdrawCommand;