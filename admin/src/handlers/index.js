// admin/src/handlers/index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');

/**
 * Регистрирует обработчики сообщений и callback
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerHandlers(bot) {
  // OLD HANDLERS REMOVED - These are now handled in index.js
  // The following handlers have been moved to src/commands/index.js:
  // - 📊 Финансы (previously 📊 Статистика)
  // - 👥 Пользователи 
  // - 🎮 Игры handler removed (replaced with new menu structure)
  
  // NOTE: All button handlers have been moved to src/commands/index.js
  // This includes: События, Финансы, Пользователи, Транзакции, etc.
  // The handlers are now centralized in the main command registration system

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
