// profile.command.js
const { Markup } = require('telegraf');
const config = require('../config');
const { checkChatType } = require('../utils/chat-utils');
const { getWebAppUrl } = require('../utils/webapp-utils');

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
    // Получаем URL для профиля
    const webAppData = getWebAppUrl('?screen=profile');
    
    if (webAppData.isValid) {
      await ctx.reply(
        '👤 Нажмите на кнопку, чтобы открыть свой профиль:',
        Markup.inlineKeyboard([
          Markup.button.webApp('👤 Открыть профиль', webAppData.url)
        ])
      );
    } else {
      await ctx.reply(webAppData.error);
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /profile:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = profileCommand;