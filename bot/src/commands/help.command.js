// help.command.js
const config = require('../config');

/**
 * Обработчик команды /help
 * @param {Object} ctx - Контекст Telegraf
 */
async function helpCommand(ctx) {
  try {
    const helpMessage = 
      '🎮 <b>Greenlight Games Bot</b>\n\n' +
      '📜 <b>Основные команды:</b>\n' +
      '/start - Начать работу с ботом\n' +
      '/play - Открыть веб-приложение с играми\n' +
      '/balance - Узнать текущий баланс\n' +
      '/profile - Посмотреть профиль\n' +
      '/deposit - Пополнить баланс\n' +
      '/withdraw - Вывести средства\n' +
      '/promocode [КОД] - Активировать промокод\n' +
      '/help - Показать это сообщение\n\n' +
      '🎁 <b>Промокоды:</b>\n' +
      'Используйте /promocode ВАШИ_КОД для получения бонусов!\n' +
      'Промокоды дают:\n' +
      '• 💰 Бонус на баланс\n' +
      '• 🎮 Бесплатные игры\n' +
      '• 📈 Бонус к депозиту\n' +
      '• 🏆 VIP статус\n\n' +
      '🎯 <b>Игры:</b>\n' +
      '• Монетка - угадайте сторону\n' +
      '• Краш - выводите ставку вовремя\n' +
      '• Мины - избегайте мин\n' +
      '• Слоты - классические слот-автоматы\n\n' +
      '💬 Поддержка: @greenlight_support';

    await ctx.reply(helpMessage, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Ошибка при обработке команды /help:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
  }
}

module.exports = helpCommand;