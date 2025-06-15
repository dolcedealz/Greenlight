// bot/src/commands/giveaways.command.js
const { Markup } = require('telegraf');
const config = require('../config/config');

/**
 * Команда для отображения розыгрышей
 */
async function giveawaysCommand(ctx) {
  try {
    // Создаем WebApp кнопку для открытия раздела розыгрышей
    const webAppUrl = `${config.webApp.url}?tab=giveaways`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.webApp('🎁 Открыть розыгрыши', webAppUrl)]
    ]);

    await ctx.reply(
      '🎁 *Розыгрыши*\n\n' +
      '🏆 Участвуйте в ежедневных и недельных розыгрышах!\n' +
      '💎 Выигрывайте ценные призы и Telegram Gifts!\n\n' +
      '📋 *Условия участия:*\n' +
      '• Сделайте депозит\n' +
      '• Откройте раздел "Розыгрыши" в приложении\n' +
      '• Нажмите "Участвовать"\n\n' +
      '⏰ Розыгрыши проводятся каждый день в 20:00 МСК',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      }
    );
  } catch (error) {
    console.error('Ошибка команды розыгрышей:', error);
    await ctx.reply('❌ Произошла ошибка при загрузке информации о розыгрышах');
  }
}

module.exports = {
  giveawaysCommand
};