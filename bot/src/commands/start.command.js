// start.command.js - УПРОЩЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');
const config = require('../config');
const { checkChatType } = require('../utils/chat-utils');

/**
 * Обработчик команды /start
 * @param {Object} ctx - Контекст Telegraf
 */
async function startCommand(ctx) {
  try {
    // Проверяем тип чата - команда работает только в личных сообщениях
    const chatCheck = checkChatType(ctx, ['private']);
    if (!chatCheck.isAllowed) {
      await ctx.reply(chatCheck.message, { parse_mode: 'Markdown' });
      return;
    }
    
    const { webAppUrl } = config;
    const apiService = require('../services/api.service');
    const { checkPendingInvites } = require('../handlers/inline.handler');
    
    // Получаем данные пользователя
    const { id, first_name, username } = ctx.from;
    
    // Извлекаем реферальный код из команды /start
    const messageText = ctx.message.text || '';
    const args = messageText.split(' ');
    const referralCode = args.length > 1 ? args[1] : null;
    
    console.log(`Пользователь ${first_name} (${id}) запустил бота${referralCode ? ` с реферальным кодом: ${referralCode}` : ''}`);
    
    // Создаем или обновляем пользователя с реферальным кодом
    try {
      const userData = {
        id,
        first_name,
        username,
        language_code: ctx.from.language_code || 'ru'
      };
      
      await apiService.createOrUpdateUser(userData, referralCode);
      console.log(`Пользователь ${id} успешно создан/обновлен${referralCode ? ' с реферером' : ''}`);
      
      if (referralCode) {
        await ctx.reply(
          `🎉 Добро пожаловать в Greenlight Casino!\n\n` +
          `✅ Вы зарегистрированы по реферальной ссылке!\n` +
          `🎁 Ваш реферер получит бонус с ваших первых игр\n\n` +
          `💰 Начните играть и зарабатывать!`
        );
      }
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      // Продолжаем выполнение даже при ошибке
    }
    
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
    
    // Проверяем ожидающие приглашения на дуэли
    if (username) {
      await checkPendingInvites(ctx.telegram, username, id);
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = startCommand;
