const { Markup } = require('telegraf');
const { payment: paymentService } = require('../services');

/**
 * Обработчик для команды проверки статуса платежа
 * @param {Object} ctx - Контекст Telegraf
 */
async function checkPaymentStatus(ctx) {
  try {
    // Извлекаем invoice_id из сообщения или данных
    const invoiceId = ctx.session.lastInvoiceId;
    
    if (!invoiceId) {
      return ctx.reply('У вас нет активных платежей для проверки.');
    }
    
    // Проверяем статус инвойса
    const invoice = await paymentService.checkInvoice(invoiceId);
    
    if (invoice.status === 'paid') {
      await ctx.reply('✅ Платеж успешно выполнен! Ваш баланс обновлен.');
      // Сбрасываем ID инвойса в сессии
      ctx.session.lastInvoiceId = null;
    } else if (invoice.status === 'active') {
      await ctx.reply(
        '⏳ Платеж в ожидании оплаты. Нажмите кнопку для оплаты:',
        Markup.inlineKeyboard([
          Markup.button.url('Оплатить', invoice.pay_url)
        ])
      );
    } else {
      await ctx.reply(`❌ Статус платежа: ${invoice.status}`);
      // Сбрасываем ID инвойса в сессии
      ctx.session.lastInvoiceId = null;
    }
  } catch (error) {
    console.error('Ошибка при проверке статуса платежа:', error);
    await ctx.reply('Произошла ошибка при проверке статуса платежа.');
  }
}

module.exports = {
  checkPaymentStatus
};