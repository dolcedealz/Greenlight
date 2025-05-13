// profile.command.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик команды /profile
 * @param {Object} ctx - Контекст Telegraf
 */
async function profileCommand(ctx) {
  try {
    const { webAppUrl } = config;
    
    // Отправляем сообщение с кнопкой для открытия профиля
    await ctx.reply(
      '👤 Нажмите на кнопку, чтобы открыть свой профиль:',
      Markup.inlineKeyboard([
        Markup.button.webApp('👤 Открыть профиль', `${webAppUrl}?screen=profile`)
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /profile:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = profileCommand;