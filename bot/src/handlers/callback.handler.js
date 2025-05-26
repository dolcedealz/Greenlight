// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  
  // Обработка действий пополнения баланса
  bot.action(/^deposit:(\d+|custom)$/, async (ctx) => {
    try {
      const amount = ctx.match[1];
      
      console.log(`ДЕПОЗИТ: Обработка callback deposit:${amount}`);
      
      if (amount === 'custom') {
        // Устанавливаем флаг ожидания суммы депозита
        ctx.session = ctx.session || {};
        ctx.session.waitingForDepositAmount = true;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          '💰 Введите сумму для пополнения (в USDT):\n\n' +
          'Минимум: 1 USDT\n' +
          'Максимум: 10000 USDT\n\n' +
          'Для отмены введите /cancel'
        );
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
        await ctx.reply('❌ Не удалось создать счет для оплаты. Попробуйте позже.');
      }
      
    } catch (error) {
      console.error('ДЕПОЗИТ: Ошибка при обработке действия пополнения:', error);
      await ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.');
      await ctx.answerCbQuery('❌ Ошибка создания счета');
    }
  });
  
  // Обработка проверки статуса депозита
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
      console.error('СТАТУС: Ошибка при проверке статуса депозита:', error);
      await ctx.reply('❌ Не удалось проверить статус депозита');
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
      
      if (amount === 'custom') {
        // Устанавливаем флаг ожидания суммы вывода
        ctx.session.waitingForWithdrawAmount = true;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          '💰 Введите сумму для вывода (в USDT):\n\n' +
          'Минимум: 1 USDT\n' +
          'Максимум: 10000 USDT\n\n' +
          'Для отмены введите /cancel'
        );
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
      
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < amountFloat) {
        await ctx.reply(`❌ Недостаточно средств\n\nВаш баланс: ${balance.toFixed(2)} USDT\nЗапрошено: ${amountFloat} USDT`);
        return;
      }
      
      // Сохраняем сумму и запрашиваем получателя
      ctx.session.withdrawAmount = amountFloat;
      ctx.session.waitingForWithdrawRecipient = true;
      
      await ctx.reply(
        '📤 Куда вывести средства?\n\n' +
        'Введите Telegram username получателя (без @):\n\n' +
        '⚠️ Важно:\n' +
        '• Получатель должен быть зарегистрирован в @CryptoBot\n' +
        '• Username вводится без символа @\n' +
        '• Проверьте правильность username перед отправкой\n\n' +
        'Для отмены введите /cancel'
      );
      
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
        delete ctx.session.waitingForWithdrawAmount;
        delete ctx.session.waitingForWithdrawRecipient;
        
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
    ctx.session = ctx.session || {};
    delete ctx.session.withdrawAmount;
    delete ctx.session.withdrawRecipient;
    delete ctx.session.waitingForWithdrawAmount;
    delete ctx.session.waitingForWithdrawRecipient;
    
    await ctx.editMessageText('❌ Вывод средств отменен');
  });

  // Обработка истории выводов
  bot.action('withdrawals_history', async (ctx) => {
    try {
      console.log(`ИСТОРИЯ ВЫВОДОВ: Запрос от пользователя ${ctx.from.id}`);
      
      await ctx.answerCbQuery('⏳ Загружаем историю выводов...');
      
      // Получаем историю выводов через API
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
  
  // Обработка проверки статуса вывода
  bot.action(/^check_withdrawal_status:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      
      console.log(`СТАТУС ВЫВОДА: Проверка статуса вывода: ${withdrawalId}`);
      
      await ctx.answerCbQuery('⏳ Проверяем статус вывода...');
      
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
