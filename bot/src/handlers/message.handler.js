// bot/src/handlers/message.handler.js - УПРОЩЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

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
      const referralCode = await apiService.getUserReferralCode(ctx.from);
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${referralCode}`;
      
      await ctx.reply(
        `👥 Реферальная программа\n\n` +
        `🎁 Приглашайте друзей и получайте бонусы!\n` +
        `💰 10% с каждого депозита друга\n\n` +
        `🔗 Ваша реферальная ссылка:\n` +
        `${referralLink}\n\n` +
        `📊 Используйте кнопки ниже для подробной статистики:`,
        Markup.inlineKeyboard([
          [
            Markup.button.webApp('👥 Подробная статистика', `${config.webAppUrl}?screen=referrals`)
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
    await ctx.reply(
      '📊 Ваша история операций\n\n' +
      '🎮 Игры, ставки и выигрыши\n' +
      '💳 Депозиты и выводы\n' +
      '📈 Статистика и аналитика\n\n' +
      'Нажмите кнопку ниже для просмотра:',
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('📊 Открыть историю', `${config.webAppUrl}?screen=history`)
        ],
        [
          Markup.button.callback('🎮 Последние игры', 'recent_games'),
          Markup.button.callback('💳 Последние депозиты', 'recent_deposits')
        ]
      ])
    );
  });
  
  // === ДОПОЛНИТЕЛЬНЫЕ CALLBACK ОБРАБОТЧИКИ ===
  
  // Обработчик для быстрого просмотра последних игр
  bot.action('recent_games', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Загружаем последние игры...');
      
      // Здесь можно добавить запрос к API для получения последних игр
      // const recentGames = await apiService.getRecentGames(ctx.from);
      
      await ctx.reply(
        '🎮 Последние игры:\n\n' +
        '(Для просмотра полной истории используйте WebApp)\n\n' +
        '📱 Нажмите кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('📊 Полная история', `${config.webAppUrl}?screen=history`)
        ])
      );
    } catch (error) {
      console.error('Ошибка получения истории игр:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки');
    }
  });
  
  // Обработчик для быстрого просмотра последних депозитов  
  bot.action('recent_deposits', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Загружаем последние депозиты...');
      
      await ctx.reply(
        '💳 Последние депозиты:\n\n' +
        '(Для просмотра полной истории используйте WebApp)\n\n' +
        '📱 Нажмите кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('📊 Полная история', `${config.webAppUrl}?screen=history`)
        ])
      );
    } catch (error) {
      console.error('Ошибка получения истории депозитов:', error);
      await ctx.answerCbQuery('❌ Ошибка загрузки');
    }
  });
  
  // === ОБРАБОТКА КОМАНД ===
  
  // Команда отмены
  bot.command('cancel', async (ctx) => {
    ctx.session = {};
    await ctx.reply('❌ Операция отменена');
  });
  
  // === ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ===
  
  bot.on('text', async (ctx) => {
    
    // Обработка ввода суммы для депозита
    if (ctx.session && ctx.session.waitingForDepositAmount) {
      const amount = parseFloat(ctx.message.text);
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите число от 1 до 10000:');
        return;
      }
      
      if (amount < 1) {
        await ctx.reply('❌ Минимальная сумма пополнения: 1 USDT');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма пополнения: 10000 USDT');
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
    if (ctx.session && ctx.session.waitingForWithdrawAmount) {
      const amount = parseFloat(ctx.message.text);
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите число от 1 до 10000:');
        return;
      }
      
      if (amount < 1) {
        await ctx.reply('❌ Минимальная сумма вывода: 1 USDT');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма вывода: 10000 USDT');
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
        return;
      }
      
      ctx.session.withdrawAmount = amount;
      delete ctx.session.waitingForWithdrawAmount;
      
      await ctx.reply(
        `📤 Куда вывести ${amount} USDT?\n\n` +
        `Введите Telegram username получателя (без @):\n\n` +
        `⚠️ Важно:\n` +
        `• Получатель должен использовать @CryptoBot\n` +
        `• Вводите без символа @\n` +
        `• Проверьте правильность написания`
      );
      
      ctx.session.waitingForWithdrawRecipient = true;
      return;
    }
    
    // Обработка ввода получателя для вывода
    if (ctx.session && ctx.session.waitingForWithdrawRecipient) {
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
    
    // Обработка обычных сообщений
    const messageText = ctx.message.text.toLowerCase();
    
    if (messageText.includes('играть') || messageText.includes('игр') || messageText.includes('казино')) {
      await ctx.reply(
        '🎮 Для игры используйте:\n\n' +
        '1️⃣ Кнопку "Играть" в меню бота\n' +
        '2️⃣ Или кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('🎮 Открыть казино', config.webAppUrl)
        ])
      );
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
