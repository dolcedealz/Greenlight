// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const paymentService = require('../services/payment.service'); // Исправлен импорт

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  // Обработка действий пополнения баланса
  bot.action(/deposit:(\d+|custom)/, async (ctx) => {
    try {
      // Получаем сумму из callback data
      const amount = ctx.match[1];
      
      if (amount === 'custom') {
        // Запрашиваем у пользователя ввод суммы
        await ctx.reply('💰 Введите сумму для пополнения (в USDT):\n\nМинимум: 1 USDT\nМаксимум: 10000 USDT');
        // TODO: Добавить обработчик для пользовательского ввода суммы
        return;
      }
      
      // Валидация суммы
      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        await ctx.reply('❌ Некорректная сумма для пополнения');
        return;
      }
      
      if (amountFloat < 1) {
        await ctx.reply('❌ Минимальная сумма пополнения: 1 USDT');
        return;
      }
      
      if (amountFloat > 10000) {
        await ctx.reply('❌ Максимальная сумма пополнения: 10000 USDT');
        return;
      }
      
      // Показываем индикатор загрузки
      await ctx.answerCbQuery('⏳ Создаем счет для оплаты...');
      
      console.log(`Создание инвойса для пользователя ${ctx.from.id} на сумму ${amountFloat} USDT`);
      
      // Создаем инвойс для оплаты
      const invoice = await paymentService.createInvoice(ctx.from.id, amountFloat);
      
      if (!invoice || !invoice.pay_url) {
        throw new Error('Неверные данные инвойса от CryptoBot');
      }
      
      console.log(`Инвойс создан успешно: ${invoice.invoice_id}`);
      
      // Отправляем пользователю ссылку на оплату
      await ctx.reply(
        `💰 Создан счет на пополнение баланса\n\n` +
        `💵 Сумма: ${amountFloat} USDT\n` +
        `🆔 ID счета: ${invoice.invoice_id}\n` +
        `⏰ Срок действия: 1 час\n\n` +
        `Нажмите на кнопку ниже для оплаты:`,
        Markup.inlineKeyboard([
          [Markup.button.url('💳 Оплатить', invoice.pay_url)],
          [Markup.button.callback('📋 Статус платежа', `check_payment:${invoice.invoice_id}`)]
        ])
      );
      
    } catch (error) {
      console.error('Ошибка при обработке действия пополнения:', error);
      
      // Более информативные сообщения об ошибках
      let errorMessage = 'Произошла ошибка при создании счета для оплаты. Пожалуйста, попробуйте еще раз.';
      
      if (error.message.includes('CryptoBot API Error')) {
        errorMessage = '❌ Ошибка платежной системы. Попробуйте позже или обратитесь в поддержку.';
      } else if (error.message.includes('не настроен')) {
        errorMessage = '❌ Платежная система временно недоступна. Обратитесь в поддержку.';
      }
      
      await ctx.reply(errorMessage);
      
      // Отвечаем на callback query, если это еще не сделано
      try {
        await ctx.answerCbQuery('❌ Ошибка создания счета');
      } catch (cbError) {
        // Игнорируем ошибку, если callback query уже отвечен
      }
    }
  });
  
  // Обработка проверки статуса платежа
  bot.action(/check_payment:(.+)/, async (ctx) => {
    try {
      const invoiceId = ctx.match[1];
      
      await ctx.answerCbQuery('⏳ Проверяем статус платежа...');
      
      console.log(`Проверка статуса платежа: ${invoiceId}`);
      
      const invoiceData = await paymentService.checkInvoice(invoiceId);
      
      if (!invoiceData) {
        await ctx.reply('❌ Счет не найден');
        return;
      }
      
      let statusMessage = '';
      let statusEmoji = '';
      
      switch (invoiceData.status) {
        case 'active':
          statusEmoji = '⏳';
          statusMessage = 'Ожидает оплаты';
          break;
        case 'paid':
          statusEmoji = '✅';
          statusMessage = 'Оплачен - средства зачислены на баланс';
          break;
        case 'expired':
          statusEmoji = '⏰';
          statusMessage = 'Истек срок действия';
          break;
        default:
          statusEmoji = '❓';
          statusMessage = 'Неизвестный статус';
      }
      
      await ctx.reply(
        `📊 Статус платежа\n\n` +
        `🆔 ID: ${invoiceData.invoice_id}\n` +
        `💵 Сумма: ${invoiceData.amount} ${invoiceData.asset}\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(invoiceData.created_at).toLocaleString('ru-RU')}`
      );
      
    } catch (error) {
      console.error('Ошибка при проверке статуса платежа:', error);
      await ctx.reply('❌ Не удалось проверить статус платежа');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });
  
  // Обработка других callback запросов можно добавить здесь
  
  return bot;
}

module.exports = {
  registerCallbackHandlers
};