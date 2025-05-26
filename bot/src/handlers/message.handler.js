// bot/src/handlers/message.handler.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');
const config = require('../config');
const apiService = require('../services/api.service');

/**
 * Обработчик текстовых сообщений
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerMessageHandlers(bot) {
  // УБРАНО: Обработчики для текстовых кнопок WebApp больше не нужны
  // так как все кнопки теперь WebApp кнопки
  
  // Обработка команды отмены
  bot.command('cancel', async (ctx) => {
    // Очищаем все состояния сессии
    ctx.session = {};
    await ctx.reply('❌ Операция отменена', Markup.removeKeyboard());
  });
  
  // Обработка всех текстовых сообщений
  bot.on('text', async (ctx) => {
    // Обработка ввода суммы для депозита (если используется через callback)
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
    
    // Обработка основных команд через текст
    const messageText = ctx.message.text.toLowerCase();
    
    if (messageText.includes('играть') || messageText.includes('игр')) {
      await ctx.reply(
        '🎮 Для игры используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('🎮 Открыть казино', config.webAppUrl)
        ])
      );
      return;
    }
    
    if (messageText.includes('профиль') || messageText.includes('аккаунт')) {
      await ctx.reply(
        '👤 Для просмотра профиля используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('👤 Открыть профиль', `${config.webAppUrl}?screen=profile`)
        ])
      );
      return;
    }
    
    if (messageText.includes('пополн') || messageText.includes('депозит')) {
      await ctx.reply(
        '💰 Для пополнения используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('💰 Пополнить баланс', `${config.webAppUrl}?screen=deposit`)
        ])
      );
      return;
    }
    
    if (messageText.includes('выв') || messageText.includes('withdraw')) {
      await ctx.reply(
        '💸 Для вывода используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('💸 Вывести средства', `${config.webAppUrl}?screen=withdraw`)
        ])
      );
      return;
    }
    
    if (messageText.includes('реферал') || messageText.includes('пригласит')) {
      await ctx.reply(
        '👥 Для управления рефералами используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('👥 Реферальная программа', `${config.webAppUrl}?screen=referrals`)
        ])
      );
      return;
    }
    
    if (messageText.includes('истор') || messageText.includes('транзакц')) {
      await ctx.reply(
        '📊 Для просмотра истории используйте WebApp кнопки выше или нажмите на кнопку ниже:',
        Markup.inlineKeyboard([
          Markup.button.webApp('📊 История игр', `${config.webAppUrl}?screen=history`)
        ])
      );
      return;
    }
    
    // По умолчанию предлагаем использовать WebApp
    await ctx.reply(
      '🎰 Добро пожаловать в Greenlight Casino!\n\n' +
      'Используйте кнопки WebApp выше для доступа к казино, или нажмите на кнопку ниже:',
      Markup.inlineKeyboard([
        Markup.button.webApp('🎮 Открыть казино', config.webAppUrl)
      ])
    );
  });
  
  return bot;
}

module.exports = {
  registerMessageHandlers
};
