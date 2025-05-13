// help.command.js
const config = require('../config');

/**
 * Обработчик команды /help
 * @param {Object} ctx - Контекст Telegraf
 */
async function helpCommand(ctx) {
  try {
    await ctx.reply(config.messages.help);
  } catch (error) {
    console.error('Ошибка при обработке команды /help:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = helpCommand;