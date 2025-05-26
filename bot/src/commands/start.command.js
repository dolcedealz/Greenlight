// start.command.js - ВОЗВРАЩАЕМ ОРИГИНАЛ
const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Обработчик команды /start
 * @param {Object} ctx - Контекст Telegraf
 */
async function startCommand(ctx) {
  try {
    const { webAppUrl } = config;
    
    // Получаем данные пользователя
    const { id, first_name, username } = ctx.from;
    
    console.log(`Пользователь ${first_name} (${id}) запустил бота`);
    
    // Создаем клавиатуру с кнопками (только 2 WebApp кнопки)
    const keyboard = Markup.keyboard([
      [
        Markup.button.webApp('🎮 Играть', `${webAppUrl}`),
        Markup.button.webApp('👤 Профиль', `${webAppUrl}?screen=profile`)
      ],
      [
        Markup.button.text('💰 Пополнить'),
        Markup.button.text('💸 Вывести')
      ],
      [
        Markup.button.text('👥 Рефералы'),
        Markup.button.text('📊 История')
      ]
    ]).resize();
    
    // Отправляем приветственное сообщение с клавиатурой
    await ctx.reply(config.messages.welcome, keyboard);
    
    // Отправляем сообщение с кнопкой для запуска WebApp
    await ctx.reply(
      '🚀 Нажмите на кнопку, чтобы запустить Greenlight Casino',
      Markup.inlineKeyboard([
        Markup.button.webApp('🎮 Открыть казино', `${webAppUrl}`)
      ])
    );
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = startCommand;
