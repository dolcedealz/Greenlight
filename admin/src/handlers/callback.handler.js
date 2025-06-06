// admin/src/handlers/callback.handler.js
const { Markup } = require('telegraf');

// Import command modules
const statsCommands = require('../commands/stats.command');
const usersCommands = require('../commands/users.command');
const eventsCommands = require('../commands/events.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');

/**
 *  538AB@8@C5B 2A5 callback handlers 4;O 04<8=-1>B0
 * @param {Object} bot - -:75<?;O@ Telegraf
 */
function registerCallbackHandlers(bot) {
  console.log('='  538AB@0F8O callback handlers...');

  // === !+ . ===

  // ;02=>5 <5=N
  bot.action('main_menu', async (ctx) => {
    console.log('ADMIN: Callback main_menu');
    await ctx.answerCbQuery();
    
    // G8I05< ;N1K5 0:B82=K5 A5AA88
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
    }
    
    const message = '<� *;02=>5 <5=N 04<8=8AB@0B>@0*\n\nK15@8B5 @0745; 4;O C?@02;5=8O:';
    
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('=� $8=0=AK', 'finances_menu'),
            Markup.button.callback('=e >;L7>20B5;8', 'users_menu')
          ],
          [
            Markup.button.callback('<� "@0=70:F88', 'transactions_menu'),
            Markup.button.callback('=. !>1KB8O', 'events_menu')
          ],
          [
            Markup.button.callback('<� >MDD8F85=BK', 'coefficients_menu'),
            Markup.button.callback('<� @><>:>4K', 'promo_menu')
          ],
          [
            Markup.button.callback('=� 57>?0A=>ABL', 'security_menu'),
            Markup.button.callback('=� >=8B>@8=3', 'monitoring_menu')
          ],
          [
            Markup.button.callback('=� M:0?K', 'backup_menu'),
            Markup.button.callback('=� #254><;5=8O', 'notifications_menu')
          ]
        ])
      });
    } catch (error) {
      // Fallback if edit fails
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('=� $8=0=AK', 'finances_menu'),
            Markup.button.callback('=e >;L7>20B5;8', 'users_menu')
          ],
          [
            Markup.button.callback('<� "@0=70:F88', 'transactions_menu'),
            Markup.button.callback('=. !>1KB8O', 'events_menu')
          ],
          [
            Markup.button.callback('<� >MDD8F85=BK', 'coefficients_menu'),
            Markup.button.callback('<� @><>:>4K', 'promo_menu')
          ]
        ])
      });
    }
  });

  // === !""!" (STATS) ===

  // $8=0=A>20O AB0B8AB8:0
  bot.action('finances_stats', async (ctx) => {
    console.log('ADMIN: Callback finances_stats');
    await ctx.answerCbQuery();
    await statsCommands.showFinanceStats(ctx);
  });

  // !B0B8AB8:0 ?>;L7>20B5;59
  bot.action('users_stats', async (ctx) => {
    console.log('ADMIN: Callback users_stats');
    await ctx.answerCbQuery();
    await statsCommands.showUserStats(ctx);
  });

  // !B0B8AB8:0 83@
  bot.action('finances_games', async (ctx) => {
    console.log('ADMIN: Callback finances_games');
    await ctx.answerCbQuery();
    await statsCommands.showGameStats(ctx);
  });

  // !B0B8AB8:0 :><8AA89
  bot.action('stats_commission', async (ctx) => {
    console.log('ADMIN: Callback stats_commission');
    await ctx.answerCbQuery();
    await statsCommands.showCommissionStats(ctx);
  });

  // === #  ,"/ ===

  // 5=N ?>;L7>20B5;59
  bot.action('users_menu', async (ctx) => {
    console.log('ADMIN: Callback users_menu');
    await ctx.answerCbQuery();
    await showUsersMenu(ctx);
  });

  // !?8A>: ?>;L7>20B5;59
  bot.action('users_list', async (ctx) => {
    console.log('ADMIN: Callback users_list');
    await ctx.answerCbQuery();
    await usersCommands.showUsersList(ctx);
  });

  // 02830F8O ?> AB@0=8F0< ?>;L7>20B5;59
  bot.action(/^users_list_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log('ADMIN: Callback users_list page:', page);
    await ctx.answerCbQuery();
    await usersCommands.showUsersList(ctx, page);
  });

  // >8A: ?>;L7>20B5;59
  bot.action('users_search', async (ctx) => {
    console.log('ADMIN: Callback users_search');
    await ctx.answerCbQuery();
    await usersCommands.startUserSearch(ctx);
  });

  // B<5=0 ?>8A:0 ?>;L7>20B5;59
  bot.action('users_search_cancel', async (ctx) => {
    console.log('ADMIN: Callback users_search_cancel');
    await ctx.answerCbQuery('B<5=5=>');
    if (ctx.session) {
      delete ctx.session.searchingUser;
    }
    await showUsersMenu(ctx);
  });

  // 5B0;8 ?>;L7>20B5;O
  bot.action(/^user_details_(.+)$/, async (ctx) => {
    const userId = ctx.match[1];
    console.log('ADMIN: Callback user_details:', userId);
    await ctx.answerCbQuery();
    await usersCommands.showUserDetails(ctx, userId);
  });

  // ;>:8@>2:0/@071;>:8@>2:0 ?>;L7>20B5;O
  bot.action(/^user_toggle_block_(.+)$/, async (ctx) => {
    const userId = ctx.match[1];
    console.log('ADMIN: Callback user_toggle_block:', userId);
    await usersCommands.toggleUserBlock(ctx, userId);
  });

  // 7<5=5=85 10;0=A0 ?>;L7>20B5;O
  bot.action(/^user_balance_(.+)$/, async (ctx) => {
    const userId = ctx.match[1];
    console.log('ADMIN: Callback user_balance:', userId);
    await ctx.answerCbQuery();
    await usersCommands.startBalanceAdjustment(ctx, userId);
  });

  // === #  !+"/ ===

  // ;02=>5 <5=N A>1KB89
  bot.action('events_menu', async (ctx) => {
    console.log('ADMIN: Callback events_menu');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsMenu(ctx);
  });

  // !?8A>: A>1KB89
  bot.action('events_list', async (ctx) => {
    console.log('ADMIN: Callback events_list');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsList(ctx);
  });

  // !>740=85 A>1KB8O
  bot.action('events_create', async (ctx) => {
    console.log('ADMIN: Callback events_create');
    await ctx.answerCbQuery();
    await eventsCommands.startEventCreation(ctx);
  });

  // 025@H5=85 A>1KB8O
  bot.action('events_finish', async (ctx) => {
    console.log('ADMIN: Callback events_finish');
    await ctx.answerCbQuery();
    await eventsCommands.finishEvent(ctx);
  });

  // !B0B8AB8:0 A>1KB89
  bot.action('events_stats', async (ctx) => {
    console.log('ADMIN: Callback events_stats');
    await ctx.answerCbQuery();
    await eventsCommands.showEventsStats(ctx);
  });

  // K1>@ :0B53>@88 A>1KB8O
  bot.action(/^event_category_(.+)$/, async (ctx) => {
    const category = ctx.match[1];
    console.log('ADMIN: Callback event_category:', category);
    await eventsCommands.handleCategorySelection(ctx, category);
  });

  // 025@H5=85 A>1KB8O A 2K1>@>< 8AE>40
  bot.action(/^finish_outcome_(.+)$/, async (ctx) => {
    const outcomeId = ctx.match[1];
    console.log('ADMIN: Callback finish_outcome:', outcomeId);
    await ctx.answerCbQuery();
    await eventsCommands.completeEventFinishing(ctx, outcomeId);
  });

  // === #  " &/ ===

  // 5=N B@0=70:F89
  bot.action('transactions_menu', async (ctx) => {
    console.log('ADMIN: Callback transactions_menu');
    await ctx.answerCbQuery();
    await showTransactionsMenu(ctx);
  });

  // 6840NI85 >4>1@5=8O 2K2>4K
  bot.action('transactions_pending', async (ctx) => {
    console.log('ADMIN: Callback transactions_pending');
    await ctx.answerCbQuery();
    await transactionsCommands.showPendingWithdrawals(ctx);
  });

  // 4>1@5=85 2K2>40
  bot.action(/^approve_withdrawal_(.+)$/, async (ctx) => {
    const withdrawalId = ctx.match[1];
    console.log('ADMIN: Callback approve_withdrawal:', withdrawalId);
    await transactionsCommands.approveWithdrawal(ctx, withdrawalId);
  });

  // B:;>=5=85 2K2>40
  bot.action(/^reject_withdrawal_(.+)$/, async (ctx) => {
    const withdrawalId = ctx.match[1];
    console.log('ADMIN: Callback reject_withdrawal:', withdrawalId);
    await ctx.answerCbQuery();
    await transactionsCommands.rejectWithdrawal(ctx, withdrawalId);
  });

  // AB>@8O B@0=70:F89
  bot.action('transactions_history', async (ctx) => {
    console.log('ADMIN: Callback transactions_history');
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsHistory(ctx);
  });

  // 02830F8O ?> 8AB>@88 B@0=70:F89
  bot.action(/^transactions_history_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log('ADMIN: Callback transactions_history page:', page);
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsHistory(ctx, page);
  });

  // !B0B8AB8:0 B@0=70:F89
  bot.action('transactions_stats', async (ctx) => {
    console.log('ADMIN: Callback transactions_stats');
    await ctx.answerCbQuery();
    await transactionsCommands.showTransactionsStats(ctx);
  });

  // =D>@<0F8O > 45?>78B0E
  bot.action('transactions_deposits', async (ctx) => {
    console.log('ADMIN: Callback transactions_deposits');
    await ctx.answerCbQuery();
    await transactionsCommands.showDepositsInfo(ctx);
  });

  // === #    ===

  // ;02=>5 <5=N ?@><>:>4>2
  bot.action('promo_menu', async (ctx) => {
    console.log('ADMIN: Callback promo_menu');
    await ctx.answerCbQuery();
    await promoCommands.showPromoMenu(ctx);
  });

  // !>740=85 ?@><>:>40
  bot.action('promo_create', async (ctx) => {
    console.log('ADMIN: Callback promo_create');
    await ctx.answerCbQuery();
    await promoCommands.startPromoCreation(ctx);
  });

  // !?8A>: ?@><>:>4>2
  bot.action('promo_list', async (ctx) => {
    console.log('ADMIN: Callback promo_list');
    await ctx.answerCbQuery();
    await promoCommands.showPromoList(ctx);
  });

  // 02830F8O ?> AB@0=8F0< ?@><>:>4>2
  bot.action(/^promo_list_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log('ADMIN: Callback promo_list page:', page);
    await ctx.answerCbQuery();
    await promoCommands.showPromoList(ctx, page);
  });

  // !B0B8AB8:0 ?@><>:>4>2
  bot.action('promo_stats', async (ctx) => {
    console.log('ADMIN: Callback promo_stats');
    await ctx.answerCbQuery();
    await promoCommands.showPromoStats(ctx);
  });

  // B<5=0 A>740=8O ?@><>:>40
  bot.action('promo_cancel', async (ctx) => {
    console.log('ADMIN: Callback promo_cancel');
    await ctx.answerCbQuery('B<5=5=>');
    if (ctx.session) {
      delete ctx.session.creatingPromo;
    }
    await promoCommands.showPromoMenu(ctx);
  });

  // K1>@ B8?0 ?@><>:>40
  bot.action(/^promo_type_(balance|freespins|deposit|vip)$/, async (ctx) => {
    const type = ctx.match[1];
    console.log('ADMIN: Callback promo_type:', type);
    await promoCommands.handlePromoTypeSelection(ctx, type);
  });

  // === #( /    +% # ===

  // $8=0=AK
  bot.action('finances_menu', async (ctx) => {
    console.log('ADMIN: Callback finances_menu');
    await ctx.answerCbQuery();
    await showFinancesMenu(ctx);
  });

  // >MDD8F85=BK
  bot.action('coefficients_menu', async (ctx) => {
    console.log('ADMIN: Callback coefficients_menu');
    await ctx.answerCbQuery();
    await showPlaceholderMenu(ctx, '<� #?@02;5=85 :>MDD8F85=B0<8', '>4C;L :>MDD8F85=B>2 =0E>48BAO 2 @07@01>B:5');
  });

  // 57>?0A=>ABL
  bot.action('security_menu', async (ctx) => {
    console.log('ADMIN: Callback security_menu');
    await ctx.answerCbQuery();
    await showPlaceholderMenu(ctx, '=� 57>?0A=>ABL', '>4C;L 157>?0A=>AB8 =0E>48BAO 2 @07@01>B:5');
  });

  // >=8B>@8=3
  bot.action('monitoring_menu', async (ctx) => {
    console.log('ADMIN: Callback monitoring_menu');
    await ctx.answerCbQuery();
    await showPlaceholderMenu(ctx, '=� >=8B>@8=3', '>4C;L <>=8B>@8=30 =0E>48BAO 2 @07@01>B:5');
  });

  // M:0?K
  bot.action('backup_menu', async (ctx) => {
    console.log('ADMIN: Callback backup_menu');
    await ctx.answerCbQuery();
    await showPlaceholderMenu(ctx, '=� M:0?K', '>4C;L 1M:0?>2 =0E>48BAO 2 @07@01>B:5');
  });

  // #254><;5=8O
  bot.action('notifications_menu', async (ctx) => {
    console.log('ADMIN: Callback notifications_menu');
    await ctx.answerCbQuery();
    await showPlaceholderMenu(ctx, '=� #254><;5=8O', '>4C;L C254><;5=89 =0E>48BAO 2 @07@01>B:5');
  });

  console.log(' Callback handlers 70@538AB@8@>20=K CA?5H=>');
}

// === !",+ $#& ===

/**
 * >:070BL <5=N ?>;L7>20B5;59
 */
async function showUsersMenu(ctx) {
  console.log('ADMIN: >:07 <5=N ?>;L7>20B5;59');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('=e !?8A>: ?>;L7>20B5;59', 'users_list')],
    [Markup.button.callback('= >8A: ?>;L7>20B5;O', 'users_search')],
    [Markup.button.callback('=� !B0B8AB8:0 ?>;L7>20B5;59', 'users_stats')],
    [Markup.button.callback('=� 01;>:8@>20==K5', 'users_blocked')],
    [Markup.button.callback('� ;02=>5 <5=N', 'main_menu')]
  ]);

  const message = '=e *#?@02;5=85 ?>;L7>20B5;O<8*\n\nK15@8B5 459AB285:';
  
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    console.error('ADMIN: H81:0 ?>:070 <5=N ?>;L7>20B5;59:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * >:070BL <5=N B@0=70:F89
 */
async function showTransactionsMenu(ctx) {
  console.log('ADMIN: >:07 <5=N B@0=70:F89');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('� 6840NI85 >4>1@5=8O', 'transactions_pending')],
    [Markup.button.callback('=� AB>@8O B@0=70:F89', 'transactions_history')],
    [Markup.button.callback('=� !B0B8AB8:0 2K2>4>2', 'transactions_stats')],
    [Markup.button.callback('<� 5?>78BK', 'transactions_deposits')],
    [Markup.button.callback('� ;02=>5 <5=N', 'main_menu')]
  ]);

  const message = '<� *#?@02;5=85 B@0=70:F8O<8*\n\nK15@8B5 @0745;:';
  
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    console.error('ADMIN: H81:0 ?>:070 <5=N B@0=70:F89:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * >:070BL <5=N D8=0=A>2
 */
async function showFinancesMenu(ctx) {
  console.log('ADMIN: >:07 <5=N D8=0=A>2');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('=� "5:CI55 A>AB>O=85', 'finances_stats')],
    [Markup.button.callback('=� BG5B 70 ?5@8>4', 'finances_report')],
    [Markup.button.callback('<� !B0B8AB8:0 ?> 83@0<', 'finances_games')],
    [Markup.button.callback('=� 0;0=A :078=>', 'finances_balance')],
    [Markup.button.callback('� ;02=>5 <5=N', 'main_menu')]
  ]);

  const message = '=� *$8=0=A>2>5 C?@02;5=85*\n\nK15@8B5 @0745; 4;O ?@>A<>B@0:';
  
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    console.error('ADMIN: H81:0 ?>:070 <5=N D8=0=A>2:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * >:070BL 703;CH:C 4;O =53>B>2KE <>4C;59
 */
async function showPlaceholderMenu(ctx, title, description) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('� ;02=>5 <5=N', 'main_menu')]
  ]);

  const message = `${title}\n\n� ${description}\n\n5@=8B5AL 2 3;02=>5 <5=N 4;O 4>ABC?0 : 4@C38< DC=:F8O<.`;
  
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  } catch (error) {
    console.error('ADMIN: H81:0 ?>:070 703;CH:8:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }

  // === ОБРАБОТЧИКИ КЛАВИАТУРЫ (bot.hears) ===
  
  // Обработка кнопок клавиатуры
  bot.hears('📊 Финансы', async (ctx) => {
    console.log('ADMIN: Кнопка "Финансы"');
    await showFinancesMenu(ctx);
  });

  bot.hears('👥 Пользователи', async (ctx) => {
    console.log('ADMIN: Кнопка "Пользователи"');
    await showUsersMenu(ctx);
  });

  bot.hears('🏦 Транзакции', async (ctx) => {
    console.log('ADMIN: Кнопка "Транзакции"');
    await showTransactionsMenu(ctx);
  });

  bot.hears('🔮 События', async (ctx) => {
    console.log('ADMIN: Кнопка "События"');
    await eventsCommands.showEventsMenu(ctx);
  });

  bot.hears('🎯 Коэффициенты', async (ctx) => {
    console.log('ADMIN: Кнопка "Коэффициенты"');
    await showPlaceholderMenu(ctx, '🎯 Коэффициенты', 'Модуль коэффициентов находится в разработке');
  });

  bot.hears('🎁 Промокоды', async (ctx) => {
    console.log('ADMIN: Кнопка "Промокоды"');
    await promoCommands.showPromoMenu(ctx);
  });

  bot.hears('🛡️ Безопасность', async (ctx) => {
    console.log('ADMIN: Кнопка "Безопасность"');
    await showPlaceholderMenu(ctx, '🛡️ Безопасность', 'Модуль безопасности находится в разработке');
  });

  bot.hears('📊 Мониторинг', async (ctx) => {
    console.log('ADMIN: Кнопка "Мониторинг"');
    await showPlaceholderMenu(ctx, '📊 Мониторинг', 'Модуль мониторинга находится в разработке');
  });

  bot.hears('💾 Бэкапы', async (ctx) => {
    console.log('ADMIN: Кнопка "Бэкапы"');
    await showPlaceholderMenu(ctx, '💾 Бэкапы', 'Модуль бэкапов находится в разработке');
  });

  bot.hears('📢 Уведомления', async (ctx) => {
    console.log('ADMIN: Кнопка "Уведомления"');
    await showPlaceholderMenu(ctx, '📢 Уведомления', 'Модуль уведомлений находится в разработке');
  });

  bot.hears('⚙️ Настройки', async (ctx) => {
    console.log('ADMIN: Кнопка "Настройки"');
    await showPlaceholderMenu(ctx, '⚙️ Настройки', 'Модуль настроек находится в разработке');
  });

  console.log('✅ Callback handlers и keyboard handlers зарегистрированы успешно');
}

module.exports = {
  registerCallbackHandlers
};