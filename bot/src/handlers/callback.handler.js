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

  // Обработка действий вывода средств
  bot.action(/^withdraw:(\d+|custom)$/, async (ctx) => {
    try {
      const amount = ctx.match[1];
      
      console.log(`ВЫВОД: Обработка callback withdraw:${amount}`);
      
      // Сохраняем сумму в сессии
      ctx.session = ctx.session || {};
      ctx.session.withdrawAmount = amount;
      
      if (amount === 'custom') {
        // Запрашиваем у пользователя ввод суммы
        await ctx.reply(
          '💰 Введите сумму для вывода (в USDT):\n\n' +
          'Минимум: 1 USDT\nМаксимум: 10000 USDT'
        );
        ctx.session.waitingForWithdrawAmount = true;
        return;
      }
      
      // Валидация суммы
      const amountFloat = parseFloat(amount);
      
      if (isNaN(amountFloat) || amountFloat <= 0) {
        await ctx.reply('❌ Некорректная сумма для вывода');
        return;
      }
      
      if (amountFloat < 1) {
        await ctx.reply('❌ Минимальная сумма вывода: 1 USDT');
        return;
      }
      
      if (amountFloat > 10000) {
        await ctx.reply('❌ Максимальная сумма вывода: 10000 USDT');
        return;
      }
      
      // Проверяем баланс пользователя
      await ctx.answerCbQuery('⏳ Проверяем баланс...');
      
      const apiService = require('../services/api.service');
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < amountFloat) {
        await ctx.reply(`❌ Недостаточно средств\n\nВаш баланс: ${balance.toFixed(2)} USDT\nЗапрошено: ${amountFloat} USDT`);
        return;
      }
      
      // Сохраняем сумму и запрашиваем получателя
      ctx.session.withdrawAmount = amountFloat;
      
      await ctx.reply(
        '📤 Куда вывести средства?\n\n' +
        'Введите Telegram username получателя (без @):\n\n' +
        '⚠️ Важно:\n' +
        '• Получатель должен быть зарегистрирован в @CryptoBot\n' +
        '• Username вводится без символа @\n' +
        '• Проверьте правильность username перед отправкой'
      );
      
      ctx.session.waitingForWithdrawRecipient = true;
      
    } catch (error) {
      console.error('ВЫВОД: Ошибка при обработке действия вывода:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка');
    }
  });

  // Обработка подтверждения вывода
  bot.action(/^confirm_withdraw:(.+)$/, async (ctx) => {
    try {
      const data = ctx.match[1];
      const [amount, recipient] = data.split(':');
      
      await ctx.answerCbQuery('⏳ Создаем запрос на вывод...');
      
      console.log(`ВЫВОД: Подтверждение вывода ${amount} USDT для ${recipient}`);
      
      const apiService = require('../services/api.service');
      
      try {
        // Создаем запрос на вывод через API
        const withdrawalData = await apiService.createWithdrawal(ctx.from, {
          amount: parseFloat(amount),
          recipient: recipient,
          recipientType: 'username',
          comment: `Вывод через Telegram бот`
        });
        
        console.log(`ВЫВОД: Запрос на вывод создан:`, withdrawalData);
        
        // Формируем сообщение в зависимости от суммы
        let message = `✅ Запрос на вывод создан\n\n` +
          `💵 Сумма: ${amount} USDT\n` +
          `📤 Получатель: @${recipient}\n` +
          `🆔 ID вывода: ${withdrawalData.withdrawalId}\n`;
        
        if (withdrawalData.requiresApproval) {
          message += `\n⏳ Статус: Требует одобрения администратора\n` +
            `⏰ Время обработки: 24-48 часов`;
        } else {
          message += `\n⚡ Статус: Автоматическая обработка\n` +
            `⏰ Время обработки: 5-15 минут`;
        }
        
        await ctx.editMessageText(message, 
          Markup.inlineKeyboard([
            [Markup.button.callback('📊 Проверить статус', `check_withdrawal_status:${withdrawalData.withdrawalId}`)],
            [Markup.button.callback('📋 История выводов', 'withdrawals_history')]
          ])
        );
        
        // Очищаем сессию
        delete ctx.session.withdrawAmount;
        delete ctx.session.withdrawRecipient;
        
      } catch (apiError) {
        console.error('ВЫВОД: Ошибка API при создании вывода:', apiError);
        
        let errorMessage = '❌ Не удалось создать запрос на вывод\n\n';
        
        if (apiError.message.includes('Недостаточно средств')) {
          errorMessage += 'Недостаточно средств на балансе';
        } else if (apiError.message.includes('активный запрос')) {
          errorMessage += 'У вас уже есть активный запрос на вывод';
        } else if (apiError.message.includes('username')) {
          errorMessage += 'Некорректный username получателя';
        } else {
          errorMessage += apiError.message || 'Попробуйте позже';
        }
        
        await ctx.editMessageText(errorMessage);
      }
      
    } catch (error) {
      console.error('ВЫВОД: Ошибка при подтверждении вывода:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка');
    }
  });

  // Обработка отмены вывода
  bot.action('cancel_withdraw', async (ctx) => {
    await ctx.answerCbQuery('Отменено');
    
    // Очищаем сессию
    delete ctx.session.withdrawAmount;
    delete ctx.session.withdrawRecipient;
    
    await ctx.editMessageText('❌ Вывод средств отменен');
  });

  // Обработка истории выводов
  bot.action('withdrawals_history', async (ctx) => {
    try {
      console.log(`ИСТОРИЯ ВЫВОДОВ: Запрос от пользователя ${ctx.from.id}`);
      
      await ctx.answerCbQuery('⏳ Загружаем историю выводов...');
      
      // Получаем историю выводов через API
      const apiService = require('../services/api.service');
      const withdrawalsData = await apiService.getUserWithdrawals(ctx.from, { limit: 10 });
      
      if (!withdrawalsData.withdrawals || withdrawalsData.withdrawals.length === 0) {
        await ctx.reply('📋 У вас пока нет запросов на вывод средств');
        return;
      }
      
      // Формируем сообщение с историей
      let message = '📋 История выводов (последние 10):\n\n';
      
      for (const withdrawal of withdrawalsData.withdrawals) {
        const date = new Date(withdrawal.createdAt).toLocaleDateString('ru-RU');
        let statusEmoji = '';
        let statusText = '';
        
        switch (withdrawal.status) {
          case 'pending':
            statusEmoji = '⏳';
            statusText = 'Ожидает';
            break;
          case 'approved':
            statusEmoji = '✅';
            statusText = 'Одобрен';
            break;
          case 'processing':
            statusEmoji = '⚙️';
            statusText = 'Обрабатывается';
            break;
          case 'completed':
            statusEmoji = '✅';
            statusText = 'Выполнен';
            break;
          case 'rejected':
            statusEmoji = '❌';
            statusText = 'Отклонен';
            break;
          case 'failed':
            statusEmoji = '⚠️';
            statusText = 'Ошибка';
            break;
        }
        
        message += `${statusEmoji} ${date} - ${withdrawal.amount} USDT\n`;
        message += `   Получатель: ${withdrawal.recipient}\n`;
        message += `   Статус: ${statusText}\n`;
        
        if (withdrawal.rejectionReason) {
          message += `   Причина: ${withdrawal.rejectionReason}\n`;
        }
        
        message += '\n';
      }
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ИСТОРИЯ ВЫВОДОВ: Ошибка при получении истории:', error);
      await ctx.reply('❌ Не удалось загрузить историю выводов');
    }
  });
  
  // Обработка проверки статуса конкретного вывода
  bot.action(/^check_withdrawal_status:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      
      console.log(`СТАТУС ВЫВОДА: Проверка статуса вывода: ${withdrawalId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус вывода...');
      
      const apiService = require('../services/api.service');
      const withdrawalInfo = await apiService.getWithdrawalStatus(ctx.from, withdrawalId);
      
      let statusMessage = '';
      let statusEmoji = '';
      
      switch (withdrawalInfo.status) {
        case 'pending':
          statusEmoji = '⏳';
          statusMessage = withdrawalInfo.amount > 300 
            ? 'Ожидает одобрения администратора' 
            : 'Ожидает обработки';
          break;
        case 'approved':
          statusEmoji = '✅';
          statusMessage = 'Одобрен администратором';
          break;
        case 'processing':
          statusEmoji = '⚙️';
          statusMessage = 'Обрабатывается системой';
          break;
        case 'completed':
          statusEmoji = '✅';
          statusMessage = 'Успешно выполнен';
          break;
        case 'rejected':
          statusEmoji = '❌';
          statusMessage = 'Отклонен администратором';
          break;
        case 'failed':
          statusEmoji = '⚠️';
          statusMessage = 'Ошибка при обработке';
          break;
      }
      
      let replyMessage = `📊 Статус вывода\n\n` +
        `🆔 ID: ${withdrawalInfo.id}\n` +
        `💵 Сумма: ${withdrawalInfo.amount} USDT\n` +
        `${statusEmoji} Статус: ${statusMessage}\n` +
        `📅 Создан: ${new Date(withdrawalInfo.createdAt).toLocaleString('ru-RU')}`;
      
      if (withdrawalInfo.processedAt) {
        replyMessage += `\n✅ Обработан: ${new Date(withdrawalInfo.processedAt).toLocaleString('ru-RU')}`;
      }
      
      if (withdrawalInfo.rejectionReason) {
        replyMessage += `\n\n❌ Причина отклонения: ${withdrawalInfo.rejectionReason}`;
      }
      
      await ctx.reply(replyMessage);
      
    } catch (error) {
      console.error('СТАТУС ВЫВОДА: Ошибка при проверке статуса:', error);
      await ctx.reply('❌ Не удалось проверить статус вывода');
      await ctx.answerCbQuery('❌ Ошибка проверки');
    }
  });
  
  return bot;
}

module.exports = {
  registerCallbackHandlers
};