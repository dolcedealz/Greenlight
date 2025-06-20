// admin/src/handlers/callback.handler.js
const { Markup } = require('telegraf');
const axios = require('axios');

// API настройки
const apiUrl = process.env.API_URL || 'https://api.greenlight-casino.eu/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Создаем axios instance с предустановленными заголовками
const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * Отправка ручного напоминания
 */
async function sendManualReminder(ctx, giveawayId, target) {
  try {
    const response = await apiClient.post(`/admin/giveaways/${giveawayId}/remind`, {
      target: target // 'bot', 'channel', 'both'
    });

    if (response.data.success) {
      const { sentTo } = response.data.data;
      let message = '✅ *Напоминание отправлено!*\n\n';
      
      if (sentTo.bot) {
        message += `🤖 В боте: ${sentTo.bot} пользователей\n`;
      }
      if (sentTo.channel) {
        message += `📢 В канале: опубликовано\n`;
      }
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 К розыгрышу', callback_data: `giveaway_details_${giveawayId}` }]
          ]
        }
      });
    } else {
      await ctx.reply(`❌ Ошибка: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка отправки напоминания:', error);
    await ctx.reply('❌ Ошибка при отправке напоминания');
  }
}

// Import command modules
const statsCommands = require('../commands/stats.command');
const usersCommands = require('../commands/users.command');
const eventsCommands = require('../commands/events.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');
const coefficientsCommands = require('../commands/coefficients.command');
const giveawaysCommands = require('../commands/giveaways.command');
// Импортируем команды мониторинга с обработкой ошибок
let monitoringCommands;
try {
  monitoringCommands = require('../commands/monitoring.command');
} catch (e) {
  console.warn('monitoring.command module not found, using fallback');
  monitoringCommands = {
    showMonitoringMenu: async (ctx) => await ctx.reply('❌ Модуль мониторинга временно недоступен'),
    checkBalances: async (ctx) => await ctx.reply('❌ Функция проверки балансов временно недоступна'),
    showMonitoringStats: async (ctx) => await ctx.reply('❌ Функция статистики мониторинга временно недоступна'),
    showMonitoringNotifications: async (ctx) => await ctx.reply('❌ Функция уведомлений мониторинга временно недоступна'),
    getCryptoBotBalance: async (ctx) => await ctx.reply('❌ Функция баланса CryptoBot временно недоступна'),
    getSystemBalance: async (ctx) => await ctx.reply('❌ Функция системного баланса временно недоступна'),
    startMonitoring: async (ctx) => await ctx.reply('❌ Функция запуска мониторинга временно недоступна'),
    stopMonitoring: async (ctx) => await ctx.reply('❌ Функция остановки мониторинга временно недоступна')
  };
}

let notificationsCommands;
try {
  notificationsCommands = require('../commands/notifications.command');
} catch (e) {
  console.warn('notifications.command module not found, using fallback');
  notificationsCommands = {
    showNotificationsMenu: async (ctx) => await ctx.reply('❌ Модуль уведомлений временно недоступен')
  };
}

let securityCommands;
try {
  securityCommands = require('../commands/security.command');
} catch (e) {
  console.warn('security.command module not found, using fallback');
  securityCommands = {
    showSecurityMenu: async (ctx) => await ctx.reply('❌ Модуль безопасности временно недоступен')
  };
}

let backupCommands;
try {
  backupCommands = require('../commands/backup.command');
} catch (e) {
  console.warn('backup.command module not found, using fallback');
  backupCommands = {
    showBackupMenu: async (ctx) => await ctx.reply('❌ Модуль бэкапов временно недоступен')
  };
}

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
          ],
          [
            Markup.button.callback('🎮 Коэффициенты', 'coefficients_menu'),
            Markup.button.callback('🎁 Розыгрыши', 'giveaways_menu')
          ],
          [
            Markup.button.callback('📊 Мониторинг', 'monitoring_menu'),
            Markup.button.callback('📢 Уведомления', 'notifications_menu')
          ],
          [
            Markup.button.callback('🛡️ Безопасность', 'security_menu'),
            Markup.button.callback('💾 Бэкапы', 'backup_menu')
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
          ],
          [
            Markup.button.callback('🎮 Коэффициенты', 'coefficients_menu'),
            Markup.button.callback('🎁 Розыгрыши', 'giveaways_menu')
          ],
          [
            Markup.button.callback('📊 Мониторинг', 'monitoring_menu'),
            Markup.button.callback('📢 Уведомления', 'notifications_menu')
          ],
          [
            Markup.button.callback('🛡️ Безопасность', 'security_menu'),
            Markup.button.callback('💾 Бэкапы', 'backup_menu')
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

  bot.action('users_blocked', async (ctx) => {
    console.log('ADMIN: Callback users_blocked');
    await ctx.answerCbQuery();
    await usersCommands.showBlockedUsers(ctx, 1);
  });

  // Пагинация для заблокированных пользователей
  bot.action(/users_blocked_(\\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback users_blocked_${page}`);
    await ctx.answerCbQuery();
    await usersCommands.showBlockedUsers(ctx, page);
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
    
    // Очищаем все сессии событий при возврате в меню
    if (ctx.session) {
      delete ctx.session.creatingEvent;
      delete ctx.session.finishingEvent;
    }
    
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

  bot.action('events_featured', async (ctx) => {
    console.log('ADMIN: Callback events_featured');
    await ctx.answerCbQuery();
    await eventsCommands.manageFeaturedEvent(ctx);
  });

  // Установка главного события
  bot.action(/set_featured_(.+)/, async (ctx) => {
    const eventId = ctx.match[1];
    console.log(`ADMIN: Callback set_featured_${eventId}`);
    await eventsCommands.setFeaturedEvent(ctx, eventId);
  });

  // Снятие главного события
  bot.action('unset_featured', async (ctx) => {
    console.log('ADMIN: Callback unset_featured');
    await ctx.answerCbQuery();
    await eventsCommands.unsetFeaturedEvent(ctx);
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

  // === РОЗЫГРЫШИ ===

  bot.action('giveaways_menu', async (ctx) => {
    console.log('ADMIN: Callback giveaways_menu');
    await ctx.answerCbQuery();
    await giveawaysCommands.showGiveawaysMenu(ctx);
  });

  bot.action('giveaways_current', async (ctx) => {
    console.log('ADMIN: Callback giveaways_current');
    await ctx.answerCbQuery();
    await giveawaysCommands.showCurrentGiveaways(ctx);
  });

  bot.action('giveaways_history', async (ctx) => {
    console.log('ADMIN: Callback giveaways_history');
    await ctx.answerCbQuery();
    await ctx.reply('🏆 История розыгрышей в разработке');
  });

  bot.action('giveaways_create', async (ctx) => {
    console.log('ADMIN: Callback giveaways_create');
    await ctx.answerCbQuery();
    await giveawaysCommands.startGiveawayCreation(ctx);
  });

  bot.action('giveaways_prizes', async (ctx) => {
    console.log('ADMIN: Callback giveaways_prizes');
    await ctx.answerCbQuery();
    await giveawaysCommands.showPrizesManagement(ctx);
  });

  bot.action('giveaways_stats', async (ctx) => {
    console.log('ADMIN: Callback giveaways_stats');
    await ctx.answerCbQuery();
    await giveawaysCommands.showGiveawaysStats(ctx);
  });

  bot.action('giveaways_manage', async (ctx) => {
    console.log('ADMIN: Callback giveaways_manage');
    await ctx.answerCbQuery();
    await giveawaysCommands.showGiveawayManagement(ctx);
  });

  bot.action('giveaways_settings', async (ctx) => {
    console.log('ADMIN: Callback giveaways_settings');
    await ctx.answerCbQuery();
    await ctx.reply('⚙️ Настройки розыгрышей в разработке');
  });

  bot.action('giveaways_add_prize', async (ctx) => {
    console.log('ADMIN: Callback giveaways_add_prize');
    await ctx.answerCbQuery();
    await giveawaysCommands.startPrizeCreation(ctx);
  });

  // Создание приза из URL
  bot.action('create_prize_from_url', async (ctx) => {
    console.log('ADMIN: Callback create_prize_from_url');
    await ctx.answerCbQuery();
    await giveawaysCommands.startPrizeCreationFromUrl(ctx);
  });

  // Создание приза вручную
  bot.action('create_prize_manual', async (ctx) => {
    console.log('ADMIN: Callback create_prize_manual');
    await ctx.answerCbQuery();
    await giveawaysCommands.startPrizeCreationManual(ctx);
  });

  // Предпросмотр подарка - принять
  bot.action('gift_preview_accept', async (ctx) => {
    console.log('ADMIN: Callback gift_preview_accept');
    await ctx.answerCbQuery();
    await ctx.reply('💰 Введите ценность приза в USDT:');
    if (ctx.session?.creatingPrizeFromUrl) {
      ctx.session.creatingPrizeFromUrl.step = 'value';
    }
  });

  // Предпросмотр подарка - отмена
  bot.action('gift_preview_cancel', async (ctx) => {
    console.log('ADMIN: Callback gift_preview_cancel');
    await ctx.answerCbQuery();
    delete ctx.session.creatingPrizeFromUrl;
    await ctx.reply(
      '❌ Создание приза отменено',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 К призам', callback_data: 'giveaways_prizes' }]
          ]
        }
      }
    );
  });

  // Выбор типа приза
  bot.action(/prize_type_(.+)/, async (ctx) => {
    const type = ctx.match[1];
    console.log(`ADMIN: Callback prize_type_${type}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.finalizePrizeCreation(ctx, type);
  });

  // Выбор типа розыгрыша
  bot.action(/giveaway_type_(.+)/, async (ctx) => {
    const type = ctx.match[1];
    console.log(`ADMIN: Callback giveaway_type_${type}`);
    await ctx.answerCbQuery();
    
    if (!ctx.session?.creatingGiveaway) {
      await ctx.reply('❌ Сессия создания розыгрыша не найдена');
      return;
    }
    
    ctx.session.creatingGiveaway.type = type;
    
    if (type === 'custom') {
      ctx.session.creatingGiveaway.step = 'customDate';
      await ctx.editMessageText(
        `🎯 *Создание розыгрыша: ${ctx.session.creatingGiveaway.title}*\n\n` +
        `📅 Тип: Кастомный\n\n` +
        'Введите дату и время розыгрыша в формате:\n' +
        '`ДД.ММ.ГГГГ ЧЧ:ММ`\n\n' +
        'Например: `15.06.2025 20:00`',
        { parse_mode: 'Markdown' }
      );
    } else {
      ctx.session.creatingGiveaway.step = 'winnersCount';
      const typeText = type === 'daily' ? 'ежедневный' : type === 'weekly' ? 'недельный' : 'кастомный';
      await ctx.editMessageText(
        `🎯 *Создание розыгрыша: ${ctx.session.creatingGiveaway.title}*\n\n` +
        `Тип: ${typeText}\n\n` +
        'Введите количество победителей (от 1 до 10):',
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Выбор приза для розыгрыша
  bot.action(/select_prize_(.+)/, async (ctx) => {
    const prizeId = ctx.match[1];
    console.log(`ADMIN: Callback select_prize_${prizeId}`);
    await ctx.answerCbQuery();
    
    if (!ctx.session?.creatingGiveaway) {
      await ctx.reply('❌ Сессия создания розыгрыша не найдена');
      return;
    }
    
    const prize = ctx.session.creatingGiveaway.availablePrizes.find(p => p._id === prizeId);
    if (!prize) {
      await ctx.reply('❌ Приз не найден');
      return;
    }
    
    try {
      // Создаем розыгрыш
      const giveawayData = {
        title: ctx.session.creatingGiveaway.title,
        type: ctx.session.creatingGiveaway.type,
        winnersCount: ctx.session.creatingGiveaway.winnersCount,
        prizeId: prizeId,
        minDepositAmount: ctx.session.creatingGiveaway.minDeposit || 1
      };

      // Добавляем кастомные даты если тип custom
      if (ctx.session.creatingGiveaway.type === 'custom' && ctx.session.creatingGiveaway.customDrawDate) {
        const drawDate = ctx.session.creatingGiveaway.customDrawDate;
        giveawayData.startDate = new Date().toISOString();
        giveawayData.endDate = new Date(drawDate.getTime() - 60 * 60 * 1000).toISOString(); // За час до розыгрыша
        giveawayData.drawDate = drawDate.toISOString();
      }

      const response = await apiClient.post('/admin/giveaways', giveawayData);
      
      if (response.data.success) {
        const typeText = giveawayData.type === 'daily' ? 'Ежедневный' : 
                        giveawayData.type === 'weekly' ? 'Недельный' : 'Кастомный';
        
        let message = `✅ *Розыгрыш успешно создан!*\n\n` +
                     `🎯 Название: ${giveawayData.title}\n` +
                     `📅 Тип: ${typeText}\n` +
                     `🏆 Победителей: ${giveawayData.winnersCount}\n` +
                     `🎁 Приз: ${prize.name}\n` +
                     `💰 Минимальный депозит: ${giveawayData.minDepositAmount} USDT\n`;
        
        if (giveawayData.type === 'custom') {
          const drawTime = new Date(giveawayData.drawDate).toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow'
          });
          message += `⏰ Время: ${drawTime} МСК\n`;
        }
        
        message += `\nРозыгрыш будет автоматически активирован в назначенное время.`;
        
        await ctx.editMessageText(message,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎁 К розыгрышам', callback_data: 'giveaways_menu' }],
                [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      } else {
        throw new Error(response.data.message || 'Ошибка создания розыгрыша');
      }

      delete ctx.session.creatingGiveaway;
    } catch (error) {
      console.error('ADMIN: Ошибка создания розыгрыша:', error);
      await ctx.reply(
        `❌ Ошибка создания розыгрыша: ${error.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
            ]
          }
        }
      );
      delete ctx.session.creatingGiveaway;
    }
  });

  // Управление конкретным розыгрышем
  bot.action(/manage_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback manage_giveaway_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.showGiveawayDetails(ctx, giveawayId);
  });

  // Активация розыгрыша
  bot.action(/activate_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback activate_giveaway_${giveawayId}`);
    await giveawaysCommands.activateGiveaway(ctx, giveawayId);
  });

  // Отмена розыгрыша
  bot.action(/cancel_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback cancel_giveaway_${giveawayId}`);
    await giveawaysCommands.cancelGiveaway(ctx, giveawayId);
  });

  // Проведение розыгрыша
  bot.action(/conduct_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback conduct_giveaway_${giveawayId}`);
    await giveawaysCommands.conductGiveaway(ctx, giveawayId);
  });

  // Редактирование времени розыгрыша
  bot.action(/edit_time_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback edit_time_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.editGiveawayTime(ctx, giveawayId);
  });

  // Редактирование розыгрыша
  bot.action(/edit_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback edit_giveaway_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.editGiveaway(ctx, giveawayId);
  });

  // Просмотр участников
  bot.action(/view_participants_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback view_participants_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.viewParticipants(ctx, giveawayId);
  });

  // Пагинация участников
  bot.action(/participants_(.+)_(\d+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    const page = parseInt(ctx.match[2]);
    await ctx.answerCbQuery();
    await giveawaysCommands.viewParticipants(ctx, giveawayId, page);
  });

  // Редактирование отдельных полей
  bot.action(/edit_winners_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback edit_winners_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.startEditField(ctx, giveawayId, 'winnersCount');
  });

  bot.action(/edit_deposit_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback edit_deposit_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.startEditField(ctx, giveawayId, 'minDepositAmount');
  });

  bot.action(/edit_title_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback edit_title_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.startEditField(ctx, giveawayId, 'title');
  });

  // ========== ОБРАБОТЧИКИ НАПОМИНАНИЙ ==========

  // Главное меню напоминаний
  bot.action('giveaways_reminders', async (ctx) => {
    console.log('ADMIN: Callback giveaways_reminders');
    await ctx.answerCbQuery();
    await giveawaysCommands.showReminderSettings(ctx);
  });

  // Напоминание о розыгрыше
  bot.action(/remind_giveaway_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback remind_giveaway_${giveawayId}`);
    await ctx.answerCbQuery();
    await giveawaysCommands.sendGiveawayReminder(ctx, giveawayId);
  });

  // Отправка напоминаний
  bot.action(/remind_bot_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback remind_bot_${giveawayId}`);
    await ctx.answerCbQuery();
    await sendManualReminder(ctx, giveawayId, 'bot');
  });

  bot.action(/remind_channel_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback remind_channel_${giveawayId}`);
    await ctx.answerCbQuery();
    await sendManualReminder(ctx, giveawayId, 'channel');
  });

  bot.action(/remind_both_(.+)/, async (ctx) => {
    const giveawayId = ctx.match[1];
    console.log(`ADMIN: Callback remind_both_${giveawayId}`);
    await ctx.answerCbQuery();
    await sendManualReminder(ctx, giveawayId, 'both');
  });

  // Настройки напоминаний
  bot.action('reminder_auto_settings', async (ctx) => {
    console.log('ADMIN: Callback reminder_auto_settings');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `⚙️ *Настройки автоматических напоминаний*\n\n` +
      `Текущие настройки:\n` +
      `┣ ⏰ Интервал: каждый час\n` +
      `┣ 📅 Время: за 2 часа до окончания\n` +
      `┣ 📢 Канал: Telegram канал\n` +
      `┗ 🔄 Статус: активно\n\n` +
      `Настройки задаются через переменные окружения на сервере.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_reminders' }]
          ]
        }
      }
    );
  });

  bot.action('reminder_stats', async (ctx) => {
    console.log('ADMIN: Callback reminder_stats');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `📊 *Статистика напоминаний*\n\n` +
      `За последние 24 часа:\n` +
      `┣ 📤 Отправлено автоматических: 0\n` +
      `┣ 📢 Отправлено ручных: 0\n` +
      `┣ ✅ Успешных: 0\n` +
      `┗ ❌ Ошибок: 0\n\n` +
      `_Статистика ведется с момента последнего перезапуска сервера._`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_reminders' }]
          ]
        }
      }
    );
  });

  bot.action('reminder_restart_jobs', async (ctx) => {
    console.log('ADMIN: Callback reminder_restart_jobs');
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🔄 *Перезапуск задач напоминаний*\n\n` +
      `⚠️ Эта функция перезапускает все cron-задачи розыгрышей на сервере.\n\n` +
      `Включает:\n` +
      `┣ 📅 Напоминания\n` +
      `┣ 🎯 Проведение розыгрышей\n` +
      `┣ 🧹 Очистка данных\n` +
      `┗ 🆕 Создание автоматических розыгрышей\n\n` +
      `❗ Функция доступна только через API сервера.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_reminders' }]
          ]
        }
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
      const response = await apiClient.get('/admin/finance/state');
      
      if (!response.data.success) {
        await ctx.reply('❌ Ошибка при получении данных о финансах');
        return;
      }
      
      const finance = response.data.data;
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

  // Обработчик для текущего состояния финансов
  bot.action('finance_current_state', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const response = await apiClient.get('/admin/finance/state');
      
      if (!response.data.success) {
        await ctx.reply('❌ Ошибка при получении данных о финансах');
        return;
      }
      
      const finance = response.data.data;
      let message = '📊 *Текущее состояние финансов*\n\n';
      message += `💰 Баланс пользователей: ${finance.balances.totalUsers.toFixed(2)} USDT\n`;
      message += `🏦 Оперативный баланс: ${finance.balances.operational.toFixed(2)} USDT\n`;
      message += `🔒 Резерв: ${finance.balances.reserve.toFixed(2)} USDT\n`;
      message += `✅ Доступно для вывода: ${finance.balances.availableForWithdrawal.toFixed(2)} USDT\n\n`;
      message += `📈 Всего ставок: ${finance.statistics.totalBets.toFixed(2)} USDT\n`;
      message += `📉 Всего выплат: ${finance.statistics.totalWins.toFixed(2)} USDT\n`;
      message += `💰 Общие комиссии: ${finance.statistics.totalCommissions.toFixed(2)} USDT`;
      
      try {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Обновить', 'finance_current_state')],
            [Markup.button.callback('🔙 К финансам', 'finances_menu')]
          ])
        });
      } catch (editError) {
        if (editError.description && editError.description.includes('message is not modified')) {
          await ctx.answerCbQuery('📊 Данные актуальны');
        } else {
          throw editError;
        }
      }
    } catch (error) {
      console.error('ADMIN: Ошибка получения состояния финансов:', error);
      await ctx.reply('❌ Ошибка получения состояния финансов');
    }
  });

  // Обработчик для финансового отчета
  bot.action('finance_report', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const response = await apiClient.get('/admin/finance/report');
      
      if (!response.data.success) {
        await ctx.reply('❌ Ошибка при получении отчета');
        return;
      }
      
      const report = response.data.data;
      let message = '📈 *Финансовый отчет*\n\n';
      message += `💰 Общий баланс: ${report.current.totalUserBalance.toFixed(2)} USDT\n`;
      message += `🏦 Оперативный: ${report.current.operationalBalance.toFixed(2)} USDT\n`;
      message += `💰 Комиссии: ${report.current.totalCommissions.toFixed(2)} USDT\n`;
      message += `📊 Промокоды: ${report.current.totalPromocodeExpenses.toFixed(2)} USDT`;
      
      try {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Обновить', 'finance_report')],
            [Markup.button.callback('🔙 К финансам', 'finances_menu')]
          ])
        });
      } catch (editError) {
        if (editError.description && editError.description.includes('message is not modified')) {
          await ctx.answerCbQuery('📊 Данные актуальны');
        } else {
          throw editError;
        }
      }
    } catch (error) {
      console.error('ADMIN: Ошибка получения отчета:', error);
      await ctx.reply('❌ Ошибка получения финансового отчета');
    }
  });

  // Обработчик для пересчета финансов
  bot.action('finance_recalculate', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText('🔄 Пересчитываем финансы...', {
        ...Markup.inlineKeyboard([])
      });
      
      const response = await apiClient.post('/admin/finance/recalculate');
      
      if (!response.data.success) {
        await ctx.editMessageText('❌ Ошибка при пересчете финансов');
        return;
      }
      
      await ctx.editMessageText('✅ Финансы успешно пересчитаны!', {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📊 Текущее состояние', 'finance_current_state')],
          [Markup.button.callback('🔙 К финансам', 'finances_menu')]
        ])
      });
    } catch (error) {
      console.error('ADMIN: Ошибка пересчета финансов:', error);
      await ctx.editMessageText('❌ Ошибка пересчета финансов');
    }
  });

  // Обработчик для статистики игр
  bot.action('finance_game_stats', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const response = await apiClient.get('/admin/finance/game-stats');
      
      if (!response.data.success) {
        await ctx.reply('❌ Ошибка при получении статистики игр');
        return;
      }
      
      const stats = response.data.data;
      let message = '🎮 *Статистика игр*\n\n';
      
      if (stats.games) {
        Object.entries(stats.games).forEach(([game, data]) => {
          const gameNames = {
            coin: '🪙 Монетка',
            crash: '🚀 Краш', 
            slots: '🎰 Слоты',
            mines: '💣 Мины'
          };
          message += `${gameNames[game] || game}:\n`;
          message += `  Ставки: ${data.totalBets.toFixed(2)} USDT\n`;
          message += `  Выплаты: ${data.totalWins.toFixed(2)} USDT\n`;
          message += `  Прибыль: ${data.profit.toFixed(2)} USDT\n\n`;
        });
      }
      
      try {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Обновить', 'finance_game_stats')],
            [Markup.button.callback('🔙 К финансам', 'finances_menu')]
          ])
        });
      } catch (editError) {
        if (editError.description && editError.description.includes('message is not modified')) {
          // Данные не изменились, просто отвечаем на callback
          await ctx.answerCbQuery('📊 Данные актуальны');
        } else {
          throw editError;
        }
      }
    } catch (error) {
      console.error('ADMIN: Ошибка получения статистики игр:', error);
      await ctx.reply('❌ Ошибка получения статистики игр');
    }
  });

  // Обработчик для истории балансов
  bot.action('finance_balance_history', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const response = await apiClient.get('/admin/finance/history', {
        params: { limit: 20 }
      });
      
      if (!response.data.success) {
        await ctx.reply('❌ Ошибка при получении истории');
        return;
      }
      
      const history = response.data.data.history;
      
      if (history.length === 0) {
        await ctx.editMessageText('📝 *История балансов*\n\nИстория пуста', {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 К финансам', 'finances_menu')]
          ])
        });
        return;
      }

      // Создаем CSV содержимое для Excel
      let csvContent = 'Дата,Событие,Баланс (USDT),Детали\n';
      
      history.forEach((record) => {
        const date = new Date(record.timestamp).toLocaleString('ru-RU');
        const eventNames = {
          'full_recalculation': 'Полный пересчет',
          'duel_commission': 'Комиссия с дуэли',
          'game_win': 'Выигрыш в игре',
          'game_loss': 'Проигрыш в игре',
          'deposit': 'Депозит',
          'user_withdrawal': 'Вывод пользователя',
          'owner_withdrawal': 'Вывод владельца',
          'promocode': 'Промокод'
        };
        
        const eventName = eventNames[record.event] || record.event;
        const details = record.details ? JSON.stringify(record.details).replace(/"/g, '""') : '';
        
        csvContent += `"${date}","${eventName}","${record.operationalBalance.toFixed(2)}","${details}"\n`;
      });

      // Создаем сообщение с последними записями
      let message = '📝 *История балансов*\n\n';
      message += `📊 Последние ${Math.min(history.length, 5)} записей:\n\n`;
      
      history.slice(0, 5).forEach((record, index) => {
        const eventNames = {
          'full_recalculation': 'Полный пересчет',
          'duel_commission': 'Комиссия с дуэли',
          'game_win': 'Выигрыш в игре',
          'game_loss': 'Проигрыш в игре',
          'deposit': 'Депозит',
          'user_withdrawal': 'Вывод пользователя',
          'owner_withdrawal': 'Вывод владельца',
          'promocode': 'Промокод'
        };
        
        const eventName = eventNames[record.event] || record.event;
        const date = new Date(record.timestamp).toLocaleDateString('ru-RU');
        const time = new Date(record.timestamp).toLocaleTimeString('ru-RU');
        
        message += `${index + 1}\\. ${eventName}\n`;
        message += `   💰 ${record.operationalBalance.toFixed(2)} USDT\n`;
        message += `   📅 ${date} ${time}\n\n`;
      });
      
      message += `\n📄 Всего записей: ${history.length}`;

      try {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('📊 Экспорт в Excel', 'finance_export_history'),
              Markup.button.callback('🔄 Обновить', 'finance_balance_history')
            ],
            [Markup.button.callback('🔙 К финансам', 'finances_menu')]
          ])
        });
      } catch (editError) {
        if (editError.description && editError.description.includes('message is not modified')) {
          // Данные не изменились, просто отвечаем на callback
          await ctx.answerCbQuery('📊 Данные актуальны');
        } else {
          throw editError;
        }
      }

      // Сохраняем CSV данные в сессию для экспорта
      ctx.session = ctx.session || {};
      ctx.session.historyCSV = csvContent;
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения истории:', error);
      await ctx.reply('❌ Ошибка получения истории балансов');
    }
  });

  // Обработчик для экспорта истории в Excel
  bot.action('finance_export_history', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      if (!ctx.session || !ctx.session.historyCSV) {
        await ctx.reply('❌ Данные для экспорта не найдены. Обновите историю.');
        return;
      }

      // Создаем Buffer из CSV данных
      const csvBuffer = Buffer.from(ctx.session.historyCSV, 'utf8');
      const fileName = `finance_history_${new Date().toISOString().split('T')[0]}.csv`;

      // Отправляем файл
      await ctx.replyWithDocument({
        source: csvBuffer,
        filename: fileName
      }, {
        caption: `📊 *Экспорт истории балансов*\n\n📅 Дата: ${new Date().toLocaleDateString('ru-RU')}\n📄 Формат: CSV (можно открыть в Excel)`,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('ADMIN: Ошибка экспорта истории:', error);
      await ctx.reply('❌ Ошибка при экспорте данных');
    }
  });

  // Обработчик для настроек резерва
  bot.action('finance_set_reserve', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      ctx.session = ctx.session || {};
      ctx.session.settingReserve = { step: 'percentage' };
      
      await ctx.editMessageText('⚙️ *Настройка резерва*\n\nВведите процент резервирования (от 0 до 100):', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'finances_menu')]
        ])
      });
    } catch (error) {
      console.error('ADMIN: Ошибка настройки резерва:', error);
      await ctx.reply('❌ Ошибка настройки резерва');
    }
  });

  // === КОЭФФИЦИЕНТЫ ===

  bot.action('coefficients_menu', async (ctx) => {
    console.log('ADMIN: Callback coefficients_menu');
    await ctx.answerCbQuery();
    
    const message = '🎯 *Управление коэффициентами*\n\nВыберите тип настроек:';
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🌍 Глобальные настройки', 'coefficients_global'),
          Markup.button.callback('👤 Пользовательские', 'coefficients_users')
        ],
        [
          Markup.button.callback('📊 Статистика модификаторов', 'coefficients_stats'),
          Markup.button.callback('🔄 Сбросить все', 'coefficients_reset')
        ],
        [Markup.button.callback('🔙 Назад', 'main_menu')]
      ])
    });
  });

  bot.action('coefficients_global', async (ctx) => {
    console.log('ADMIN: Callback coefficients_global');
    await ctx.answerCbQuery();
    await coefficientsCommands.showGlobalCoefficients(ctx);
  });

  bot.action('coefficients_users', async (ctx) => {
    console.log('ADMIN: Callback coefficients_users');
    await ctx.answerCbQuery();
    await coefficientsCommands.showUserCoefficients(ctx);
  });

  bot.action('coefficients_stats', async (ctx) => {
    console.log('ADMIN: Callback coefficients_stats');
    await ctx.answerCbQuery();
    await coefficientsCommands.showCoefficientsStats(ctx);
  });

  bot.action('coefficients_reset', async (ctx) => {
    console.log('ADMIN: Callback coefficients_reset');
    await ctx.answerCbQuery();
    await coefficientsCommands.resetAllModifiers(ctx);
  });

  // Обработчики для настройки коэффициентов конкретных игр
  bot.action(/coeff_global_(coin|slots|mines|crash)/, async (ctx) => {
    const gameType = ctx.match[1];
    console.log(`ADMIN: Callback coeff_global_${gameType}`);
    await ctx.answerCbQuery();
    await coefficientsCommands.setupGlobalGameCoefficient(ctx, gameType);
  });

  bot.action('coeff_toggle_mode', async (ctx) => {
    console.log('ADMIN: Callback coeff_toggle_mode');
    await coefficientsCommands.toggleModifierMode(ctx);
  });

  bot.action(/coeff_enable_(true|false)/, async (ctx) => {
    const enabled = ctx.match[1] === 'true';
    console.log(`ADMIN: Callback coeff_enable_${enabled}`);
    await coefficientsCommands.confirmCoefficientSetting(ctx, enabled);
  });

  // === МОНИТОРИНГ ===

  bot.action('monitoring_menu', async (ctx) => {
    console.log('ADMIN: Callback monitoring_menu');
    await ctx.answerCbQuery();
    await monitoringCommands.showMonitoringMenu(ctx);
  });

  bot.action('monitoring_metrics', async (ctx) => {
    console.log('ADMIN: Callback monitoring_metrics');
    await ctx.answerCbQuery();
    await monitoringCommands.showSystemMetrics(ctx);
  });

  bot.action('monitoring_performance', async (ctx) => {
    console.log('ADMIN: Callback monitoring_performance');
    await ctx.answerCbQuery();
    await monitoringCommands.showPerformanceMetrics(ctx);
  });

  bot.action('monitoring_online', async (ctx) => {
    console.log('ADMIN: Callback monitoring_online');
    await ctx.answerCbQuery();
    await monitoringCommands.showOnlineUsers(ctx);
  });

  bot.action('monitoring_financial', async (ctx) => {
    console.log('ADMIN: Callback monitoring_financial');
    await ctx.answerCbQuery();
    await monitoringCommands.showFinancialMonitoring(ctx);
  });

  bot.action('monitoring_alerts', async (ctx) => {
    console.log('ADMIN: Callback monitoring_alerts');
    await ctx.answerCbQuery();
    await monitoringCommands.showActiveAlerts(ctx);
  });

  // === УВЕДОМЛЕНИЯ ===

  bot.action('notifications_menu', async (ctx) => {
    console.log('ADMIN: Callback notifications_menu');
    await ctx.answerCbQuery();
    await notificationsCommands.showNotificationsMenu(ctx);
  });

  bot.action('notifications_create', async (ctx) => {
    console.log('ADMIN: Callback notifications_create');
    await ctx.answerCbQuery();
    await notificationsCommands.startNotificationCreation(ctx);
  });

  bot.action('notifications_history', async (ctx) => {
    console.log('ADMIN: Callback notifications_history');
    await ctx.answerCbQuery();
    await notificationsCommands.showNotificationsHistory(ctx, 1);
  });

  // Пагинация истории уведомлений
  bot.action(/notifications_history_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback notifications_history_${page}`);
    await ctx.answerCbQuery();
    await notificationsCommands.showNotificationsHistory(ctx, page);
  });

  bot.action('notifications_stats', async (ctx) => {
    console.log('ADMIN: Callback notifications_stats');
    await ctx.answerCbQuery();
    await notificationsCommands.showNotificationsStats(ctx);
  });

  // Обработчики для создания уведомлений
  bot.action(/notif_type_(all|active|vip|inactive|segmented|custom)/, async (ctx) => {
    const audienceType = ctx.match[1];
    console.log(`ADMIN: Callback notif_type_${audienceType}`);
    await notificationsCommands.handleAudienceSelection(ctx, audienceType);
  });

  bot.action(/notif_priority_(high|medium|low|normal)/, async (ctx) => {
    const priority = ctx.match[1];
    console.log(`ADMIN: Callback notif_priority_${priority}`);
    await notificationsCommands.handlePrioritySelection(ctx, priority);
  });

  bot.action(/notif_timing_(now|scheduled|ab_test)/, async (ctx) => {
    const timing = ctx.match[1];
    console.log(`ADMIN: Callback notif_timing_${timing}`);
    await notificationsCommands.handleTimingSelection(ctx, timing);
  });

  bot.action('notif_confirm_send', async (ctx) => {
    console.log('ADMIN: Callback notif_confirm_send');
    await notificationsCommands.confirmNotificationSend(ctx);
  });

  bot.action('notifications_cancel', async (ctx) => {
    console.log('ADMIN: Callback notifications_cancel');
    await ctx.answerCbQuery();
    
    if (ctx.session) {
      delete ctx.session.creatingNotification;
    }
    
    await ctx.editMessageText(
      '❌ Создание рассылки отменено',
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📢 К уведомлениям', 'notifications_menu')]
        ])
      }
    );
  });

  // === БЕЗОПАСНОСТЬ ===

  bot.action('security_menu', async (ctx) => {
    console.log('ADMIN: Callback security_menu');
    await ctx.answerCbQuery();
    await securityCommands.showSecurityMenu(ctx);
  });

  bot.action('security_alerts', async (ctx) => {
    console.log('ADMIN: Callback security_alerts');
    await ctx.answerCbQuery();
    await securityCommands.showSecurityAlerts(ctx);
  });

  bot.action('security_audit', async (ctx) => {
    console.log('ADMIN: Callback security_audit');
    await ctx.answerCbQuery();
    await securityCommands.showAuditLog(ctx, 1);
  });

  bot.action('security_suspicious', async (ctx) => {
    console.log('ADMIN: Callback security_suspicious');
    await ctx.answerCbQuery();
    await securityCommands.showSuspiciousActivity(ctx);
  });

  bot.action('security_blocked_ips', async (ctx) => {
    console.log('ADMIN: Callback security_blocked_ips');
    await ctx.answerCbQuery();
    await securityCommands.showBlockedIPs(ctx);
  });

  bot.action('security_settings', async (ctx) => {
    console.log('ADMIN: Callback security_settings');
    await ctx.answerCbQuery();
    await securityCommands.showSecuritySettings(ctx);
  });

  // === БЭКАПЫ ===

  bot.action('backup_menu', async (ctx) => {
    console.log('ADMIN: Callback backup_menu');
    await ctx.answerCbQuery();
    await backupCommands.showBackupMenu(ctx);
  });

  bot.action('backup_create', async (ctx) => {
    console.log('ADMIN: Callback backup_create');
    await ctx.answerCbQuery();
    await backupCommands.createBackup(ctx);
  });

  bot.action('backup_list', async (ctx) => {
    console.log('ADMIN: Callback backup_list');
    await ctx.answerCbQuery();
    await backupCommands.showBackupList(ctx, 1);
  });

  bot.action('backup_stats', async (ctx) => {
    console.log('ADMIN: Callback backup_stats');
    await ctx.answerCbQuery();
    await backupCommands.showBackupStats(ctx);
  });

  bot.action('backup_settings', async (ctx) => {
    console.log('ADMIN: Callback backup_settings');
    await ctx.answerCbQuery();
    await backupCommands.showBackupSettings(ctx);
  });

  bot.action('backup_cleanup', async (ctx) => {
    console.log('ADMIN: Callback backup_cleanup');
    await ctx.answerCbQuery();
    await backupCommands.performBackupCleanup(ctx);
  });

  // Backup type selection handlers
  bot.action(/backup_create_(full|users|financial|games|settings)/, async (ctx) => {
    const backupType = ctx.match[1];
    console.log(`ADMIN: Callback backup_create_${backupType}`);
    await backupCommands.performBackup(ctx, backupType);
  });

  // Backup list pagination
  bot.action(/backup_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    console.log(`ADMIN: Callback backup_list_${page}`);
    await ctx.answerCbQuery();
    await backupCommands.showBackupList(ctx, page);
  });

  // === МОНИТОРИНГ БАЛАНСОВ ===

  bot.action('monitoring_menu', async (ctx) => {
    console.log('ADMIN: Callback monitoring_menu');
    await ctx.answerCbQuery();
    await monitoringCommands.showMonitoringMenu(ctx);
  });

  bot.action('monitoring_check', async (ctx) => {
    console.log('ADMIN: Callback monitoring_check');
    await ctx.answerCbQuery();
    await monitoringCommands.checkBalances(ctx);
  });

  bot.action('monitoring_stats', async (ctx) => {
    console.log('ADMIN: Callback monitoring_stats');
    await ctx.answerCbQuery();
    await monitoringCommands.showMonitoringStats(ctx);
  });

  bot.action('monitoring_notifications', async (ctx) => {
    console.log('ADMIN: Callback monitoring_notifications');
    await ctx.answerCbQuery();
    await monitoringCommands.showMonitoringNotifications(ctx);
  });

  bot.action('monitoring_cryptobot', async (ctx) => {
    console.log('ADMIN: Callback monitoring_cryptobot');
    await ctx.answerCbQuery();
    await monitoringCommands.getCryptoBotBalance(ctx);
  });

  bot.action('monitoring_system', async (ctx) => {
    console.log('ADMIN: Callback monitoring_system');
    await ctx.answerCbQuery();
    await monitoringCommands.getSystemBalance(ctx);
  });

  bot.action('monitoring_start', async (ctx) => {
    console.log('ADMIN: Callback monitoring_start');
    await ctx.answerCbQuery();
    await monitoringCommands.startMonitoring(ctx);
  });

  bot.action('monitoring_stop', async (ctx) => {
    console.log('ADMIN: Callback monitoring_stop');
    await ctx.answerCbQuery();
    await monitoringCommands.stopMonitoring(ctx);
  });

  // === СТАТИСТИКА МЕНЮ ===

  bot.action('stats_menu', async (ctx) => {
    console.log('ADMIN: Callback stats_menu');
    await ctx.answerCbQuery();
    
    const message = '📊 *Статистика и аналитика*\n\nВыберите раздел для просмотра:';
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Финансы', 'finances_stats'),
          Markup.button.callback('👥 Пользователи', 'users_stats')
        ],
        [
          Markup.button.callback('🎮 Игры', 'finances_games'),
          Markup.button.callback('💰 Комиссии', 'stats_commission')
        ],
        [
          Markup.button.callback('📊 Мониторинг', 'monitoring_menu'),
          Markup.button.callback('📢 Уведомления', 'notifications_stats')
        ],
        [Markup.button.callback('🔙 Назад', 'main_menu')]
      ])
    });
  });

  console.log('✅ Callback handlers зарегистрированы');
}

module.exports = registerCallbackHandlers;