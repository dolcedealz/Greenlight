// message.handler.js
const { Markup } = require('telegraf');
const config = require('../config');

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
    await ctx.reply(
      config.messages.withdraw,
      Markup.inlineKeyboard([
        Markup.button.webApp('Запросить вывод', `${config.webAppUrl}?screen=withdraw`)
      ])
    );
  });
  
  bot.hears('👥 Рефералы', async (ctx) => {
    // Здесь должно быть получение реферального кода пользователя с сервера
    const referralCode = 'ABCD1234'; // Пример
    const referralLink = `https://t.me/${ctx.botInfo.username}?start=${referralCode}`;
    
    await ctx.reply(
      `${config.messages.referral}${referralLink}\n\nПригласите друзей и получайте бонусы!`,
      Markup.inlineKeyboard([
        Markup.button.webApp('Подробнее', `${config.webAppUrl}?screen=referrals`)
      ])
    );
  });
  
  bot.hears('📊 История', async (ctx) => {
    await ctx.reply(
      'Ваша история игр и транзакций:',
      Markup.inlineKeyboard([
        Markup.button.webApp('Открыть историю', `${config.webAppUrl}?screen=history`)
      ])
    );
  });
  
  // Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    // Проверяем, ожидаем ли мы сумму для пополнения
    if (ctx.session.awaitingDepositAmount) {
      // Сбрасываем флаг
      ctx.session.awaitingDepositAmount = false;
      
      // Парсим введенную сумму
      const amount = parseFloat(ctx.message.text.replace(',', '.'));
      
      // Проверяем корректность суммы
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Пожалуйста, введите корректную сумму для пополнения.');
      }
      
      // Минимальная и максимальная сумма
      if (amount < 1) {
        return ctx.reply('Минимальная сумма пополнения - 1 USDT.');
      }
      
      if (amount > 1000) {
        return ctx.reply('Максимальная сумма пополнения - 1000 USDT.');
      }
      
      // Создаем инвойс для оплаты
      const invoice = await createInvoice(ctx.from.id, amount);
      
      // Сохраняем ID инвойса в сессии
      ctx.session.lastInvoiceId = invoice.invoice_id;
      
      // Отправляем пользователю ссылку на оплату
      await ctx.reply(
        `💰 Создан счет на сумму ${amount.toFixed(2)} USDT.\n\nНажмите на кнопку ниже для оплаты:`,
        Markup.inlineKeyboard([
          Markup.button.url('Оплатить', invoice.pay_url),
          Markup.button.callback('Проверить статус', 'check_payment')
        ])
      );
    } else {
      // Стандартный ответ на текст
      await ctx.reply(config.messages.invalidCommand);
    }
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
});
  
  return bot;
}

module.exports = {
  registerMessageHandlers
};