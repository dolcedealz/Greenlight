// admin/src/handlers/callback.handler.js
const { Markup } = require('telegraf');

// Import command modules
const statsCommands = require('../commands/stats.command');
const usersCommands = require('../commands/users.command');
const eventsCommands = require('../commands/events.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');

/**
 * Регистрирует все callback handlers для админ-бота
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerCallbackHandlers(bot) {
  console.log('🔄 Регистрация callback handlers...');

  // === ГЛАВНОЕ МЕНЮ ===

  // Главное меню
  bot.action('main_menu', async (ctx) => {
    console.log('ADMIN: Callback main_menu');
    await ctx.answerCbQuery();
    
    // Очищаем любые активные сессии
    if (ctx.session) {
      delete ctx.session.creatingEvent;
      delete ctx.session.finishingEvent;
      delete ctx.session.searchingUser;
      delete ctx.session.settingCoefficient;
      delete ctx.session.searchingUserCoeff;
      delete ctx.session.adjustingBalance;
      delete ctx.session.rejectingWithdrawal;
      delete ctx.session.creatingPromo;
      delete ctx.session.creatingNotification;
      delete ctx.session.assigningPartner;
    }
    
    const message = '🏠 *Главное меню администратора*\n\nВыберите раздел для управления:';
    
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 Финансы', 'finances_menu'),
            Markup.button.callback('👥 Пользователи', 'users_menu')
          ],
          [
            Markup.button.callback('💳 Транзакции', 'transactions_menu'),
            Markup.button.callback('🎯 События', 'events_menu')
          ],
          [
            Markup.button.callback('🎁 Промокоды', 'promo_menu'),
            Markup.button.callback('📊 Статистика', 'stats_menu')
          ]
        ])
      });
    } catch (error) {
      console.error('ADMIN: Ошибка отображения главного меню:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 Финансы', 'finances_menu'),
            Markup.button.callback('👥 Пользователи', 'users_menu')
          ],
          [
            Markup.button.callback('💳 Транзакции', 'transactions_menu'),
            Markup.button.callback('🎯 События', 'events_menu')
          ],
          [
            Markup.button.callback('🎁 Промокоды', 'promo_menu'),
            Markup.button.callback('📊 Статистика', 'stats_menu')
          ]
        ])
      });
    }
  });

  // === СТАТИСТИКА ===

  bot.action('finances_stats', async (ctx) => {
    console.log('ADMIN: Callback finances_stats');
    await ctx.answerCbQuery();
    await statsCommands.showFinanceStats(ctx);
  });

  bot.action('users_stats', async (ctx) => {
    console.log('ADMIN: Callback users_stats');
    await ctx.answerCbQuery();
    await usersCommands.showUsersStats(ctx);
  });

  bot.action('finances_games', async (ctx) => {
    console.log('ADMIN: Callback finances_games');
    await ctx.answerCbQuery();
    await statsCommands.showGameStats(ctx);
  });

  bot.action('stats_commission', async (ctx) => {
    console.log('ADMIN: Callback stats_commission');
    await ctx.answerCbQuery();
    await statsCommands.showCommissionStats(ctx);
  });

  // === ПОЛЬЗОВАТЕЛИ ===

  bot.action('users_menu', async (ctx) => {
    console.log('ADMIN: Callback users_menu');
    await ctx.answerCbQuery();
    await usersCommands.showUsersMenu(ctx);
  });

  bot.action('users_list', async (ctx) => {
    console.log('ADMIN: Callback users_list');
    await ctx.answerCbQuery();
    await usersCommands.showUsersList(ctx, 1);
  });

  // Пагинация списка пользователей
  bot.action(/users_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback users_list_${page}`);
    await ctx.answerCbQuery();
    await usersCommands.showUsersList(ctx, page);
  });

  bot.action('users_search', async (ctx) => {
    console.log('ADMIN: Callback users_search');
    await ctx.answerCbQuery();
    await usersCommands.startUserSearch(ctx);
  });

  bot.action('users_search_cancel', async (ctx) => {
    console.log('ADMIN: Callback users_search_cancel');
    await ctx.answerCbQuery();
    if (ctx.session) {
      delete ctx.session.searchingUser;
    }
    
    await ctx.editMessageText(
      '❌ Поиск отменен',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('👥 К пользователям', 'users_menu')]
        ])
      }
    );
  });

  // Детали пользователя
  bot.action(/user_details_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    console.log(`ADMIN: Callback user_details_${userId}`);
    await ctx.answerCbQuery();
    await usersCommands.showUserDetails(ctx, userId);
  });

  // Блокировка/разблокировка пользователя
  bot.action(/user_toggle_block_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    console.log(`ADMIN: Callback user_toggle_block_${userId}`);
    await usersCommands.toggleUserBlock(ctx, userId);
  });

  // Изменение баланса пользователя
  bot.action(/user_balance_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    console.log(`ADMIN: Callback user_balance_${userId}`);
    await ctx.answerCbQuery();
    await usersCommands.startBalanceAdjustment(ctx, userId);
  });

  // === ПАРТНЕРЫ ===

  bot.action('partners_menu', async (ctx) => {
    console.log('ADMIN: Callback partners_menu');
    await ctx.answerCbQuery();
    
    // Очищаем сессию назначения партнеров
    if (ctx.session) {
      delete ctx.session.assigningPartner;
    }
    
    await usersCommands.showPartnersMenu(ctx);
  });

  bot.action('partners_list', async (ctx) => {
    console.log('ADMIN: Callback partners_list');
    await ctx.answerCbQuery();
    await usersCommands.showPartnersList(ctx, 1);
  });

  // Пагинация списка партнеров
  bot.action(/partners_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback partners_list_${page}`);
    await ctx.answerCbQuery();
    await usersCommands.showPartnersList(ctx, page);
  });

  bot.action('partners_assign', async (ctx) => {
    console.log('ADMIN: Callback partners_assign');
    await ctx.answerCbQuery();
    await usersCommands.startPartnerAssignment(ctx);
  });

  bot.action('partners_stats', async (ctx) => {
    console.log('ADMIN: Callback partners_stats');
    await ctx.answerCbQuery();
    await usersCommands.showPartnersStats(ctx);
  });

  bot.action('partners_logs', async (ctx) => {
    console.log('ADMIN: Callback partners_logs');
    await ctx.answerCbQuery();
    await usersCommands.showPartnersLogs(ctx, 1);
  });

  // Пагинация логов партнеров
  bot.action(/partners_logs_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback partners_logs_${page}`);
    await ctx.answerCbQuery();
    await usersCommands.showPartnersLogs(ctx, page);
  });

  bot.action('partners_levels', async (ctx) => {
    console.log('ADMIN: Callback partners_levels');
    await ctx.answerCbQuery();
    await usersCommands.showPartnerLevels(ctx);
  });

  // Обработка выбора партнерского уровня
  bot.action(/assign_(partner_bronze|partner_silver|partner_gold|none)/, async (ctx) => {
    const level = ctx.match[1];
    console.log(`ADMIN: Callback assign_${level}`);
    await usersCommands.handlePartnerLevelSelection(ctx, level);
  });

  // === СОБЫТИЯ ===

  bot.action('events_menu', async (ctx) => {
    console.log('ADMIN: Callback events_menu');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsMenu(ctx);
  });

  bot.action('events_list', async (ctx) => {
    console.log('ADMIN: Callback events_list');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsList(ctx);
  });

  bot.action('events_create', async (ctx) => {
    console.log('ADMIN: Callback events_create');
    await ctx.answerCbQuery();
    await eventsCommands.startEventCreation(ctx);
  });

  bot.action('events_finish', async (ctx) => {
    console.log('ADMIN: Callback events_finish');
    await ctx.answerCbQuery();
    await eventsCommands.finishEvent(ctx);
  });

  bot.action('events_stats', async (ctx) => {
    console.log('ADMIN: Callback events_stats');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsStats(ctx);
  });

  // Выбор категории события
  bot.action(/event_category_(.+)/, async (ctx) => {
    const category = ctx.match[1];
    console.log(`ADMIN: Callback event_category_${category}`);
    await eventsCommands.handleCategorySelection(ctx, category);
  });

  // Завершение события с выбором исхода
  bot.action(/finish_outcome_(.+)/, async (ctx) => {
    const outcomeId = ctx.match[1];
    console.log(`ADMIN: Callback finish_outcome_${outcomeId}`);
    await eventsCommands.completeEventFinishing(ctx, outcomeId);
  });

  // === ТРАНЗАКЦИИ ===

  bot.action('transactions_menu', async (ctx) => {
    console.log('ADMIN: Callback transactions_menu');
    await ctx.answerCbQuery();
    
    const message = '💳 *Управление транзакциями*\n\nВыберите действие:';
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('⏳ Ожидающие одобрения', 'transactions_pending'),
          Markup.button.callback('📋 История транзакций', 'transactions_history')
        ],
        [
          Markup.button.callback('📊 Статистика транзакций', 'transactions_stats'),
          Markup.button.callback('🏦 Информация о депозитах', 'transactions_deposits')
        ],
        [
          Markup.button.callback('◀️ Главное меню', 'main_menu')
        ]
      ])
    });
  });

  bot.action('transactions_pending', async (ctx) => {
    console.log('ADMIN: Callback transactions_pending');
    await ctx.answerCbQuery();
    await transactionsCommands.showPendingWithdrawals(ctx);
  });

  bot.action('transactions_history', async (ctx) => {
    console.log('ADMIN: Callback transactions_history');
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsHistory(ctx, 1);
  });

  // Пагинация истории транзакций
  bot.action(/transactions_history_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback transactions_history_${page}`);
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsHistory(ctx, page);
  });

  bot.action('transactions_stats', async (ctx) => {
    console.log('ADMIN: Callback transactions_stats');
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsStats(ctx);
  });

  bot.action('transactions_deposits', async (ctx) => {
    console.log('ADMIN: Callback transactions_deposits');
    await ctx.answerCbQuery();
    await transactionsCommands.showDepositsInfo(ctx);
  });

  // Одобрение вывода
  bot.action(/approve_withdrawal_(.+)/, async (ctx) => {
    const withdrawalId = ctx.match[1];
    console.log(`ADMIN: Callback approve_withdrawal_${withdrawalId}`);
    await transactionsCommands.approveWithdrawal(ctx, withdrawalId);
  });

  // Отклонение вывода
  bot.action(/reject_withdrawal_(.+)/, async (ctx) => {
    const withdrawalId = ctx.match[1];
    console.log(`ADMIN: Callback reject_withdrawal_${withdrawalId}`);
    await ctx.answerCbQuery();
    await transactionsCommands.rejectWithdrawal(ctx, withdrawalId);
  });

  // === ПРОМОКОДЫ ===

  bot.action('promo_menu', async (ctx) => {
    console.log('ADMIN: Callback promo_menu');
    await ctx.answerCbQuery();
    await promoCommands.showPromoMenu(ctx);
  });

  bot.action('promo_create', async (ctx) => {
    console.log('ADMIN: Callback promo_create');
    await ctx.answerCbQuery();
    await promoCommands.startPromoCreation(ctx);
  });

  bot.action('promo_list', async (ctx) => {
    console.log('ADMIN: Callback promo_list');
    await ctx.answerCbQuery();
    await promoCommands.showPromoList(ctx, 1);
  });

  // Пагинация списка промокодов
  bot.action(/promo_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback promo_list_${page}`);
    await ctx.answerCbQuery();
    await promoCommands.showPromoList(ctx, page);
  });

  bot.action('promo_stats', async (ctx) => {
    console.log('ADMIN: Callback promo_stats');
    await ctx.answerCbQuery();
    await promoCommands.showPromoStats(ctx);
  });

  // Выбор типа промокода
  bot.action(/promo_type_(.+)/, async (ctx) => {
    const type = ctx.match[1];
    console.log(`ADMIN: Callback promo_type_${type}`);
    await promoCommands.handlePromoTypeSelection(ctx, type);
  });

  bot.action('promo_cancel', async (ctx) => {
    console.log('ADMIN: Callback promo_cancel');
    await ctx.answerCbQuery();
    
    if (ctx.session) {
      delete ctx.session.creatingPromo;
    }
    
    await ctx.editMessageText(
      '❌ Создание промокода отменено',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🎁 К промокодам', 'promo_menu')]
        ])
      }
    );
  });

  // ========== ФИНАНСОВЫЕ ОБРАБОТЧИКИ ==========

  // Обработчик для кнопки "Финансы"
  bot.action('finances_menu', async (ctx) => {
    try {
      await ctx.editMessageText(
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
              ],
              [
                { text: '🔙 Назад', callback_data: 'main_menu' }
              ]
            ]
          }
        }
      );
    } catch (error) {
      console.error('ADMIN: Ошибка в finances_menu:', error);
      await ctx.reply('❌ Ошибка при загрузке меню финансов');
    }
  });

  // Обработчик для вывода прибыли владельца
  bot.action('finance_withdraw_profit', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      // Сначала получаем текущее состояние финансов
      const response = await apiService.get('/admin/finance/current-state');
      
      if (!response.success) {
        await ctx.reply('❌ Ошибка при получении данных о финансах');
        return;
      }
      
      const finance = response.data;
      const available = finance.balances.availableForWithdrawal;
      
      if (available <= 0) {
        await ctx.editMessageText(
          '💸 *Вывод прибыли владельца*\n\n' +
          '❌ Нет доступной прибыли для вывода.\n\n' +
          `💰 Доступно: *${available.toFixed(2)} USDT*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 Назад к финансам', callback_data: 'finances_menu' }]
              ]
            }
          }
        );
        return;
      }
      
      await ctx.editMessageText(
        '💸 *Вывод прибыли владельца*\n\n' +
        `💰 Доступно для вывода: *${available.toFixed(2)} USDT*\n\n` +
        '📝 Введите сумму для вывода:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `💯 Вывести всё (${available.toFixed(2)})`, callback_data: `withdraw_profit_amount_${available}` }
              ],
              [
                { text: '🔙 Отмена', callback_data: 'finances_menu' }
              ]
            ]
          }
        }
      );
      
      // Устанавливаем состояние сессии
      ctx.session.withdrawingProfit = {
        step: 'amount',
        availableAmount: available
      };
      
    } catch (error) {
      console.error('ADMIN: Ошибка в finance_withdraw_profit:', error);
      await ctx.reply('❌ Ошибка при загрузке данных о выводе прибыли');
    }
  });

  // Обработчик для быстрого вывода всей суммы
  bot.action(/^withdraw_profit_amount_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const amount = parseFloat(ctx.match[1]);
      
      if (!ctx.session.withdrawingProfit) {
        ctx.session.withdrawingProfit = {};
      }
      
      ctx.session.withdrawingProfit.amount = amount;
      ctx.session.withdrawingProfit.step = 'recipient';
      
      await ctx.editMessageText(
        '💸 *Вывод прибыли владельца*\n\n' +
        `💰 Сумма: *${amount.toFixed(2)} USDT*\n\n` +
        '📧 Введите адрес получателя (кошелек):',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Отмена', callback_data: 'finances_menu' }]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка в withdraw_profit_amount:', error);
      await ctx.reply('❌ Ошибка при обработке суммы');
    }
  });

  console.log('✅ Callback handlers зарегистрированы');
}

module.exports = registerCallbackHandlers;