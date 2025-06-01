// admin/src/handlers/index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');

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
  
  // ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ КНОПКИ СОБЫТИЯ
  bot.hears('🔮 События', async (ctx) => {
    console.log('ADMIN: Обработка кнопки События');
    try {
      await showEventsMenu(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа меню событий:', error);
      await ctx.reply('❌ Ошибка загрузки меню событий. Попробуйте позже.');
    }
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

  // Обработка остальных callback запросов
  bot.action(/^game_(.+)$/, (ctx) => {
    const game = ctx.match[1];
    ctx.answerCbQuery();
    
    ctx.reply(`🎮 Настройки игры ${game} будут здесь...`);
  });

  return bot;
}

/**
 * Показать главное меню событий
 */
async function showEventsMenu(ctx) {
  console.log('ADMIN: Показ меню событий');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📋 Список событий', 'events_list')],
    [Markup.button.callback('➕ Создать событие', 'events_create')],
    [Markup.button.callback('✅ Завершить событие', 'events_finish')],
    [Markup.button.callback('📊 Статистика событий', 'events_stats')],
    [Markup.button.callback('◀️ Назад в меню', 'main_menu')]
  ]);

  await ctx.reply(
    '🔮 *Управление событиями*\n\n' +
    'Выберите действие:',
    {
      parse_mode: 'Markdown',
      ...keyboard
    }
  );
}

module.exports = {
  registerHandlers
};
