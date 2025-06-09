// deposit.command.js
const { Markup } = require('telegraf');
const config = require('../config');
const { createInvoice } = require('../services/payment.service');
const { checkChatType } = require('../utils/chat-utils');

/**
 * Обработчик команды /deposit
 * @param {Object} ctx - Контекст Telegraf
 */
async function depositCommand(ctx) {
  // Только в личных сообщениях
  const chatCheck = checkChatType(ctx, ['private']);
  if (!chatCheck.isAllowed) {
    await ctx.reply(chatCheck.message, { parse_mode: 'Markdown' });
    return;
  }
  try {
    // Получаем данные пользователя
    const { id } = ctx.from;
    
    // Отправляем сообщение с кнопками для выбора суммы депозита + информация о комиссии
    const depositMessage = `${config.messages.deposit}\n\nℹ️ *Информация о комиссии:*\nКомиссия платежной системы CryptoBot составляет 3%\nВы получите 97% от суммы депозита на баланс`;
    
    await ctx.reply(
      depositMessage,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('10 USDT (получите 9.70)', 'deposit:10'),
            Markup.button.callback('20 USDT (получите 19.40)', 'deposit:20')
          ],
          [
            Markup.button.callback('50 USDT (получите 48.50)', 'deposit:50'),
            Markup.button.callback('100 USDT (получите 97.00)', 'deposit:100')
          ],
          [
            Markup.button.callback('500 USDT (получите 485.00)', 'deposit:500'),
            Markup.button.callback('1000 USDT (получите 970.00)', 'deposit:1000')
          ],
          [
            Markup.button.callback('Другая сумма', 'deposit:custom')
          ]
        ])
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /deposit:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = depositCommand;