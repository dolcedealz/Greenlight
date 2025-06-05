// message.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');
const { getWebAppUrl } = require('../utils/webapp-utils');

/**
 * Обработчик текстовых сообщений
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerMessageHandlers(bot) {
  
  // === ОБРАБОТЧИКИ КЛАВИАТУРНЫХ КНОПОК ===
  
  bot.hears('💰 Пополнить', async (ctx) => {
    await ctx.reply(
      '💰 Выберите сумму для пополнения баланса:',
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
          Markup.button.callback('💳 Другая сумма', 'deposit:custom')
        ]
      ])
    );
  });
  
  bot.hears('💸 Вывести', async (ctx) => {
    try {
      // Проверяем баланс перед показом меню
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < 1) {
        await ctx.reply(
          '❌ Недостаточно средств для вывода\n\n' +
          `💰 Ваш баланс: ${balance.toFixed(2)} USDT\n` +
          '📊 Минимальная сумма вывода: 1 USDT\n\n' +
          '👆 Используйте кнопку "Пополнить" чтобы пополнить баланс'
        );
        return;
      }
      
      await ctx.reply(
        `💸 Вывод средств\n\n` +
        `💰 Ваш баланс: ${balance.toFixed(2)} USDT\n\n` +
        `📋 Условия вывода:\n` +
        `• Минимум: 1 USDT\n` +
        `• Максимум: 10,000 USDT\n` +
        `• До 300 USDT - автоматически\n` +
        `• Свыше 300 USDT - требует одобрения\n` +
        `• Время: 5-15 минут\n\n` +
        `Выберите сумму:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('10 USDT', 'withdraw:10'),
            Markup.button.callback('20 USDT', 'withdraw:20'),
            Markup.button.callback('50 USDT', 'withdraw:50')
          ],
          [
            Markup.button.callback('100 USDT', 'withdraw:100'),
            Markup.button.callback('500 USDT', 'withdraw:500'),
            Markup.button.callback('1000 USDT', 'withdraw:1000')
          ],
          [
            Markup.button.callback('💸 Другая сумма', 'withdraw:custom'),
            Markup.button.callback('📋 История выводов', 'withdrawals_history')
          ]
        ])
      );
    } catch (error) {
      console.error('Ошибка при проверке баланса:', error);
      await ctx.reply(
        '❌ Не удалось получить информацию о балансе.\n' +
        'Попробуйте еще раз через несколько секунд.'
      );
    }
  });
  
  bot.hears('👥 Рефералы', async (ctx) => {
    try {
      console.log('🔍 Debug webAppUrl:', config.webAppUrl);
      console.log('🔍 Debug botInfo:', ctx.botInfo);
      
      // Сначала убеждаемся что пользователь создан в системе
      try {
        await apiService.createOrUpdateUser(ctx.from);
        console.log('✅ Пользователь создан/обновлен перед получением реферального кода');
      } catch (createError) {
        console.error('⚠️ Ошибка создания пользователя:', createError);
      }
      
      const referralCode = await apiService.getUserReferralCode(ctx.from);
      console.log('🔍 Debug referralCode:', referralCode);
      
      // Проверяем что реферальный код валидный
      if (referralCode === 'ERROR' || !referralCode) {
        await ctx.reply(
          '❌ Не удалось загрузить реферальную информацию.\n' +
          'Попробуйте выполнить команду /start и повторите попытку.'
        );
        return;
      }
      
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${referralCode}`;
      console.log('🔍 Debug referralLink:', referralLink);
      
      // Получаем URL для реферальной страницы фронтенда  
      const webAppData = getWebAppUrl('?screen=referral');
      console.log('🔍 Debug webAppData:', webAppData);
      
      if (!webAppData.isValid) {
        await ctx.reply(webAppData.error);
        return;
      }
      
      await ctx.reply(
        `👥 Реферальная программа\n\n` +
        `🎁 Приглашайте друзей и получайте бонусы!\n` +
        `💰 10% с каждого депозита друга\n\n` +
        `🔗 Ваша реферальная ссылка:\n` +
        `${referralLink}\n\n` +
        `📊 Используйте кнопки ниже для подробной статистики:`,
        Markup.inlineKeyboard([
          [
            Markup.button.webApp('👥 Подробная статистика', webAppData.url)
          ],
          [
            Markup.button.url('📤 Поделиться ссылкой', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎰 Играй в Greenlight Casino и зарабатывай!')}`)
          ]
        ])
      );
    } catch (error) {
      console.error('Ошибка получения реферального кода:', error);
      await ctx.reply(
        '❌ Не удалось загрузить реферальную информацию.\n' +
        'Попробуйте еще раз через несколько секунд.'
      );
    }
  });
  
  bot.hears('📊 История', async (ctx) => {
    const webAppData = getWebAppUrl('?screen=history');
    
    if (webAppData.isValid) {
      await ctx.reply(
        '📊 Ваша история операций\n\n' +
        '🎮 Игры, ставки и выигрыши\n' +
        '💳 Депозиты и выводы\n' +
        '📈 Статистика и аналитика\n\n' +
        'Нажмите кнопку ниже для просмотра:',
        Markup.inlineKeyboard([
          [
            Markup.button.webApp('📊 Открыть историю', webAppData.url)
          ],
          [
            Markup.button.callback('🎮 Последние игры', 'recent_games'),
            Markup.button.callback('💳 Последние депозиты', 'recent_deposits')
          ]
        ])
      );
    } else {
      await ctx.reply(
        '📊 История операций\n\n' +
        webAppData.error + '\n\n' +
        'Используйте команды для получения информации:\n' +
        '/balance - проверить баланс\n' +
        '/profile - информация о профиле'
      );
    }
  });
  
  // === ДОПОЛНИТЕЛЬНЫЕ CALLBACK ОБРАБОТЧИКИ ===
  
  // Обработчик для быстрого просмотра последних игр
  bot.action('recent_games', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Загружаем последние игры...');
      
      const webAppData = getWebAppUrl('?screen=history');
      
      if (webAppData.isValid) {
        await ctx.reply(
          '🎮 Последние игры:\n\n' +
          '(Для просмотра полной истории используйте WebApp)\n\n' +
          '📱 Нажмите кнопку ниже:',
          Markup.inlineKeyboard([
            Markup.button.webApp('📊 Полная история', webAppData.url)
          ])
        );
      } else {
        await ctx.reply(webAppData.error);
      }
    } catch (error) {
      console.error('Ошибка получения истории игр:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки');
    }
  });
  
  // Обработчик для быстрого просмотра последних депозитов  
  bot.action('recent_deposits', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Загружаем последние депозиты...');
      
      const webAppData = getWebAppUrl('?screen=history');
      
      if (webAppData.isValid) {
        await ctx.reply(
          '💳 Последние депозиты:\n\n' +
          '(Для просмотра полной истории используйте WebApp)\n\n' +
          '📱 Нажмите кнопку ниже:',
          Markup.inlineKeyboard([
            Markup.button.webApp('📊 Полная история', webAppData.url)
          ])
        );
      } else {
        await ctx.reply(webAppData.error);
      }
    } catch (error) {
      console.error('Ошибка получения истории депозитов:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки');
    }
  });
  
  // === ОБРАБОТКА КОМАНД ===
  
  // Команда отмены
  bot.command('cancel', async (ctx) => {
    ctx.session = ctx.session || {};
    
    // Очищаем все флаги ожидания
    delete ctx.session.waitingForDepositAmount;
    delete ctx.session.waitingForWithdrawAmount;
    delete ctx.session.waitingForWithdrawRecipient;
    delete ctx.session.withdrawAmount;
    delete ctx.session.withdrawRecipient;
    delete ctx.session.rejectingWithdrawalId;
    delete ctx.session.withdrawingProfit;
    
    await ctx.reply('❌ Операция отменена');
  });
  
  // === ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ===
  
  bot.on('text', async (ctx) => {
    // Логируем все команды для отладки
    if (ctx.message.text.startsWith('/')) {
      console.log(`🔍 Команда получена в message handler: "${ctx.message.text}"`);
      console.log(`👤 От: ${ctx.from.username} (${ctx.from.id})`);
      console.log(`💬 В чате: ${ctx.chat.id} (${ctx.chat.title || 'private'})`);
      console.log(`📋 Тип чата: ${ctx.chat.type}`);
      console.log(`⚠️ Пропускаем команду - должна обрабатываться специальным обработчиком`);
      return;
    }
    
    // Убеждаемся, что сессия инициализирована
    ctx.session = ctx.session || {};
    
    console.log('Получено текстовое сообщение:', ctx.message.text);
    console.log('Состояние сессии:', ctx.session);
    
    // Обработка ввода суммы для депозита
    if (ctx.session.waitingForDepositAmount) {
      console.log('Обработка суммы депозита:', ctx.message.text);
      
      const amount = parseFloat(ctx.message.text.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите число от 1 до 10000:');
        return;
      }
      
      if (amount < 1) {
        await ctx.reply('❌ Минимальная сумма пополнения: 1 USDT\n\nВведите другую сумму:');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма пополнения: 10000 USDT\n\nВведите другую сумму:');
        return;
      }
      
      delete ctx.session.waitingForDepositAmount;
      
      try {
        const depositData = await apiService.createDeposit(ctx.from, amount, {
          source: 'bot',
          description: `Пополнение через бот: ${amount} USDT`
        });
        
        await ctx.reply(
          `💰 Счет создан успешно!\n\n` +
          `💵 Сумма: ${amount} USDT\n` +
          `🆔 ID: ${depositData.depositId}\n` +
          `⏰ Действует: 1 час\n\n` +
          `👇 Нажмите для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', depositData.payUrl)],
            [Markup.button.callback('📋 Проверить статус', `check_deposit_status:${depositData.depositId}`)]
          ])
        );
      } catch (error) {
        console.error('Ошибка создания депозита:', error);
        await ctx.reply('❌ Ошибка создания депозита. Попробуйте позже.');
      }
      
      return;
    }
    
    // Обработка ввода суммы для вывода
    if (ctx.session.waitingForWithdrawAmount) {
      console.log('Обработка суммы вывода:', ctx.message.text);
      
      const amount = parseFloat(ctx.message.text.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите число от 1 до 10000:');
        return;
      }
      
      if (amount < 1) {
        await ctx.reply('❌ Минимальная сумма вывода: 1 USDT\n\nВведите другую сумму:');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма вывода: 10000 USDT\n\nВведите другую сумму:');
        return;
      }
      
      // Проверяем баланс
      try {
        const balance = await apiService.getUserBalance(ctx.from);
        
        if (balance < amount) {
          await ctx.reply(
            `❌ Недостаточно средств\n\n` +
            `💰 Ваш баланс: ${balance.toFixed(2)} USDT\n` +
            `💸 Запрошено: ${amount.toFixed(2)} USDT\n\n` +
            `Введите другую сумму:`
          );
          return;
        }
      } catch (error) {
        await ctx.reply('❌ Ошибка проверки баланса. Попробуйте позже.');
        delete ctx.session.waitingForWithdrawAmount;
        return;
      }
      
      ctx.session.withdrawAmount = amount;
      delete ctx.session.waitingForWithdrawAmount;
      ctx.session.waitingForWithdrawRecipient = true;
      
      await ctx.reply(
        `📤 Куда вывести ${amount} USDT?\n\n` +
        `Введите Telegram username получателя (без @):\n\n` +
        `⚠️ Важно:\n` +
        `• Получатель должен использовать @CryptoBot\n` +
        `• Вводите без символа @\n` +
        `• Проверьте правильность написания\n\n` +
        `Для отмены введите /cancel`
      );
      
      return;
    }
    
    // Обработка ввода получателя для вывода
    if (ctx.session.waitingForWithdrawRecipient && ctx.session.withdrawAmount) {
      console.log('Обработка получателя вывода:', ctx.message.text);
      
      const recipient = ctx.message.text.replace('@', '').trim();
      
      if (!recipient.match(/^[a-zA-Z0-9_]{5,32}$/)) {
        await ctx.reply(
          '❌ Некорректный username\n\n' +
          'Username должен:\n' +
          '• Содержать 5-32 символа\n' +
          '• Только буквы, цифры и _\n' +
          '• Без символа @\n\n' +
          'Попробуйте еще раз:'
        );
        return;
      }
      
      const amount = ctx.session.withdrawAmount;
      delete ctx.session.waitingForWithdrawRecipient;
      
      await ctx.reply(
        `📋 Подтверждение вывода\n\n` +
        `💵 Сумма: ${amount} USDT\n` +
        `📤 Получатель: @${recipient}\n` +
        `${amount > 300 ? '⚠️ Требует одобрения админа' : '⚡ Автоматическая обработка'}\n\n` +
        `✅ Подтвердить?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Да, вывести', `confirm_withdraw:${amount}:${recipient}`),
            Markup.button.callback('❌ Отменить', 'cancel_withdraw')
          ]
        ])
      );
      
      return;
    }
    
    // Обработка PvP команд из switchToPM
    if (ctx.message.text.startsWith('pvp_manage_')) {
      const parts = ctx.message.text.split('_');
      if (parts.length >= 4) {
        const challengerId = parts[2];
        const amount = parseFloat(parts[3]);
        
        const webAppData = getWebAppUrl(`?pvp=create&challengerId=${challengerId}&amount=${amount}`);
        
        if (webAppData.isValid) {
          await ctx.reply(
            `🎯 **Управление дуэлью** 🪙\n\n` +
            `👤 Инициатор: ${challengerId}\n` +
            `💰 Ставка: ${amount} USDT каждый\n` +
            `🏆 Банк: ${(amount * 2 * 0.95).toFixed(2)} USDT\n\n` +
            `🎮 Выберите действие:`,
            {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.webApp('🚪 Войти в комнату', webAppData.url)],
                [Markup.button.callback('📊 Статус дуэли', `pvp_check_status_${challengerId}_${amount}`)],
                [Markup.button.callback('❌ Отменить дуэль', `pvp_cancel_${challengerId}_${amount}`)]
              ])
            }
          );
        } else {
          await ctx.reply(
            `🎯 **Дуэль недоступна** 🪙\n\n` +
            `${webAppData.error}\n\n` +
            `👤 Инициатор: ${challengerId}\n` +
            `💰 Ставка: ${amount} USDT каждый`
          );
        }
        return;
      }
    }

    // Обработка обычных сообщений
    const messageText = ctx.message.text.toLowerCase();
    
    if (messageText.includes('играть') || messageText.includes('игр') || messageText.includes('казино')) {
      const webAppData = getWebAppUrl();
      
      if (webAppData.isValid) {
        await ctx.reply(
          '🎮 Для игры используйте:\n\n' +
          '1️⃣ Кнопку "Играть" в меню бота\n' +
          '2️⃣ Или кнопку ниже:',
          Markup.inlineKeyboard([
            Markup.button.webApp('🎮 Открыть казино', webAppData.url)
          ])
        );
      } else {
        await ctx.reply(
          '🎮 Для игры используйте команду /play\n\n' +
          '❌ Веб-приложение временно недоступно.'
        );
      }
      return;
    }
    
    if (messageText.includes('баланс') || messageText.includes('деньги')) {
      try {
        const balance = await apiService.getUserBalance(ctx.from);
        await ctx.reply(
          `💰 Ваш баланс: ${balance.toFixed(2)} USDT\n` +
          `💱 ≈ ${(balance * 95).toFixed(2)} ₽\n\n` +
          `Используйте кнопки ниже для управления балансом ⬇️`
        );
      } catch (error) {
        await ctx.reply('❌ Не удалось получить баланс. Попробуйте команду /start');
      }
      return;
    }
    
    // По умолчанию - справка
    await ctx.reply(
      '❓ Используйте кнопки меню для навигации:\n\n' +
      '💰 Пополнить - добавить средства\n' +
      '💸 Вывести - вывести средства  \n' +
      '👥 Рефералы - пригласить друзей\n' +
      '📊 История - ваши операции\n\n' +
      '🎮 Для игры используйте кнопку "Играть" в меню бота'
    );
  });
  
  return bot;
}

module.exports = {
  registerMessageHandlers
};
