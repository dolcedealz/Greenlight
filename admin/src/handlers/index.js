// admin/src/handlers/index.js
const { Markup } = require('telegraf');
const eventsCommands = require('../commands/events.command');

/**
 * Регистрирует обработчики сообщений и callback
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerHandlers(bot) {
  // Обработка текстовых сообщений
  bot.hears('📊 Статистика', (ctx) => {
    // Здесь будет запрос к API для получения статистики
    const mockStats = {
      users: 1245,
      activeToday: 189,
      totalGames: 8912,
      totalBets: 250450.25,
      totalWins: 237927.74,
      profit: 12522.51
    };
    
    ctx.reply(
      `📊 *Статистика системы*\n\n` +
      `👥 Всего пользователей: ${mockStats.users}\n` +
      `👤 Активных сегодня: ${mockStats.activeToday}\n` +
      `🎮 Всего игр: ${mockStats.totalGames}\n` +
      `💰 Общая сумма ставок: ${mockStats.totalBets.toFixed(2)} USDT\n` +
      `💸 Общая сумма выплат: ${mockStats.totalWins.toFixed(2)} USDT\n` +
      `📈 Прибыль системы: ${mockStats.profit.toFixed(2)} USDT`,
      { parse_mode: 'Markdown' }
    );
  });
  
  bot.hears('👥 Пользователи', (ctx) => {
    ctx.reply(
      '👥 Управление пользователями\n\nВыберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 Список пользователей', 'users_list')],
        [Markup.button.callback('🔍 Найти пользователя', 'user_search')],
        [Markup.button.callback('🔒 Блокировка/Разблокировка', 'user_block')]
      ])
    );
  });
  
  bot.hears('🎮 Игры', (ctx) => {
    ctx.reply(
      '🎮 Управление играми\n\nВыберите игру:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🎰 Слоты', 'game_slots'),
          Markup.button.callback('💣 Мины', 'game_mines')
        ],
        [
          Markup.button.callback('📈 Краш', 'game_crash'),
          Markup.button.callback('🪙 Монетка', 'game_coin')
        ],
        [Markup.button.callback('📊 Статистика по играм', 'games_stats')]
      ])
    );
  });
  
  bot.hears('🔮 События', async (ctx) => {
    await eventsCommands.showEventsMenu(ctx);
  });
  
  bot.hears('💰 Финансы', (ctx) => {
    ctx.reply(
      '💰 Управление финансами\n\nВыберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 Транзакции', 'transactions_list')],
        [Markup.button.callback('📥 Депозиты', 'deposits_list')],
        [Markup.button.callback('📤 Выводы', 'withdrawals_list')]
      ])
    );
  });
  
  bot.hears('⚙️ Настройки', (ctx) => {
    ctx.reply(
      '⚙️ Настройки системы\n\nВыберите настройки:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🎮 Игры', 'settings_games')],
        [Markup.button.callback('💰 Комиссии', 'settings_fees')],
        [Markup.button.callback('👥 Реферальная система', 'settings_referral')]
      ])
    );
  });

  // === ОБРАБОТЧИКИ CALLBACK ДЛЯ СОБЫТИЙ ===
  
  // Главное меню событий
  bot.action('events_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await eventsCommands.showEventsMenu(ctx);
  });
  
  // Список событий
  bot.action('events_list', async (ctx) => {
    await ctx.answerCbQuery();
    await eventsCommands.showEventsList(ctx);
  });
  
  // Создание события
  bot.action('events_create', async (ctx) => {
    await ctx.answerCbQuery();
    await eventsCommands.startEventCreation(ctx);
  });
  
  // Завершение события
  bot.action('events_finish', async (ctx) => {
    await ctx.answerCbQuery();
    await eventsCommands.finishEvent(ctx);
  });
  
  // Статистика событий
  bot.action('events_stats', async (ctx) => {
    await ctx.answerCbQuery();
    await eventsCommands.showEventsStats(ctx);
  });
  
  // Выбор категории события
  bot.action(/^event_category_(.+)$/, async (ctx) => {
    const category = ctx.match[1];
    await eventsCommands.handleCategorySelection(ctx, category);
  });
  
  // Завершение события с выбором исхода
  bot.action(/^finish_outcome_(.+)$/, async (ctx) => {
    const outcomeId = ctx.match[1];
    await ctx.answerCbQuery();
    await eventsCommands.completeEventFinishing(ctx, outcomeId);
  });
  
  // Обработка остальных callback запросов
  bot.action(/^game_(.+)$/, (ctx) => {
    const game = ctx.match[1];
    ctx.answerCbQuery();
    
    ctx.reply(`🎮 Настройки игры ${game} будут здесь...`);
  });
  
  // Обработка всех остальных сообщений (для создания событий)
  bot.on('text', async (ctx, next) => {
    // Проверяем, если это процесс создания события
    if (ctx.session && ctx.session.creatingEvent) {
      await eventsCommands.handleEventCreation(ctx);
      return;
    }
    
    // Проверяем, если это процесс завершения события
    if (ctx.session && ctx.session.finishingEvent) {
      await eventsCommands.handleEventFinishing(ctx);
      return;
    }
    
    // Если нет активных процессов, показываем справку
    ctx.reply('Используйте команды или кнопки для взаимодействия с ботом. Для справки введите /help');
  });

  return bot;
}

module.exports = {
  registerHandlers
};
