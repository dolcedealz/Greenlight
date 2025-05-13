// src/commands/index.js
const { Markup } = require('telegraf');

/**
 * Регистрирует команды для админ-бота
 * @param {Object} bot - Экземпляр Telegraf
 */
function registerCommands(bot) {
  // Команда /start
  bot.command('start', (ctx) => {
    const { id, first_name } = ctx.from;
    console.log(`Админ ${first_name} (${id}) запустил админ-бота`);
    
    ctx.reply(
      `👋 Привет, ${first_name}!\n\nЭто административный бот для управления Greenlight Casino.\n\nИспользуйте команды для получения статистики и управления системой.`,
      Markup.keyboard([
        ['📊 Статистика', '👥 Пользователи'],
        ['🎮 Игры', '🔮 События'],
        ['💰 Финансы', '⚙️ Настройки']
      ]).resize()
    );
  });
  
  // Команда /stats - статистика
  bot.command('stats', (ctx) => {
    ctx.reply('📊 Статистика системы\n\nОбщая статистика будет здесь...');
  });
  
  // Команда /users - пользователи
  bot.command('users', (ctx) => {
    ctx.reply('👥 Управление пользователями\n\nСписок пользователей будет здесь...');
  });
  
  // Команда /games - игры
  bot.command('games', (ctx) => {
    ctx.reply('🎮 Управление играми\n\nНастройки игр будут здесь...');
  });
  
  // Команда /events - события
  bot.command('events', (ctx) => {
    ctx.reply(
      '🔮 Управление событиями\n\nВыберите действие:',
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 Список событий', 'events_list')],
        [Markup.button.callback('➕ Создать событие', 'event_create')],
        [Markup.button.callback('📝 Редактировать событие', 'event_edit')]
      ])
    );
  });
  
  // Команда /finance - финансы
  bot.command('finance', (ctx) => {
    ctx.reply('💰 Управление финансами\n\nФинансовая информация будет здесь...');
  });
  
  // Команда /settings - настройки
  bot.command('settings', (ctx) => {
    ctx.reply('⚙️ Настройки системы\n\nНастройки будут здесь...');
  });
  
  // Команда /help
  bot.command('help', (ctx) => {
    ctx.reply(
      '🔍 Справка по командам:\n\n' +
      '/start - Начало работы с ботом\n' +
      '/stats - Просмотр статистики системы\n' +
      '/users - Управление пользователями\n' +
      '/games - Управление играми\n' +
      '/events - Управление событиями\n' +
      '/finance - Управление финансами\n' +
      '/settings - Настройки системы\n' +
      '/help - Показать эту справку'
    );
  });

  return bot;
}

module.exports = {
  registerCommands
};