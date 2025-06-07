// admin/src/handlers/message.handler.js

// Import command modules
const eventsCommands = require('../commands/events.command');
const usersCommands = require('../commands/users.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');
const apiService = require('../services/admin.service');

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
      
      // Обработка назначения партнерского статуса
      if (ctx.session?.assigningPartner) {
        await usersCommands.handlePartnerAssignment(ctx);
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
      
      // Обработка вывода прибыли владельца
      if (ctx.session?.withdrawingProfit) {
        await handleProfitWithdrawal(ctx);
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

      // Обработка обычных кнопок клавиатуры 
      switch (text) {
        case '📊 Финансы':
          // Показать меню финансов
          await ctx.reply(
            '💰 *Управление финансами*',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '📊 Текущее состояние', callback_data: 'finance_current_state' },
                    { text: '📈 Финансовый отчет', callback_data: 'finance_report' }
                  ],
                  [
                    { text: '🔄 Пересчитать финансы', callback_data: 'finance_recalculate' },
                    { text: '⚙️ Настроить резерв', callback_data: 'finance_set_reserve' }
                  ],
                  [
                    { text: '💸 Вывод прибыли', callback_data: 'finance_withdraw_profit' },
                    { text: '📝 История балансов', callback_data: 'finance_balance_history' }
                  ],
                  [
                    { text: '🎮 Статистика игр', callback_data: 'finance_game_stats' }
                  ]
                ]
              }
            }
          );
          break;

        case '👥 Пользователи':
          await usersCommands.showUsersMenu(ctx);
          break;

        case '🏦 Транзакции':
          await transactionsCommands.showTransactionsMenu(ctx);
          break;

        case '🔮 События':
          await eventsCommands.showEventsMenu(ctx);
          break;

        case '🎯 Коэффициенты':
          await ctx.reply('🎯 Управление коэффициентами временно недоступно');
          break;

        case '🎁 Промокоды':
          await promoCommands.showPromoMenu(ctx);
          break;

        case '🛡️ Безопасность':
          await ctx.reply('🛡️ Модуль безопасности временно недоступен');
          break;

        case '📊 Мониторинг':
          await ctx.reply('📊 Модуль мониторинга временно недоступен');
          break;

        case '💾 Бэкапы':
          await ctx.reply('💾 Модуль бэкапов временно недоступен');
          break;

        case '📢 Уведомления':
          await ctx.reply('📢 Модуль уведомлений временно недоступен');
          break;

        case '⚙️ Настройки':
          await ctx.reply('⚙️ Модуль настроек временно недоступен');
          break;

        default:
          // Если нет активной сессии - показываем подсказку
          await ctx.reply(
            '❓ Используйте кнопки меню для навигации или /start для возврата в главное меню.'
          );
      }
      
    } catch (error) {
      console.error('ADMIN: Ошибка обработки текстового сообщения:', error);
      await ctx.reply('❌ Произошла ошибка при обработке вашего сообщения.');
    }
  });

  console.log('✅ Message handlers зарегистрированы');
}

/**
 * Обработка вывода прибыли владельца
 */
async function handleProfitWithdrawal(ctx) {
  const text = ctx.message.text.trim();
  const session = ctx.session.withdrawingProfit;
  
  try {
    if (session.step === 'amount') {
      // Проверяем корректность введенной суммы
      const amount = parseFloat(text);
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Введите корректную сумму (число больше 0)');
        return;
      }
      
      if (amount > session.availableAmount) {
        await ctx.reply(
          `❌ Сумма превышает доступную для вывода.\n\n` +
          `💰 Доступно: ${session.availableAmount.toFixed(2)} USDT`
        );
        return;
      }
      
      // Переходим к следующему шагу
      session.amount = amount;
      session.step = 'recipient';
      
      await ctx.reply(
        `💸 *Вывод прибыли владельца*\n\n` +
        `💰 Сумма: *${amount.toFixed(2)} USDT*\n\n` +
        `📧 Введите адрес получателя (кошелек):`,
        { parse_mode: 'Markdown' }
      );
      
    } else if (session.step === 'recipient') {
      // Сохраняем адрес получателя
      session.recipient = text;
      session.step = 'comment';
      
      await ctx.reply(
        `💸 *Вывод прибыли владельца*\n\n` +
        `💰 Сумма: *${session.amount.toFixed(2)} USDT*\n` +
        `📧 Получатель: \`${text}\`\n\n` +
        `💬 Введите комментарий к выводу:`,
        { parse_mode: 'Markdown' }
      );
      
    } else if (session.step === 'comment') {
      // Сохраняем комментарий и выполняем вывод
      session.comment = text;
      
      await ctx.reply('🔄 Выполняется вывод прибыли...');
      
      try {
        const response = await apiService.post('/admin/finance/withdraw-profit', {
          amount: session.amount,
          recipient: session.recipient,
          comment: session.comment
        });
        
        if (response.success) {
          await ctx.reply(
            `✅ *Прибыль успешно выведена!*\n\n` +
            `💰 Сумма: *${session.amount.toFixed(2)} USDT*\n` +
            `📧 Получатель: \`${session.recipient}\`\n` +
            `💬 Комментарий: ${session.comment}\n\n` +
            `📊 Новый операционный баланс: *${response.data.newOperationalBalance.toFixed(2)} USDT*\n` +
            `💸 Доступно для вывода: *${response.data.newAvailable.toFixed(2)} USDT*`,
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 К финансам', callback_data: 'finances_menu' }],
                  [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
                ]
              }
            }
          );
        } else {
          await ctx.reply(
            `❌ Ошибка при выводе прибыли:\n\n${response.message}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 К финансам', callback_data: 'finances_menu' }]
                ]
              }
            }
          );
        }
        
      } catch (error) {
        console.error('ADMIN: Ошибка API при выводе прибыли:', error);
        await ctx.reply(
          `❌ Ошибка при выводе прибыли:\n\n${error.message}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 К финансам', callback_data: 'finances_menu' }]
              ]
            }
          }
        );
      }
      
      // Очищаем сессию
      delete ctx.session.withdrawingProfit;
    }
    
  } catch (error) {
    console.error('ADMIN: Ошибка обработки вывода прибыли:', error);
    await ctx.reply('❌ Произошла ошибка при обработке вывода прибыли.');
    delete ctx.session.withdrawingProfit;
  }
}

module.exports = registerMessageHandlers;