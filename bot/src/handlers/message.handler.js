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
  
  // Обработка всех остальных сообщений
  bot.on('text', async (ctx) => {
    // Проверяем, находится ли пользователь в каком-либо состоянии
    // (например, ввод суммы для пополнения)
    
    // По умолчанию отправляем сообщение о неизвестной команде
    await ctx.reply(config.messages.invalidCommand);
  });
  
  return bot;
}

module.exports = {
  registerMessageHandlers
};