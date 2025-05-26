// start.command.js - УПРОЩЕННАЯ ВЕРСИЯ
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
    
    // Создаем простую клавиатуру только с текстовыми кнопками
    const keyboard = Markup.keyboard([
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
    
    // Отправляем сообщение с inline кнопкой для запуска игр
    await ctx.reply(
      '🎮 Для игры используйте кнопку "Играть" в меню бота или нажмите на кнопку ниже:',
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
