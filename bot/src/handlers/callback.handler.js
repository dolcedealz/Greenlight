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

  // ===== PvP ДУЭЛИ ОБРАБОТЧИКИ =====

  // Обработка принятия дуэли
  bot.action(/^accept_duel_(\d+)_(\d+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const amount = parseFloat(ctx.match[2]);
      const opponentId = ctx.from.id.toString();
      
      // Проверяем, что это не тот же пользователь
      if (challengerId === opponentId) {
        await ctx.answerCbQuery('❌ Нельзя принять свой собственный вызов', true);
        return;
      }
      
      await ctx.answerCbQuery('⏳ Создаем дуэль...');
      
      // Извлекаем challenger username из сообщения
      let challengerUsername = 'Unknown';
      const messageText = ctx.callbackQuery.message.text;
      const usernameMatch = messageText.match(/@(\w+)\s+(?:вызывает|бросает)/);
      if (usernameMatch) {
        challengerUsername = usernameMatch[1];
      }
      
      // Создаем дуэль
      const duel = await apiService.createPvPChallenge({
        challengerId,
        challengerUsername,
        opponentId,
        opponentUsername: ctx.from.username,
        amount,
        chatId: ctx.chat.id,
        messageId: ctx.callbackQuery.message.message_id
      });
      
      // Принимаем дуэль
      const response = await apiService.respondToPvPChallenge(
        duel.data.duelId,
        opponentId,
        'accept'
      );
      
      // Обновляем сообщение
      await ctx.editMessageText(
        `🪙 **ДУЭЛЬ ПРИНЯТА!** 🪙\n\n` +
        `⚔️ Игроки готовятся к битве!\n` +
        `🆔 Сессия: ${response.data.sessionId}\n\n` +
        `👇 Войдите в игровую комнату:`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([[
            Markup.button.webApp(
              '🎮 Войти в игру', 
              `${config.webAppUrl}?pvp=${response.data.sessionId}`
            )
          ]])
        }
      );
      
    } catch (error) {
      console.error('PVP: Ошибка при принятии дуэли:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
      
      let errorMessage = '❌ Не удалось принять дуэль\n\n';
      if (error.message?.includes('Недостаточно средств')) {
        errorMessage += 'У вас недостаточно средств для дуэли';
      } else if (error.message?.includes('активная дуэль')) {
        errorMessage += 'У вас уже есть активная дуэль с этим игроком';
      } else {
        errorMessage += error.message || 'Попробуйте позже';
      }
      
      try {
        await ctx.editMessageText(errorMessage);
      } catch (editError) {
        await ctx.reply(errorMessage);
      }
    }
  });

  // Обработка отклонения дуэли
  bot.action(/^decline_duel_(\d+)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const opponentId = ctx.from.id.toString();
      const opponentUsername = ctx.from.username;
      
      // Проверяем, что это не тот же пользователь
      if (challengerId === opponentId) {
        await ctx.answerCbQuery('❌ Нельзя отклонить свой собственный вызов', true);
        return;
      }
      
      await ctx.answerCbQuery('❌ Дуэль отклонена');
      
      await ctx.editMessageText(
        `🪙 **ДУЭЛЬ ОТКЛОНЕНА** 🪙\n\n` +
        `❌ @${opponentUsername} отклонил(а) вызов\n\n` +
        `💡 Попробуйте предложить дуэль другому игроку!`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('PVP: Ошибка при отклонении дуэли:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });

  // Тестовый обработчик
  bot.action('test_button', async (ctx) => {
    await ctx.answerCbQuery('✅ Кнопка работает!');
    await ctx.reply('🎉 Callback работает! Вы нажали кнопку.');
  });

  // Обработка входа в PvP комнату (новая упрощенная логика)
  bot.action(/^pvp_join_(\d+)_(\d+(?:\.\d+)?)_(.*)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const amount = parseFloat(ctx.match[2]);
      const targetUsername = ctx.match[3] || '';
      const playerId = ctx.from.id.toString();
      const playerUsername = ctx.from.username;

      console.log(`PVP: ${playerUsername} (${playerId}) входит в комнату дуэли от ${challengerId} на ${amount} USDT`);

      await ctx.answerCbQuery('⏳ Создаем игровую комнату...');

      // Если это инициатор, создаем дуэль
      let duelData, sessionId;
      
      if (challengerId === playerId) {
        // Инициатор создает дуэль
        if (!targetUsername) {
          // Открытая дуэль - пока создаем с временным оппонентом
          await ctx.answerCbQuery('⏳ Ожидание второго игрока...', true);
          return;
        }
        
        // Создаем дуэль через API
        duelData = await apiService.createPvPChallenge({
          challengerId,
          challengerUsername: playerUsername,
          opponentId: 'pending', // Будет заполнено когда оппонент присоединится
          opponentUsername: targetUsername,
          amount,
          chatId: ctx.chat.id.toString(),
          chatType: ctx.chat.type,
          messageId: ctx.callbackQuery.message.message_id
        });

        sessionId = duelData.data.sessionId;
        console.log('PVP: Дуэль создана инициатором:', duelData);
      } else {
        // Второй игрок присоединяется к дуэли
        // Проверяем, что вызов адресован этому пользователю или это открытый вызов
        if (targetUsername && targetUsername !== playerUsername) {
          await ctx.answerCbQuery('❌ Этот вызов адресован другому игроку', true);
          return;
        }

        // Находим существующую дуэль или создаем новую как оппонент
        try {
          duelData = await apiService.createPvPChallenge({
            challengerId,
            challengerUsername: '', // Получим из API
            opponentId: playerId,
            opponentUsername: playerUsername,
            amount,
            chatId: ctx.chat.id.toString(),
            chatType: ctx.chat.type,
            messageId: ctx.callbackQuery.message.message_id
          });

          sessionId = duelData.data.sessionId;
          console.log('PVP: Дуэль создана оппонентом:', duelData);
        } catch (error) {
          if (error.message.includes('уже существует')) {
            // Дуэль уже создана, присоединяемся
            // TODO: Реализовать получение существующей сессии
            await ctx.answerCbQuery('❌ Дуэль уже создана', true);
            return;
          }
          throw error;
        }
      }

      // Перенаправляем в WebApp
      const { webAppUrl } = config;
      const gameUrl = `${webAppUrl}?pvp=${sessionId}`;

      await ctx.editMessageText(
        `🎯 **ИГРОВАЯ КОМНАТА АКТИВНА** 🪙\n\n` +
        `💰 Ставка: ${amount} USDT каждый\n` +
        `🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT (5% комиссия)\n` +
        `🆔 Сессия: ${sessionId}\n\n` +
        `🚪 Игроки входят в комнату...`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 Войти в игру', gameUrl)],
            [Markup.button.callback('📊 Обновить статус', `pvp_status_${sessionId}`)]
          ])
        }
      );

      console.log(`PVP: Перенаправление в WebApp: ${gameUrl}`);

    } catch (error) {
      console.error('PVP: Ошибка при входе в комнату:', error);
      await ctx.answerCbQuery('❌ Ошибка создания комнаты', true);
    }
  });



  // Обработка проверки статуса PvP игры
  bot.action(/^pvp_status_(.+)$/, async (ctx) => {
    try {
      const sessionId = ctx.match[1];
      const userId = ctx.from.id.toString();

      console.log(`PVP: Проверка статуса сессии ${sessionId} для пользователя ${userId}`);

      await ctx.answerCbQuery('⏳ Проверяем статус игры...');

      try {
        const sessionData = await apiService.getPvPSession(sessionId, userId);
        
        let statusMessage = `🎯 **Статус дуэли** 🪙\n\n`;
        statusMessage += `🆔 Сессия: ${sessionId}\n`;
        statusMessage += `👥 Игроки:\n`;
        statusMessage += `   • ${sessionData.data.challengerUsername} ${sessionData.data.challengerJoined ? '✅' : '⏳'} ${sessionData.data.challengerReady ? '🟢' : '🔴'}\n`;
        statusMessage += `   • ${sessionData.data.opponentUsername} ${sessionData.data.opponentJoined ? '✅' : '⏳'} ${sessionData.data.opponentReady ? '🟢' : '🔴'}\n\n`;
        statusMessage += `💰 Ставка: ${sessionData.data.amount} USDT каждый\n`;
        statusMessage += `🏆 Банк: ${sessionData.data.winAmount} USDT\n\n`;

        switch (sessionData.data.status) {
          case 'accepted':
            statusMessage += `📊 Статус: Ожидание игроков\n`;
            if (!sessionData.data.bothJoined) {
              statusMessage += `⏳ Игроки должны войти в комнату\n`;
            } else if (!sessionData.data.bothReady) {
              statusMessage += `⏳ Игроки должны подтвердить готовность\n`;
            } else {
              statusMessage += `✅ Готовы к игре!\n`;
            }
            break;
          case 'active':
            statusMessage += `📊 Статус: Игра идет...\n`;
            break;
          case 'completed':
            statusMessage += `📊 Статус: Игра завершена\n`;
            statusMessage += `🏆 Победитель: @${sessionData.data.winnerUsername}\n`;
            statusMessage += `🪙 Результат: ${sessionData.data.coinResult === 'heads' ? 'Орел' : 'Решка'}\n`;
            break;
          default:
            statusMessage += `📊 Статус: ${sessionData.data.status}\n`;
        }

        const { webAppUrl } = config;
        const sessionUrl = `${webAppUrl}?pvp=${sessionId}`;

        const buttons = [];
        if (sessionData.data.status === 'accepted') {
          buttons.push([Markup.button.webApp('🚪 Войти в комнату', sessionUrl)]);
        }
        buttons.push([Markup.button.callback('🔄 Обновить', `pvp_status_${sessionId}`)]);

        await ctx.reply(statusMessage, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons)
        });

      } catch (apiError) {
        console.error('PVP: Ошибка API при получении статуса:', apiError);
        await ctx.reply('❌ Не удалось получить статус игры\n\nВозможно, сессия не найдена или истекла');
      }

    } catch (error) {
      console.error('PVP: Ошибка при проверке статуса:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });

  // Обработка статуса игровой комнаты (для inline кнопок)
  bot.action(/^pvp_room_status_(\d+)_(\d+(?:\.\d+)?)$/, async (ctx) => {
    try {
      const challengerId = ctx.match[1];
      const amount = parseFloat(ctx.match[2]);

      await ctx.answerCbQuery('📊 Показываем статус комнаты...');

      await ctx.reply(
        `📊 **Статус игровой комнаты**\n\n` +
        `👤 Инициатор: ${challengerId}\n` +
        `💰 Ставка: ${amount} USDT каждый\n` +
        `🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT\n\n` +
        `⏳ Ожидание входа игроков в комнату...`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Обновить статус', `pvp_room_status_${challengerId}_${amount}`)]
          ])
        }
      );

    } catch (error) {
      console.error('PVP: Ошибка при показе статуса комнаты:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });

  // ===== PRIVATE DUEL HANDLERS =====

  // Обработка принятия приглашения на дуэль из личных сообщений
  bot.action(/^accept_private_duel_(.+)$/, async (ctx) => {
    try {
      const inviteId = ctx.match[1];
      const userId = ctx.from.id;
      const username = ctx.from.username;

      await ctx.answerCbQuery('⏳ Принимаем приглашение...');

      // Проверяем, существует ли приглашение
      if (!global.pendingDuelInvites || !global.pendingDuelInvites[inviteId]) {
        await ctx.editMessageText('❌ Приглашение устарело или уже недействительно');
        return;
      }

      const invite = global.pendingDuelInvites[inviteId];

      // Проверяем, что приглашение для этого пользователя
      if (invite.targetUsername !== username) {
        await ctx.answerCbQuery('❌ Это приглашение адресовано другому пользователю', true);
        return;
      }

      // Создаем группу с участниками и ботом для дуэли
      try {
        const groupTitle = `🎮 Дуэль: @${invite.challengerUsername} vs @${invite.targetUsername}`;
        
        // Создаем группу
        const group = await bot.telegram.createGroup(
          groupTitle,
          [invite.challengerId, userId]
        );

        console.log('Группа создана:', group);

        // Отправляем сообщение о создании дуэли в группу
        await bot.telegram.sendMessage(
          group.id,
          `${invite.gameType} **ДУЭЛЬ НАЧИНАЕТСЯ!** ${invite.gameType}\n\n` +
          `⚔️ @${invite.challengerUsername} VS @${invite.targetUsername}\n` +
          `💰 Ставка: ${invite.amount} USDT (за всю серию)\n` +
          `🎮 Игра: ${getGameName(invite.gameType)}\n` +
          `🏆 Формат: ${invite.format.toUpperCase()} (до ${invite.winsRequired} побед)\n\n` +
          `🎯 Начинаем через 3 секунды...`,
          { parse_mode: 'Markdown' }
        );

        // Создаем дуэль через API
        const duelData = await apiService.createPvPChallenge({
          challengerId: invite.challengerId,
          challengerUsername: invite.challengerUsername,
          opponentId: userId.toString(),
          opponentUsername: username,
          amount: invite.amount,
          gameType: invite.gameType,
          format: invite.format,
          winsRequired: invite.winsRequired,
          chatId: group.id.toString(),
          chatType: 'group',
          messageId: 0
        });

        // Принимаем дуэль автоматически
        await apiService.respondToPvPChallenge(
          duelData.data.duelId,
          userId.toString(),
          'accept'
        );

        // Обновляем сообщение в личке
        await ctx.editMessageText(
          `✅ **ПРИГЛАШЕНИЕ ПРИНЯТО!**\n\n` +
          `🎮 Дуэль началась в группе: "${groupTitle}"\n` +
          `⚔️ Удачи в бою!`,
          { parse_mode: 'Markdown' }
        );

        // Уведомляем инициатора
        await bot.telegram.sendMessage(
          invite.challengerId,
          `✅ **@${username} ПРИНЯЛ ДУЭЛЬ!**\n\n` +
          `🎮 Игра началась в группе: "${groupTitle}"\n` +
          `🎯 Приготовьтесь к бою!`,
          { parse_mode: 'Markdown' }
        );

        // Запускаем эмодзи дуэль в группе через 3 секунды
        setTimeout(async () => {
          await startEmojiDuelInGroup(bot, group.id, duelData.data, invite.gameType);
        }, 3000);

        // Удаляем приглашение
        delete global.pendingDuelInvites[inviteId];

      } catch (groupError) {
        console.error('Ошибка создания группы:', groupError);
        
        // Если не удалось создать группу, уведомляем участников
        await ctx.editMessageText(
          `❌ **Не удалось создать группу для дуэли**\n\n` +
          `Возможные причины:\n` +
          `• Бот не может создавать группы с этими пользователями\n` +
          `• Один из игроков заблокировал бота\n\n` +
          `💡 Попробуйте создать дуэль в существующей группе`
        );

        await bot.telegram.sendMessage(
          invite.challengerId,
          `❌ Не удалось создать группу для дуэли с @${username}\n\n` +
          `Попробуйте пригласить ${username} в существующую группу и создать дуэль там.`
        );
      }

    } catch (error) {
      console.error('Ошибка принятия приватного приглашения:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
      await ctx.editMessageText('❌ Произошла ошибка при принятии приглашения');
    }
  });

  // Обработка отклонения приглашения на дуэль из личных сообщений
  bot.action(/^decline_private_duel_(.+)$/, async (ctx) => {
    try {
      const inviteId = ctx.match[1];
      const username = ctx.from.username;

      await ctx.answerCbQuery('❌ Приглашение отклонено');

      // Проверяем, существует ли приглашение
      if (!global.pendingDuelInvites || !global.pendingDuelInvites[inviteId]) {
        await ctx.editMessageText('❌ Приглашение уже недействительно');
        return;
      }

      const invite = global.pendingDuelInvites[inviteId];

      // Обновляем сообщение
      await ctx.editMessageText(
        `❌ **ПРИГЛАШЕНИЕ ОТКЛОНЕНО**\n\n` +
        `Вы отклонили приглашение на дуэль от @${invite.challengerUsername}`,
        { parse_mode: 'Markdown' }
      );

      // Уведомляем инициатора
      await bot.telegram.sendMessage(
        invite.challengerId,
        `❌ **@${username} ОТКЛОНИЛ ДУЭЛЬ**\n\n` +
        `${invite.gameType} Ваше приглашение на дуэль было отклонено\n` +
        `💡 Попробуйте пригласить другого игрока`,
        { parse_mode: 'Markdown' }
      );

      // Удаляем приглашение
      delete global.pendingDuelInvites[inviteId];

    } catch (error) {
      console.error('Ошибка отклонения приватного приглашения:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });

  // Обработка отмены приглашения инициатором
  bot.action(/^cancel_invite_(.+)$/, async (ctx) => {
    try {
      const inviteId = ctx.match[1];
      const userId = ctx.from.id;

      await ctx.answerCbQuery('❌ Приглашение отменено');

      // Проверяем, существует ли приглашение
      if (!global.pendingDuelInvites || !global.pendingDuelInvites[inviteId]) {
        await ctx.editMessageText('❌ Приглашение уже недействительно');
        return;
      }

      const invite = global.pendingDuelInvites[inviteId];

      // Проверяем, что отменяет инициатор
      if (invite.challengerId !== userId) {
        await ctx.answerCbQuery('❌ Только инициатор может отменить приглашение', true);
        return;
      }

      // Обновляем сообщение
      await ctx.editMessageText(
        `❌ **ПРИГЛАШЕНИЕ ОТМЕНЕНО**\n\n` +
        `Вы отменили приглашение на дуэль с @${invite.targetUsername}`,
        { parse_mode: 'Markdown' }
      );

      // Удаляем приглашение
      delete global.pendingDuelInvites[inviteId];

    } catch (error) {
      console.error('Ошибка отмены приглашения:', error);
      await ctx.answerCbQuery('❌ Произошла ошибка', true);
    }
  });
  
  return bot;
}

/**
 * Вспомогательные функции
 */
function getGameName(gameType) {
  const games = {
    '🎲': 'Кости',
    '🎯': 'Дартс',
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎰': 'Слоты',
    '🎳': 'Боулинг'
  };
  return games[gameType] || 'Игра';
}

/**
 * Запуск эмодзи дуэли в группе
 */
async function startEmojiDuelInGroup(bot, chatId, duelData, gameType) {
  try {
    const sessionId = duelData.sessionId;
    let currentRound = 0;
    let score = { challenger: 0, opponent: 0 };
    
    // Функция для игры одного раунда
    async function playRound() {
      currentRound++;
      
      await bot.telegram.sendMessage(
        chatId,
        `${gameType} **РАУНД ${currentRound}** ${gameType}\n` +
        `📊 Счет: ${score.challenger}-${score.opponent}`,
        { parse_mode: 'Markdown' }
      );
      
      // Отправляем эмодзи для первого игрока
      await bot.telegram.sendMessage(chatId, `@${duelData.challengerUsername} бросает...`);
      const result1 = await bot.telegram.sendDice(chatId, { emoji: gameType });
      const value1 = result1.dice.value;
      
      // Пауза между бросками
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Отправляем эмодзи для второго игрока
      await bot.telegram.sendMessage(chatId, `@${duelData.opponentUsername} бросает...`);
      const result2 = await bot.telegram.sendDice(chatId, { emoji: gameType });
      const value2 = result2.dice.value;
      
      // Пауза для анимации
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Определяем победителя раунда в зависимости от типа игры
      let roundWinner;
      const roundResult = determineRoundWinner(gameType, value1, value2);
      
      if (roundResult === 'player1') {
        roundWinner = 'challenger';
        score.challenger++;
        await bot.telegram.sendMessage(chatId, `✅ Раунд выиграл @${duelData.challengerUsername}! ${getResultText(gameType, value1, value2)}`);
      } else if (roundResult === 'player2') {
        roundWinner = 'opponent';
        score.opponent++;
        await bot.telegram.sendMessage(chatId, `✅ Раунд выиграл @${duelData.opponentUsername}! ${getResultText(gameType, value1, value2)}`);
      } else {
        await bot.telegram.sendMessage(chatId, `🤝 Ничья! ${getResultText(gameType, value1, value2)} Переигрываем...`);
        setTimeout(() => playRound(), 2000);
        return;
      }
      
      // Сохраняем результат раунда через API
      await apiService.saveDuelRound(sessionId, {
        round: currentRound,
        challengerResult: value1,
        opponentResult: value2,
        winnerId: roundWinner === 'challenger' ? duelData.challengerId : duelData.opponentId
      });
      
      // Проверяем, есть ли победитель серии
      if (score.challenger >= duelData.winsRequired) {
        await finishDuelInGroup(bot, chatId, duelData, 'challenger', score);
      } else if (score.opponent >= duelData.winsRequired) {
        await finishDuelInGroup(bot, chatId, duelData, 'opponent', score);
      } else {
        // Играем следующий раунд
        setTimeout(() => playRound(), 3000);
      }
    }
    
    // Начинаем первый раунд
    await playRound();
    
  } catch (error) {
    console.error('Ошибка в эмодзи дуэли:', error);
    await bot.telegram.sendMessage(chatId, '❌ Произошла ошибка во время игры');
  }
}

/**
 * Завершение дуэли в группе
 */
async function finishDuelInGroup(bot, chatId, duelData, winner, score) {
  try {
    const winnerId = winner === 'challenger' ? duelData.challengerId : duelData.opponentId;
    const winnerUsername = winner === 'challenger' ? duelData.challengerUsername : duelData.opponentUsername;
    const loserId = winner === 'challenger' ? duelData.opponentId : duelData.challengerId;
    const loserUsername = winner === 'challenger' ? duelData.opponentUsername : duelData.challengerUsername;
    
    // Завершаем дуэль через API
    const result = await apiService.finishPvPDuel(duelData.sessionId, winnerId);
    
    // Отправляем финальное сообщение
    await bot.telegram.sendMessage(
      chatId,
      `🏆 **ПОБЕДИТЕЛЬ ДУЭЛИ** 🏆\n\n` +
      `👑 @${winnerUsername} побеждает со счетом ${score.challenger}-${score.opponent}!\n` +
      `💰 Выигрыш: ${result.data.winAmount} USDT\n` +
      `😔 @${loserUsername} проигрывает ${duelData.amount} USDT\n\n` +
      `🎮 GG WP!`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Реванш', `emoji_rematch_${duelData.sessionId}`)]
        ])
      }
    );
    
  } catch (error) {
    console.error('Ошибка завершения дуэли:', error);
  }
}

/**
 * Определяет победителя раунда в зависимости от типа игры
 */
function determineRoundWinner(gameType, value1, value2) {
  switch (gameType) {
    case '🎲': // Кости - больше значение побеждает
    case '🎳': // Боулинг - больше кеглей побеждает
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '🎯': // Дартс - попадание в центр (6) побеждает
      if (value1 === 6 && value2 !== 6) return 'player1';
      if (value2 === 6 && value1 !== 6) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
      
    case '⚽': // Футбол - гол (4,5) побеждает
    case '🏀': // Баскетбол - попадание (4,5) побеждает
      const isGoal1 = value1 >= 4;
      const isGoal2 = value2 >= 4;
      if (isGoal1 && !isGoal2) return 'player1';
      if (isGoal2 && !isGoal1) return 'player2';
      if (isGoal1 && isGoal2) return 'draw';
      if (!isGoal1 && !isGoal2) return 'draw';
      break;
      
    case '🎰': // Слоты - выигрышные комбинации
      const isWin1 = value1 >= 1 && value1 <= 64; // Есть выигрыш
      const isWin2 = value2 >= 1 && value2 <= 64;
      if (isWin1 && !isWin2) return 'player1';
      if (isWin2 && !isWin1) return 'player2';
      if (value1 > value2) return 'player1';
      if (value2 > value1) return 'player2';
      return 'draw';
  }
  
  return 'draw';
}

/**
 * Получает текст результата для разных типов игр
 */
function getResultText(gameType, value1, value2) {
  switch (gameType) {
    case '🎲':
      return `(${value1} vs ${value2})`;
      
    case '🎯':
      const dartResult1 = value1 === 6 ? 'Центр!' : `${value1} очков`;
      const dartResult2 = value2 === 6 ? 'Центр!' : `${value2} очков`;
      return `(${dartResult1} vs ${dartResult2})`;
      
    case '⚽':
      const goal1 = value1 >= 4 ? 'ГОЛ!' : 'Мимо';
      const goal2 = value2 >= 4 ? 'ГОЛ!' : 'Мимо';
      return `(${goal1} vs ${goal2})`;
      
    case '🏀':
      const basket1 = value1 >= 4 ? 'Попал!' : 'Мимо';
      const basket2 = value2 >= 4 ? 'Попал!' : 'Мимо';
      return `(${basket1} vs ${basket2})`;
      
    case '🎰':
      const slot1 = value1 >= 1 && value1 <= 64 ? 'Выигрыш!' : 'Проигрыш';
      const slot2 = value2 >= 1 && value2 <= 64 ? 'Выигрыш!' : 'Проигрыш';
      return `(${slot1} vs ${slot2})`;
      
    case '🎳':
      return `(${value1} кеглей vs ${value2} кеглей)`;
      
    default:
      return `(${value1} vs ${value2})`;
  }
}

module.exports = {
  registerCallbackHandlers
};
