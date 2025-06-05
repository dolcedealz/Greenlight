// play.command.js
const { Markup } = require('telegraf');
const config = require('../config');
const { checkChatType } = require('../utils/chat-utils');
const { createWebAppKeyboard } = require('../utils/webapp-utils');

/**
 * Обработчик команды /play
 * @param {Object} ctx - Контекст Telegraf
 */
async function playCommand(ctx) {
  try {
    // Проверяем тип чата - команда работает только в личных сообщениях
    const chatCheck = checkChatType(ctx, ['private']);
    if (!chatCheck.isAllowed) {
      await ctx.reply(chatCheck.message, { parse_mode: 'Markdown' });
      return;
    }
    
    // Создаем клавиатуру с играми
    const keyboardData = createWebAppKeyboard([
      [
        { text: '🎰 Слоты', query: '?game=slots' },
        { text: '💣 Мины', query: '?game=mines' }
      ],
      [
        { text: '📈 Краш', query: '?game=crash' },
        { text: '🪙 Монетка', query: '?game=coin' }
      ],
      [
        { text: '🔮 События', query: '?screen=events' }
      ]
    ]);
    
    if (keyboardData.isValid) {
      await ctx.reply('🎮 Выберите игру:', keyboardData.keyboard);
    } else {
      await ctx.reply(keyboardData.error);
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /play:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = playCommand;