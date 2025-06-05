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
    
    // Отправляем сообщение с кнопками для выбора суммы депозита
    await ctx.reply(
      config.messages.deposit,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('10 USDT', 'deposit:10'),
          Markup.button.callback('20 USDT', 'deposit:20'),
          Markup.button.callback('50 USDT', 'deposit:50')
        ],
        [
          Markup.button.callback('100 USDT', 'deposit:100'),
          Markup.button.callback('500 USDT', 'deposit:500'),
          Markup.button.callback('1000 USDT', 'deposit:1000')
        ],
        [
          Markup.button.callback('Другая сумма', 'deposit:custom')
        ]
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /deposit:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = depositCommand;