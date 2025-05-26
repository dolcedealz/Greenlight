// bot/src/handlers/message.handler.js - ОРИГИНАЛ
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчик текстовых сообщений
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerMessageHandlers(bot) {
  // Обработка текстовых кнопок
  bot.hears('🎮 Играть', async (ctx) => {
    await ctx.reply(
      '🎮 Выберите игру:',
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('🎰 Слоты', `${config.webAppUrl}?game=slots`),
          Markup.button.webApp('💣 Мины', `${config.webAppUrl}?game=mines`)
        ],
        [
          Markup.button.webApp('📈 Краш', `${config.webAppUrl}?game=crash`),
          Markup.button.webApp('🪙 Монетка', `${config.webAppUrl}?game=coin`)
        ],
        [
          Markup.button.webApp('🔮 События', `${config.webAppUrl}?screen=events`),
        ]
      ])
    );
  });
  
  bot.hears('👤 Профиль', async (ctx) => {
    await ctx.reply(
      '👤 Ваш профиль:',
      Markup.inlineKeyboard([
        Markup.button.webApp('Открыть профиль', `${config.webAppUrl}?screen=profile`)
      ])
    );
  });
  
  bot.hears('💰 Пополнить', async (ctx) => {
    await ctx.reply(
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
  
  bot.hears('💸 Вывести', async (ctx) => {
    try {
      // Проверяем баланс перед показом меню
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < 1) {
        await ctx.reply(
          '❌ Недостаточно средств для вывода\n\n' +
          `Ваш баланс: ${balance.toFixed(2)} USDT\n` +
          'Минимальная сумма вывода: 1 USDT'
        );
        return;
      }
      
      await ctx.reply(
        '💸 Вывод средств\n\n' +
        `💰 Ваш баланс: ${balance.toFixed(2)} USDT\n\n` +
        '📋 Условия вывода:\n' +
        '• Минимальная сумма: 1 USDT\n' +
        '• Максимальная сумма: 10,000 USDT\n' +
        '• До 300 USDT - автоматически\n' +
        '• Свыше 300 USDT - требует одобрения\n' +
        '• Время обработки: 5-15 минут\n\n' +
        'Выберите сумму для вывода:',
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
            Markup.button.callback('Другая сумма', 'withdraw:custom'),
            Markup.button.callback('📋 История выводов', 'withdrawals_history')
          ]
        ])
      );
    } catch (error) {
      console.error('Ошибка при проверке баланса:', error);
      await ctx.reply(config.messages.withdraw);
    }
  });
  
  bot.hears('👥 Рефералы', async (ctx) => {
    try {
      const referralCode = await apiService.getUserReferralCode(ctx.from);
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${referralCode}`;
      
      await ctx.reply(
        `${config.messages.referral}${referralLink}\n\nПригласите друзей и получайте бонусы!`,
        Markup.inlineKeyboard([
          Markup.button.webApp('Подробнее', `${config.webAppUrl}?screen=referrals`)
        ])
      );
    } catch (error) {
      console.error('Ошибка получения реферального кода:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  });
  
  bot.hears('📊 История', async (ctx) => {
    await ctx.reply(
      'Ваша история игр и транзакций:',
      Markup.inlineKeyboard([
        Markup.button.webApp('Открыть историю', `${config.webAppUrl}?screen=history`)
      ])
    );
  });
  
  // Обработка команды отмены
  bot.command('cancel', async (ctx) => {
    // Очищаем все состояния сессии
    ctx.session = {};
    await ctx.reply('❌ Операция отменена', Markup.removeKeyboard());
  });
  
  // Обработка всех остальных текстовых сообщений
  bot.on('text', async (ctx) => {
    // Обработка ввода суммы для депозита
    if (ctx.session && ctx.session.waitingForDepositAmount) {
      const amount = parseFloat(ctx.message.text);
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите число от 1 до 10000:');
        return;
      }
      
      if (amount < 1) {
        await ctx.reply('❌ Минимальная сумма пополнения: 1 USDT. Введите корректную сумму:');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма пополнения: 10000 USDT. Введите корректную сумму:');
        return;
      }
      
      // Обрабатываем депозит
      delete ctx.session.waitingForDepositAmount;
      
      try {
        const depositData = await apiService.createDeposit(ctx.from, amount, {
          source: 'bot',
          description: `Пополнение через Telegram бот на ${amount} USDT`
        });
        
        await ctx.reply(
          `💰 Создан счет на пополнение баланса\n\n` +
          `💵 Сумма: ${amount} USDT\n` +
          `🆔 ID депозита: ${depositData.depositId}\n` +
          `⏰ Срок действия: 1 час\n\n` +
          `Нажмите на кнопку ниже для оплаты:`,
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Оплатить', depositData.payUrl)],
            [Markup.button.callback('📋 Статус платежа', `check_deposit_status:${depositData.depositId}`)]
          ])
        );
      } catch (error) {
        console.error('Ошибка создания депозита:', error);
        await ctx.reply('❌ Не удалось создать счет для оплаты. Попробуйте позже.');
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
        await ctx.reply('❌ Минимальная сумма вывода: 1 USDT. Введите корректную сумму:');
        return;
      }
      
      if (amount > 10000) {
        await ctx.reply('❌ Максимальная сумма вывода: 10000 USDT. Введите корректную сумму:');
        return;
      }
      
      // Проверяем баланс
      const balance = await apiService.getUserBalance(ctx.from);
      
      if (balance < amount) {
        await ctx.reply(
          `❌ Недостаточно средств\n\n` +
          `Ваш баланс: ${balance.toFixed(2)} USDT\n` +
          `Запрошено: ${amount.toFixed(2)} USDT\n\n` +
          `Введите другую сумму или используйте /cancel для отмены:`
        );
        return;
      }
      
      // Сохраняем сумму и запрашиваем получателя
      ctx.session.withdrawAmount = amount;
      delete ctx.session.waitingForWithdrawAmount;
      
      await ctx.reply(
        '📤 Куда вывести средства?\n\n' +
        'Введите Telegram username получателя (без @):\n\n' +
        '⚠️ Важно:\n' +
        '• Получатель должен быть зарегистрирован в @CryptoBot\n' +
        '• Username вводится без символа @\n' +
        '• Проверьте правильность username перед отправкой'
      );
      
      ctx.session.waitingForWithdrawRecipient = true;
      return;
    }
    
    // Обработка ввода получателя для вывода
    if (ctx.session && ctx.session.waitingForWithdrawRecipient) {
      const recipient = ctx.message.text.replace('@', '').trim();
      
      // Валидация username
      if (!recipient.match(/^[a-zA-Z0-9_]{5,32}$/)) {
        await ctx.reply(
          '❌ Некорректный username\n\n' +
          'Username должен:\n' +
          '• Содержать 5-32 символа\n' +
          '• Состоять только из букв, цифр и _\n' +
          '• Вводиться без символа @\n\n' +
          'Попробуйте еще раз:'
        );
        return;
      }
      
      const amount = ctx.session.withdrawAmount;
      
      // Показываем подтверждение
      delete ctx.session.waitingForWithdrawRecipient;
      
      await ctx.reply(
        `📋 Подтверждение вывода\n\n` +
        `💵 Сумма: ${amount} USDT\n` +
        `📤 Получатель: @${recipient}\n` +
        `${amount > 300 ? '⚠️ Требует одобрения администратора\n' : '⚡ Автоматическая обработка\n'}\n` +
        `Все верно?`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Подтвердить', `confirm_withdraw:${amount}:${recipient}`),
            Markup.button.callback('❌ Отменить', 'cancel_withdraw')
          ]
        ])
      );
      
      return;
    }
    
    // По умолчанию отправляем сообщение о неизвестной команде
    await ctx.reply(config.messages.invalidCommand);
  });
  
  return bot;
}

module.exports = {
  registerMessageHandlers
};
