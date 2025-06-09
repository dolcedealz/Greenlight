// bot/src/commands/withdraw.command.js
const { Markup } = require('telegraf');
const config = require('../config');
const { checkChatType } = require('../utils/chat-utils');

/**
 * Обработчик команды /withdraw
 * @param {Object} ctx - Контекст Telegraf
 */
async function withdrawCommand(ctx) {
  try {
    // Только в личных сообщениях
    const chatCheck = checkChatType(ctx, ['private']);
    if (!chatCheck.isAllowed) {
      await ctx.reply(chatCheck.message, { parse_mode: 'Markdown' });
      return;
    }
    // Отправляем сообщение с кнопками для выбора суммы вывода + информация о комиссии
    await ctx.reply(
      '💸 Вывод средств\n\n' +
      '📋 Условия вывода:\n' +
      '• Минимальная сумма: 1 USDT\n' +
      '• Максимальная сумма: 10,000 USDT\n' +
      '• До 300 USDT - автоматически\n' +
      '• Свыше 300 USDT - требует одобрения\n' +
      '• Время обработки: 5-15 минут\n\n' +
      '💸 *Комиссия CryptoBot: 3%*\n' +
      'Вы получите 97% от запрошенной суммы\n\n' +
      'Выберите сумму для вывода:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('10 USDT (получите 9.70)', 'withdraw:10'),
            Markup.button.callback('20 USDT (получите 19.40)', 'withdraw:20')
          ],
          [
            Markup.button.callback('50 USDT (получите 48.50)', 'withdraw:50'),
            Markup.button.callback('100 USDT (получите 97.00)', 'withdraw:100')
          ],
          [
            Markup.button.callback('500 USDT (получите 485.00)', 'withdraw:500'),
            Markup.button.callback('1000 USDT (получите 970.00)', 'withdraw:1000')
          ],
          [
            Markup.button.callback('Другая сумма', 'withdraw:custom'),
            Markup.button.callback('📋 История выводов', 'withdrawals_history')
          ]
        ])
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /withdraw:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = withdrawCommand;