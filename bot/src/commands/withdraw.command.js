// bot/src/commands/withdraw.command.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик команды /withdraw
 * @param {Object} ctx - Контекст Telegraf
 */
async function withdrawCommand(ctx) {
  try {
    // Отправляем сообщение с кнопками для выбора суммы вывода
    await ctx.reply(
      '💸 Вывод средств\n\n' +
      '📋 Условия вывода:\n' +
      '• Минимальная сумма: 1 USDT\n' +
      '• Максимальная сумма: 10,000 USDT\n' +
      '• До 300 USDT - автоматически\n' +
      '• Свыше 300 USDT - требует одобрения\n' +
      '• Время обработки: 5-15 минут\n\n' +
      'Выберите сумму для вывода:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('10 USDT', 'withdraw:10'),
          Markup.button.callback('20 USDT', 'withdraw:20'),
          Markup.button.callback('50 USDT', 'withdraw:50')
        ],
        [
          Markup.button.callback('100 USDT', 'withdraw:100'),
          Markup.button.callback('500 USDT', 'withdraw:500'),
          Markup.button.callback('1000 USDT', 'withdraw:1000')
        ],
        [
          Markup.button.callback('Другая сумма', 'withdraw:custom'),
          Markup.button.callback('📋 История выводов', 'withdrawals_history')
        ]
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /withdraw:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = withdrawCommand;