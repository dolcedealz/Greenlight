// ===== 1. bot/src/handlers/callback.handler.js =====

// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  // ИСПРАВЛЕНО: Более специфичные регулярные выражения для избежания конфликтов
  
  // Обработка действий пополнения баланса - СТРОГО только числа или 'custom'
  bot.action(/^deposit:(\d+|custom)$/, async (ctx) => {
    try {
      // Получаем сумму из callback data
      const amount = ctx.match[1];
      
      console.log(`ДЕПОЗИТ: Обработка callback deposit:${amount}`);
      
      if (amount === 'custom') {
        // Запрашиваем у пользователя ввод суммы
        await ctx.reply('💰 Введите сумму для пополнения (в USDT):\n\nМинимум: 1 USDT\nМаксимум: 10000 USDT');
        // TODO: Добавить обработчик для пользовательского ввода суммы
        return;
      }
      
      // Валидация суммы
      const amountFloat = parseFloat(amount);
      console.log(`ДЕПОЗИТ: Parsed amount = ${amountFloat}`);
      
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
      
      console.log(`ДЕПОЗИТ: Создание депозита через API для пользователя ${ctx.from.id} на сумму ${amountFloat} USDT`);
      
      try {
        // Создаем депозит через API backend'а
        const depositData = await apiService.createDeposit(ctx.from, amountFloat, {
          source: 'bot',
          description: `Пополнение через Telegram бот на ${amountFloat} USDT`
        });
        
        console.log(`ДЕПОЗИТ: Депозит создан через API:`, depositData);
        
        // Отправляем пользователю ссылку на оплату
        await ctx.reply(
          `💰 Создан счет на пополнение баланса\n\n` +
          `💵 Сумма: ${amountFloat} USDT\n` +
          `🆔 ID депозита: ${depositData.depositId}\n` +
          `🧾 ID инвойса: ${depositData.invoiceId}\n` +
          `⏰ Срок действия: 1 час\n\n` +
          `Нажмите на кнопку ниже для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', depositData.payUrl)],
            [Markup.button.callback('📋 Статус платежа', `check_deposit_status:${depositData.depositId}`)]
          ])
        );
        
      } catch (apiError) {
        console.error('ДЕПОЗИТ: Ошибка API при создании депозита:', apiError);
        
        // Fallback: используем старый метод через прямое обращение к CryptoBot
        console.log('ДЕПОЗИТ: Fallback: создаем инвойс напрямую через CryptoBot');
        
        const paymentService = require('../services/payment.service');
        const invoice = await paymentService.createInvoice(ctx.from.id, amountFloat);
        
        if (!invoice || !invoice.pay_url) {
          throw new Error('Неверные данные инвойса от CryptoBot');
        }
        
        console.log(`ДЕПОЗИТ: Fallback инвойс создан: ${invoice.invoice_id}`);
        
        // Отправляем пользователю ссылку на оплату (fallback режим)
        await ctx.reply(
          `💰 Создан счет на пополнение баланса (резервный режим)\n\n` +
          `💵 Сумма: ${amountFloat} USDT\n` +
          `🆔 ID счета: ${invoice.invoice_id}\n` +
          `⏰ Срок действия: 1 час\n\n` +
          `⚠️ Внимание: Средства будут зачислены после подтверждения администратором\n\n` +
          `Нажмите на кнопку ниже для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', invoice.pay_url)],
            [Markup.button.callback('📋 Статус платежа', `check_payment_fallback:${invoice.invoice_id}`)]
          ])
        );
      }
      
    } catch (error) {
      console.error('ДЕПОЗИТ: Ошибка при обработке действия пополнения:', error);
      
      // Более информативные сообщения об ошибках
      let errorMessage = 'Произошла ошибка при создании счета для оплаты. Пожалуйста, попробуйте еще раз.';
      
      if (error.message.includes('CryptoBot API Error')) {
        errorMessage = '❌ Ошибка платежной системы. Попробуйте позже или обратитесь в поддержку.';
      } else if (error.message.includes('не настроен')) {
        errorMessage = '❌ Платежная система временно недоступна. Обратитесь в поддержку.';
      } else if (error.message.includes('Пользователь не найден')) {
        errorMessage = '❌ Ошибка профиля. Попробуйте команду /start';
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
  
  // ИСПРАВЛЕНО: Более специфичный паттерн для проверки статуса депозита
  bot.action(/^check_deposit_status:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const depositId = ctx.match[1];
      
      console.log(`СТАТУС: Проверка статуса депозита: ${depositId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус депозита...');
      
      const depositInfo = await apiService.getDepositStatus(ctx.from, depositId);
      
      let statusMessage = '';
      let statusEmoji = '';
      
      switch (depositInfo.status) {
        case 'pending':
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
        `📊 Статус депозита\n\n` +
        `🆔 ID: ${depositInfo.id}\n` +
        `💵 Сумма: ${depositInfo.amount} USDT\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(depositInfo.createdAt).toLocaleString('ru-RU')}`
      );
      
    } catch (error) {
      console.error('СТАТУС: Ошибка при проверке статуса депозита через API:', error);
      await ctx.reply('❌ Не удалось проверить статус депозита через API');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });
  
  // ИСПРАВЛЕНО: Fallback для старых депозитов с другим паттерном
  bot.action(/^check_payment_fallback:(\d+)$/, async (ctx) => {
    try {
      const invoiceId = ctx.match[1];
      
      console.log(`СТАТУС FALLBACK: Проверка статуса платежа: ${invoiceId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус платежа...');
      
      const paymentService = require('../services/payment.service');
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
          statusMessage = 'Оплачен (требует ручного подтверждения)';
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
        `📊 Статус платежа (резервный режим)\n\n` +
        `🆔 ID: ${invoiceData.invoice_id}\n` +
        `💵 Сумма: ${invoiceData.amount} ${invoiceData.asset}\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(invoiceData.created_at).toLocaleString('ru-RU')}\n\n` +
        `ℹ️ Если платеж оплачен, но средства не зачислены, обратитесь в поддержку`
      );
      
    } catch (error) {
      console.error('СТАТУС FALLBACK: Ошибка при проверке статуса платежа:', error);
      await ctx.reply('❌ Не удалось проверить статус платежа');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });
  
  return bot;
}

module.exports = {
  registerCallbackHandlers
};