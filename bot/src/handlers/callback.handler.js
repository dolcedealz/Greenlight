// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Регистрация обработчиков callback query (без дуэлей)
 */
function registerCallbackHandlers(bot) {
  console.log('🎯 Регистрация callback обработчиков (без дуэлей)...');
  
  // ДЕПОЗИТЫ - обработчики для кнопок пополнения
  
  // Обработчики фиксированных сумм депозитов
  const depositAmounts = [10, 20, 50, 100, 500, 1000];
  
  depositAmounts.forEach(amount => {
    bot.action(`deposit:${amount}`, async (ctx) => {
      try {
        console.log(`💰 Депозит ${amount} USDT запрошен пользователем ${ctx.from.username} (${ctx.from.id})`);
        
        await ctx.answerCbQuery(`Создание счета на ${amount} USDT...`);
        
        const depositData = await apiService.createDeposit(ctx.from, amount, {
          source: 'bot_button',
          description: `Пополнение через бот: ${amount} USDT`
        });
        
        const netAmount = Math.round((amount * 0.97) * 100) / 100;
        await ctx.editMessageText(
          `💰 Счет создан успешно!\n\n` +
          `💵 Сумма депозита: ${amount} USDT\n` +
          `💸 Комиссия CryptoBot: ${(amount * 0.03).toFixed(2)} USDT (3%)\n` +
          `💰 К зачислению: ${netAmount} USDT\n` +
          `🆔 ID: ${depositData.depositId}\n` +
          `⏰ Действует: 1 час\n\n` +
          `👇 Нажмите для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', depositData.payUrl)],
            [Markup.button.callback('📋 Проверить статус', `check_deposit_status:${depositData.depositId}`)],
            [Markup.button.callback('⬅️ Назад', 'back_to_deposit_menu')]
          ])
        );
      } catch (error) {
        console.error(`Ошибка создания депозита ${amount} USDT:`, error);
        await ctx.answerCbQuery('❌ Ошибка создания счета. Попробуйте позже.');
        
        await ctx.editMessageText(
          `❌ Не удалось создать счет на ${amount} USDT\n\n` +
          `Причина: ${error.message}\n\n` +
          `Попробуйте еще раз или свяжитесь с поддержкой.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Попробовать снова', `deposit:${amount}`)],
            [Markup.button.callback('⬅️ Назад', 'back_to_deposit_menu')]
          ])
        );
      }
    });
  });
  
  // Обработчик для "Другая сумма"
  bot.action('deposit:custom', async (ctx) => {
    try {
      console.log(`💰 Депозит (другая сумма) запрошен пользователем ${ctx.from.username} (${ctx.from.id})`);
      
      await ctx.answerCbQuery('Введите сумму пополнения...');
      
      // Устанавливаем флаг ожидания суммы
      ctx.session = ctx.session || {};
      ctx.session.waitingForDepositAmount = true;
      
      await ctx.editMessageText(
        `💰 Пополнение баланса\n\n` +
        `💵 Введите сумму для пополнения:\n\n` +
        `📋 Условия:\n` +
        `• Минимум: 1 USDT\n` +
        `• Максимум: 10,000 USDT\n` +
        `• Валюта: только USDT\n` +
        `• Комиссия CryptoBot: 3%\n\n` +
        `ℹ️ Вы получите 97% от суммы на баланс\n\n` +
        `✍️ Напишите сумму числом (например: 25):`,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'cancel_deposit')]
        ])
      );
    } catch (error) {
      console.error('Ошибка обработки deposit:custom:', error);
      await ctx.answerCbQuery('❌ Ошибка. Попробуйте позже.');
    }
  });
  
  // Обработчик проверки статуса депозита
  bot.action(/^check_deposit_status:(.+)$/, async (ctx) => {
    try {
      const depositId = ctx.match[1];
      console.log(`📋 Проверка статуса депозита ${depositId} пользователем ${ctx.from.username}`);
      
      await ctx.answerCbQuery('Проверяем статус...');
      
      const depositInfo = await apiService.getDepositInfo(ctx.from, depositId);
      
      let statusText = '';
      let statusEmoji = '';
      
      switch (depositInfo.status) {
        case 'pending':
          statusEmoji = '⏳';
          statusText = 'Ожидает оплаты';
          break;
        case 'paid':
          statusEmoji = '✅';
          statusText = 'Оплачен, обрабатывается';
          break;
        case 'completed':
          statusEmoji = '🎉';
          statusText = 'Завершен успешно';
          break;
        case 'expired':
          statusEmoji = '⏰';
          statusText = 'Истек срок действия';
          break;
        case 'cancelled':
          statusEmoji = '❌';
          statusText = 'Отменен';
          break;
        default:
          statusEmoji = '❓';
          statusText = 'Неизвестный статус';
      }
      
      const keyboard = [];
      
      if (depositInfo.status === 'pending') {
        keyboard.push([Markup.button.url('💳 Оплатить', depositInfo.payUrl)]);
        keyboard.push([Markup.button.callback('🔄 Обновить статус', `check_deposit_status:${depositId}`)]);
      } else if (depositInfo.status === 'completed') {
        keyboard.push([Markup.button.callback('💰 Проверить баланс', 'check_balance')]);
      }
      
      keyboard.push([Markup.button.callback('⬅️ Назад', 'back_to_deposit_menu')]);
      
      await ctx.editMessageText(
        `${statusEmoji} Статус депозита\n\n` +
        `🆔 ID: ${depositId}\n` +
        `💵 Сумма: ${depositInfo.amount} USDT\n` +
        `📊 Статус: ${statusText}\n` +
        `⏰ Создан: ${new Date(depositInfo.createdAt).toLocaleString('ru-RU')}\n` +
        (depositInfo.paidAt ? `✅ Оплачен: ${new Date(depositInfo.paidAt).toLocaleString('ru-RU')}\n` : '') +
        (depositInfo.completedAt ? `🎉 Завершен: ${new Date(depositInfo.completedAt).toLocaleString('ru-RU')}\n` : ''),
        Markup.inlineKeyboard(keyboard)
      );
    } catch (error) {
      console.error('Ошибка проверки статуса депозита:', error);
      await ctx.answerCbQuery('❌ Ошибка проверки статуса');
      
      await ctx.editMessageText(
        `❌ Не удалось проверить статус депозита\n\n` +
        `Причина: ${error.message}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Попробовать снова', ctx.callbackQuery.data)],
          [Markup.button.callback('⬅️ Назад', 'back_to_deposit_menu')]
        ])
      );
    }
  });
  
  // ВЫВОДЫ - обработчики для кнопок вывода средств
  
  const withdrawAmounts = [10, 20, 50, 100, 500, 1000];
  
  withdrawAmounts.forEach(amount => {
    bot.action(`withdraw:${amount}`, async (ctx) => {
      try {
        console.log(`💸 Вывод ${amount} USDT запрошен пользователем ${ctx.from.username} (${ctx.from.id})`);
        
        await ctx.answerCbQuery(`Подготовка вывода ${amount} USDT...`);
        
        // Проверяем баланс пользователя
        const balance = await apiService.getUserBalance(ctx.from);
        
        if (balance < amount) {
          await ctx.answerCbQuery(`❌ Недостаточно средств. Баланс: ${balance} USDT`);
          return;
        }
        
        // Устанавливаем сумму в сессию и запрашиваем получателя
        ctx.session = ctx.session || {};
        ctx.session.withdrawAmount = amount;
        ctx.session.waitingForWithdrawRecipient = true;
        
        const netAmount = Math.round((amount * 0.97) * 100) / 100;
        await ctx.editMessageText(
          `💸 Вывод ${amount} USDT\n\n` +
          `💰 Ваш баланс: ${balance} USDT\n` +
          `💸 Комиссия CryptoBot: ${(amount * 0.03).toFixed(2)} USDT (3%)\n` +
          `💰 Вы получите: ${netAmount} USDT\n\n` +
          `👤 Укажите получателя:\n` +
          `• @username - для перевода пользователю Telegram\n` +
          `• Адрес кошелька - для внешнего перевода\n\n` +
          `✍️ Напишите получателя:`,
          Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel_withdraw')]
          ])
        );
      } catch (error) {
        console.error(`Ошибка подготовки вывода ${amount} USDT:`, error);
        await ctx.answerCbQuery('❌ Ошибка. Попробуйте позже.');
      }
    });
  });
  
  // Обработчик для "Другая сумма" вывода
  bot.action('withdraw:custom', async (ctx) => {
    try {
      console.log(`💸 Вывод (другая сумма) запрошен пользователем ${ctx.from.username} (${ctx.from.id})`);
      
      await ctx.answerCbQuery('Введите сумму вывода...');
      
      // Устанавливаем флаг ожидания суммы
      ctx.session = ctx.session || {};
      ctx.session.waitingForWithdrawAmount = true;
      
      const balance = await apiService.getUserBalance(ctx.from);
      
      await ctx.editMessageText(
        `💸 Вывод средств\n\n` +
        `💰 Ваш баланс: ${balance} USDT\n\n` +
        `💵 Введите сумму для вывода:\n\n` +
        `📋 Условия:\n` +
        `• Минимум: 1 USDT\n` +
        `• Максимум: 10,000 USDT\n` +
        `• До 300 USDT - автоматически\n` +
        `• Свыше 300 USDT - требует одобрения\n` +
        `• Комиссия CryptoBot: 3%\n\n` +
        `ℹ️ Вы получите 97% от запрошенной суммы\n\n` +
        `✍️ Напишите сумму числом (например: 25):`,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'cancel_withdraw')]
        ])
      );
    } catch (error) {
      console.error('Ошибка обработки withdraw:custom:', error);
      await ctx.answerCbQuery('❌ Ошибка. Попробуйте позже.');
    }
  });
  
  // Обработчик подтверждения вывода
  bot.action(/^confirm_withdraw:(\d+):(.+)$/, async (ctx) => {
    try {
      const amount = parseInt(ctx.match[1]);
      const recipient = ctx.match[2];
      
      console.log(`💸 Подтверждение вывода ${amount} USDT для ${recipient} пользователем ${ctx.from.username} (${ctx.from.id})`);
      
      await ctx.answerCbQuery('Обрабатываем вывод...');
      
      // Определяем тип получателя (username если начинается с буквы, иначе wallet)
      const recipientType = /^[a-zA-Z]/.test(recipient) ? 'username' : 'wallet';
      
      // Создаем запрос на вывод через API
      const withdrawalData = await apiService.createWithdrawal(ctx.from, {
        amount: amount,
        recipient: recipient,
        recipientType: recipientType,
        source: 'bot_button',
        description: `Вывод через бот: ${amount} USDT на ${recipient}`
      });
      
      let statusText = '';
      let statusEmoji = '';
      
      switch (withdrawalData.status) {
        case 'pending':
          statusEmoji = '⏳';
          statusText = 'На рассмотрении администратора';
          break;
        case 'processing':
          statusEmoji = '🔄';
          statusText = 'Обрабатывается';
          break;
        case 'completed':
          statusEmoji = '✅';
          statusText = 'Завершен успешно';
          break;
        default:
          statusEmoji = '📋';
          statusText = 'Принят в обработку';
      }
      
      const netAmount = Math.round((amount * 0.97) * 100) / 100;
      await ctx.editMessageText(
        `${statusEmoji} Запрос на вывод создан\\n\\n` +
        `💰 Запрошено: ${amount} USDT\\n` +
        `💸 Комиссия: ${(amount * 0.03).toFixed(2)} USDT (3%)\\n` +
        `💰 К получению: ${netAmount} USDT\\n` +
        `👤 Получатель: ${recipient}\\n` +
        `🆔 ID: ${withdrawalData.withdrawalId}\\n` +
        `📊 Статус: ${statusText}\\n` +
        `⏰ Создан: ${new Date().toLocaleString('ru-RU')}\\n\\n` +
        (amount <= 300 ? 
          `✅ Автоматическая обработка (до 300 USDT)` : 
          `⚠️ Требует одобрения администратора (свыше 300 USDT)`) +
        `\\n\\nВы получите уведомление о завершении операции.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('💰 Проверить баланс', 'check_balance')],
          [Markup.button.callback('📋 История выводов', 'withdrawal_history')],
          [Markup.button.callback('🏠 Главное меню', 'main_menu')]
        ])
      );
      
      // Очищаем данные сессии
      ctx.session = ctx.session || {};
      delete ctx.session.waitingForWithdrawAmount;
      delete ctx.session.waitingForWithdrawRecipient;
      delete ctx.session.withdrawAmount;
      delete ctx.session.withdrawRecipient;
      
    } catch (error) {
      console.error('Ошибка подтверждения вывода:', error);
      await ctx.answerCbQuery('❌ Ошибка создания запроса на вывод');
      
      await ctx.editMessageText(
        `❌ Не удалось создать запрос на вывод\\n\\n` +
        `Причина: ${error.message}\\n\\n` +
        `Попробуйте позже или свяжитесь с поддержкой.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Попробовать снова', 'withdraw:custom')],
          [Markup.button.callback('❌ Отмена', 'cancel_withdraw')]
        ])
      );
    }
  });
  
  // СЛУЖЕБНЫЕ КНОПКИ
  
  // Возврат в меню депозитов
  bot.action('back_to_deposit_menu', async (ctx) => {
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(
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
  });
  
  // Отмена депозита
  bot.action('cancel_deposit', async (ctx) => {
    ctx.session = ctx.session || {};
    delete ctx.session.waitingForDepositAmount;
    
    await ctx.answerCbQuery('❌ Депозит отменен');
    await ctx.editMessageText('❌ Пополнение отменено');
  });
  
  // Отмена вывода
  bot.action('cancel_withdraw', async (ctx) => {
    ctx.session = ctx.session || {};
    delete ctx.session.waitingForWithdrawAmount;
    delete ctx.session.waitingForWithdrawRecipient;
    delete ctx.session.withdrawAmount;
    delete ctx.session.withdrawRecipient;
    
    await ctx.answerCbQuery('❌ Вывод отменен');
    await ctx.editMessageText('❌ Вывод средств отменен');
  });
  
  // Проверка баланса
  bot.action('check_balance', async (ctx) => {
    try {
      await ctx.answerCbQuery('Проверяем баланс...');
      
      const balance = await apiService.getUserBalance(ctx.from);
      
      await ctx.editMessageText(
        `💰 Ваш баланс\n\n` +
        `💵 Основной баланс: ${balance} USDT\n` +
        `💱 ≈ ${(balance * 95).toFixed(2)} ₽\n\n` +
        `⏰ Обновлено: ${new Date().toLocaleString('ru-RU')}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Обновить', 'check_balance')],
          [Markup.button.callback('💰 Пополнить', 'back_to_deposit_menu')]
        ])
      );
    } catch (error) {
      console.error('Ошибка проверки баланса:', error);
      await ctx.answerCbQuery('❌ Ошибка проверки баланса');
    }
  });
  
  // Универсальный обработчик для необработанных callback (должен быть в конце)
  bot.on('callback_query', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      console.log(`🔘 Необработанный callback: ${data} от ${ctx.from.username} (${ctx.from.id})`);
      
      // Специфические сообщения для разных типов callback
      let message = '🤖 Функция в разработке';
      
      if (data.includes('duel') || data.includes('accept') || data.includes('decline')) {
        message = '⚠️ Ошибка обработки дуэли. Попробуйте создать новую дуэль.';
      } else if (data.includes('deposit') || data.includes('withdraw')) {
        message = '💰 Обработка платежей временно недоступна';
      } else if (data.includes('game') || data.includes('play')) {
        message = '🎮 Игровая функция недоступна';
      }
      
      await ctx.answerCbQuery(message);
      
    } catch (error) {
      console.error('Ошибка обработки необработанного callback:', error);
      try {
        await ctx.answerCbQuery('❌ Произошла ошибка');
      } catch (answerError) {
        console.error('Ошибка отправки ответа на callback:', answerError);
      }
    }
  });
  
  console.log('✅ Callback обработчики зарегистрированы');
}

module.exports = {
  registerCallbackHandlers
};