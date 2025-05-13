// callback.handler.js
const { Markup } = require('telegraf');
const config = require('../config');
const { createInvoice } = require('../services/payment.service');

/**
 * Обработчик callback запросов (нажатия на inline кнопки)
 * @param {Object} bot - Экземпляр бота Telegraf
 */
function registerCallbackHandlers(bot) {
  // Обработка действий пополнения баланса
  bot.action(/deposit:(\d+|custom)/, async (ctx) => {
    try {
      // Получаем сумму из callback data
      const amount = ctx.match[1];
      
      if (amount === 'custom') {
        // Запрашиваем у пользователя ввод суммы
        await ctx.reply('Введите сумму для пополнения (в USDT):');
        // Устанавливаем следующий шаг в сцене или в контексте пользователя
        // Для простоты примера, здесь используем промежуточный обработчик
        return;
      }
      
      // Создаем инвойс для оплаты
      const invoice = await createInvoice(ctx.from.id, parseFloat(amount));
      
      // Отправляем пользователю ссылку на оплату
      await ctx.reply(
        `💰 Создан счет на сумму ${amount} USDT.\n\nНажмите на кнопку ниже для оплаты:`,
        Markup.inlineKeyboard([
          Markup.button.url('Оплатить', invoice.payUrl)
        ])
      );
    } catch (error) {
      console.error('Ошибка при обработке действия пополнения:', error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
    }
  });
  
  // Обработка других callback запросов
  
  return bot;
}

module.exports = {
  registerCallbackHandlers
};