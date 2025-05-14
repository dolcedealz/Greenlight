// admin/src/commands/index.js
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL из переменных окружения
const apiUrl = process.env.API_URL || 'http://localhost:3001/api';

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
      '/help - Показать эту справку\n\n' +
      '--- Управление шансами ---\n' +
      '/set_win_chance - Установить базовый шанс выигрыша\n' +
      '/set_user_chance - Установить шанс для пользователя\n' +
      '/get_chance_settings - Показать настройки шансов\n' +
      '/get_user_chance - Показать шанс пользователя'
    );
  });

  // НОВЫЕ КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ
  
  // Команда для управления базовым шансом выигрыша
  bot.command('set_win_chance', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        return ctx.reply('Использование: /set_win_chance [gameType] [шанс]\nПример: /set_win_chance coin 0.475');
      }
      
      const gameType = args[1].toLowerCase();
      const winChance = parseFloat(args[2]);
      
      if (isNaN(winChance) || winChance < 0 || winChance > 1) {
        return ctx.reply('Шанс выигрыша должен быть числом от 0 до 1');
      }
      
      // Отправляем запрос на API
      const response = await axios.post(`${apiUrl}/admin/win-chance/base`, {
        gameType,
        winChance
      }, {
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (response.data.success) {
        ctx.reply(`✅ Базовый шанс выигрыша для ${gameType} установлен на ${winChance * 100}%`);
      } else {
        ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
      console.error(error);
    }
  });

  // Команда для управления персональным шансом выигрыша
  bot.command('set_user_chance', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length < 4) {
        return ctx.reply('Использование: /set_user_chance [userId] [gameType] [модификатор]\nПример: /set_user_chance 612a3b4c5d6e7f8910111213 coin 10');
      }
      
      const userId = args[1];
      const gameType = args[2].toLowerCase();
      const modifierPercent = parseFloat(args[3]);
      
      if (isNaN(modifierPercent)) {
        return ctx.reply('Модификатор должен быть числом (в процентных пунктах)');
      }
      
      // Отправляем запрос на API
      const response = await axios.post(`${apiUrl}/admin/win-chance/user`, {
        userId,
        gameType,
        modifierPercent
      }, {
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (response.data.success) {
        const { effectiveWinChance } = response.data.data;
        ctx.reply(
          `✅ Модификатор шанса выигрыша установлен для пользователя:\n` +
          `ID: ${userId}\n` +
          `Игра: ${gameType}\n` +
          `Модификатор: ${modifierPercent > 0 ? '+' : ''}${modifierPercent}%\n` +
          `Эффективный шанс: ${(effectiveWinChance * 100).toFixed(2)}%`
        );
      } else {
        ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
      console.error(error);
    }
  });

  // Команда для получения текущих настроек шансов
  bot.command('get_chance_settings', async (ctx) => {
    try {
      // Отправляем запрос на API
      const response = await axios.get(`${apiUrl}/admin/win-chance/settings`, {
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (response.data.success) {
        const { gameSettings } = response.data.data;
        let message = '⚙️ Текущие настройки шансов выигрыша:\n\n';
        
        for (const [gameType, settings] of Object.entries(gameSettings)) {
          message += `📌 ${gameType.toUpperCase()}:\n`;
          message += `  • Базовый шанс: ${(settings.baseWinChance * 100).toFixed(2)}%\n`;
          message += `  • Множитель: x${settings.multiplier}\n`;
          message += `  • Ожидаемый RTP: ${(settings.baseWinChance * settings.multiplier * 100).toFixed(2)}%\n\n`;
        }
        
        ctx.reply(message);
      } else {
        ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
      console.error(error);
    }
  });

  // Команда для получения шансов конкретного пользователя
  bot.command('get_user_chance', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length < 3) {
        return ctx.reply('Использование: /get_user_chance [userId] [gameType]\nПример: /get_user_chance 612a3b4c5d6e7f8910111213 coin');
      }
      
      const userId = args[1];
      const gameType = args[2].toLowerCase();
      
      // Отправляем запрос на API
      const response = await axios.get(`${apiUrl}/admin/win-chance/user`, {
        params: { userId, gameType },
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (response.data.success) {
        const data = response.data.data;
        ctx.reply(
          `👤 Информация о шансах пользователя:\n` +
          `ID: ${data.userId}\n` +
          `Имя: ${data.firstName} ${data.lastName}\n` +
          `Username: ${data.username || 'нет'}\n` +
          `Игра: ${data.gameType}\n` +
          `Базовый шанс: ${(data.baseWinChance * 100).toFixed(2)}%\n` +
          `Модификатор: ${data.modifierPercent > 0 ? '+' : ''}${data.modifierPercent}%\n` +
          `Эффективный шанс: ${(data.effectiveWinChance * 100).toFixed(2)}%`
        );
      } else {
        ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.message}`);
      console.error(error);
    }
  });

  return bot;
}

module.exports = {
  registerCommands
};