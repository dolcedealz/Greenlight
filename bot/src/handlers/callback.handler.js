// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const { createInvoice } = require('../services/payment.service');

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  // Обработка действий пополнения баланса
  // Обработка действий пополнения баланса
bot.action(/deposit:(\d+|custom)/, async (ctx) => {
  try {
    // Получаем сумму из callback data
    const amount = ctx.match[1];
    
    if (amount === 'custom') {
      // Запрашиваем у пользователя ввод суммы
      await ctx.reply('Введите сумму для пополнения (в USDT):');
      // Устанавливаем флаг в сессии для следующего сообщения
      ctx.session.awaitingDepositAmount = true;
      return;
    }
    
    // Создаем инвойс для оплаты
    const invoice = await createInvoice(ctx.from.id, parseFloat(amount));
    
    // Сохраняем ID инвойса в сессии для последующей проверки
    ctx.session.lastInvoiceId = invoice.invoice_id;
    
    // Отправляем пользователю ссылку на оплату
    await ctx.reply(
      `💰 Создан счет на сумму ${amount} USDT.\n\nНажмите на кнопку ниже для оплаты:`,
      Markup.inlineKeyboard([
        Markup.button.url('Оплатить', invoice.pay_url),
        Markup.button.callback('Проверить статус', 'check_payment')
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке действия пополнения:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
});

// Обработка проверки статуса платежа
bot.action('check_payment', async (ctx) => {
  try {
    await checkPaymentStatus(ctx);
  } catch (error) {
    console.error('Ошибка при проверке статуса платежа:', error);
    await ctx.reply('Произошла ошибка при проверке статуса платежа.');
  }
});
  
  // Обработка других callback запросов
  
  return bot;
}

module.exports = {
  registerCallbackHandlers
};