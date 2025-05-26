// start.command.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
    
    // ИСПРАВЛЕНО: Создаем клавиатуру ТОЛЬКО с WebApp кнопками
    const keyboard = Markup.keyboard([
      [
        Markup.button.webApp('🎮 Играть', `${webAppUrl}`),
        Markup.button.webApp('👤 Профиль', `${webAppUrl}?screen=profile`)
      ],
      [
        Markup.button.webApp('💰 Пополнить', `${webAppUrl}?screen=deposit`),
        Markup.button.webApp('💸 Вывести', `${webAppUrl}?screen=withdraw`)
      ],
      [
        Markup.button.webApp('👥 Рефералы', `${webAppUrl}?screen=referrals`),
        Markup.button.webApp('📊 История', `${webAppUrl}?screen=history`)
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
