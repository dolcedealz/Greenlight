// bot/src/commands/giveaways.command.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Команда для отображения розыгрышей
 */
async function giveawaysCommand(ctx) {
  try {
    let keyboard = [];
    let message = '🎁 *Розыгрыши*\n\n' +
                 '🏆 Участвуйте в ежедневных и недельных розыгрышах!\n' +
                 '💎 Выигрывайте ценные призы и Telegram Gifts!\n\n' +
                 '📋 *Условия участия:*\n' +
                 '• Сделайте депозит\n' +
                 '• Откройте раздел "Розыгрыши" в приложении\n' +
                 '• Нажмите "Участвовать"\n\n' +
                 '⏰ Розыгрыши проводятся каждый день в 20:00 МСК';

    // Проверяем, настроен ли WebApp URL
    if (config.webAppUrl) {
      const webAppUrl = `${config.webAppUrl}?tab=giveaways`;
      keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🎁 Открыть розыгрыши', webAppUrl)]
      ]);
    } else {
      message += '\n\n❌ Веб-приложение временно недоступно';
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup || undefined
    });
  } catch (error) {
    console.error('Ошибка команды розыгрышей:', error);
    await ctx.reply('❌ Произошла ошибка при загрузке информации о розыгрышах');
  }
}

module.exports = {
  giveawaysCommand
};