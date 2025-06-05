// profile.command.js
const { Markup } = require('telegraf');
const config = require('../config');
const { checkChatType } = require('../utils/chat-utils');

/**
 * Обработчик команды /profile
 * @param {Object} ctx - Контекст Telegraf
 */
async function profileCommand(ctx) {
  try {
    // Только в личных сообщениях
    const chatCheck = checkChatType(ctx, ['private']);
    if (!chatCheck.isAllowed) {
      await ctx.reply(chatCheck.message, { parse_mode: 'Markdown' });
      return;
    }
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