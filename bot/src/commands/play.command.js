// play.command.js
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик команды /play
 * @param {Object} ctx - Контекст Telegraf
 */
async function playCommand(ctx) {
  try {
    const { webAppUrl } = config;
    
    // Отправляем сообщение с кнопками для выбора игры
    await ctx.reply(
      '🎮 Выберите игру:',
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('🎰 Слоты', `${webAppUrl}?game=slots`),
          Markup.button.webApp('💣 Мины', `${webAppUrl}?game=mines`)
        ],
        [
          Markup.button.webApp('📈 Краш', `${webAppUrl}?game=crash`),
          Markup.button.webApp('🪙 Монетка', `${webAppUrl}?game=coin`)
        ],
        [
          Markup.button.webApp('🔮 События', `${webAppUrl}?screen=events`),
        ]
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /play:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = playCommand;