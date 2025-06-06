// admin/src/handlers/message.handler.js

// Import command modules
const eventsCommands = require('../commands/events.command');
const usersCommands = require('../commands/users.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');

/**
 * Регистрирует обработчики текстовых сообщений для админ-бота
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerMessageHandlers(bot) {
  console.log('🔄 Регистрация message handlers...');

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    
    try {
      // Обработка создания события
      if (ctx.session?.creatingEvent) {
        await eventsCommands.handleEventCreation(ctx);
        return;
      }
      
      // Обработка завершения события
      if (ctx.session?.finishingEvent) {
        await eventsCommands.handleEventFinishing(ctx);
        return;
      }
      
      // Обработка поиска пользователя
      if (ctx.session?.searchingUser) {
        await usersCommands.handleUserSearch(ctx);
        return;
      }
      
      // Обработка изменения баланса пользователя
      if (ctx.session?.adjustingBalance) {
        await usersCommands.handleBalanceAdjustment(ctx);
        return;
      }
      
      // Обработка отклонения вывода
      if (ctx.session?.rejectingWithdrawal) {
        await transactionsCommands.handleWithdrawalRejection(ctx);
        return;
      }
      
      // Обработка создания промокода
      if (ctx.session?.creatingPromo) {
        await promoCommands.handlePromoCreation(ctx);
        return;
      }
      
      // Команды
      if (text.startsWith('/')) {
        const command = text.toLowerCase();
        
        switch (command) {
          case '/start':
            await ctx.reply(
              '🏠 *Добро пожаловать в админ-панель!*\n\nВыберите раздел для управления:',
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '💰 Финансы', callback_data: 'finances_menu' },
                      { text: '👥 Пользователи', callback_data: 'users_menu' }
                    ],
                    [
                      { text: '💳 Транзакции', callback_data: 'transactions_menu' },
                      { text: '🎯 События', callback_data: 'events_menu' }
                    ],
                    [
                      { text: '🎁 Промокоды', callback_data: 'promo_menu' },
                      { text: '📊 Статистика', callback_data: 'stats_menu' }
                    ]
                  ]
                }
              }
            );
            break;
            
          default:
            await ctx.reply(
              '❓ Неизвестная команда. Используйте /start для открытия меню.'
            );
        }
        return;
      }
      
      // Если нет активной сессии - показываем подсказку
      await ctx.reply(
        '❓ Используйте кнопки меню для навигации или /start для возврата в главное меню.'
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка обработки текстового сообщения:', error);
      await ctx.reply('❌ Произошла ошибка при обработке вашего сообщения.');
    }
  });

  console.log('✅ Message handlers зарегистрированы');
}

module.exports = registerMessageHandlers;