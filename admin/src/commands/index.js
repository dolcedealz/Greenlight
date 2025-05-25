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
      '--- Общие команды ---\n' +
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
      '/get_user_chance - Показать шанс пользователя\n\n' +
      '--- Управление выводами ---\n' +
      '/pending_withdrawals - Выводы на одобрении\n' +
      '/withdrawal_stats - Статистика выводов'
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

  // === КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ ВЫВОДАМИ ===
  
  // Команда для просмотра pending выводов
  bot.command('pending_withdrawals', async (ctx) => {
    try {
      console.log('ADMIN: Запрос pending выводов');
      
      const response = await axios.get(`${apiUrl}/admin/withdrawals/pending`, {
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (!response.data.success || response.data.data.withdrawals.length === 0) {
        return ctx.reply('📋 Нет выводов, требующих одобрения');
      }
      
      const withdrawals = response.data.data.withdrawals;
      
      for (const withdrawal of withdrawals) {
        const user = withdrawal.user;
        const userName = user.username ? `@${user.username}` : `${user.firstName} ${user.lastName}`.trim();
        
        const message = 
          `💸 Запрос на вывод #${withdrawal.id}\n\n` +
          `👤 Пользователь: ${userName} (ID: ${user.telegramId})\n` +
          `💰 Текущий баланс: ${user.balance.toFixed(2)} USDT\n` +
          `💵 Сумма вывода: ${withdrawal.amount} USDT\n` +
          `📱 Получатель: ${withdrawal.recipient}\n` +
          `📝 Комментарий: ${withdrawal.comment || 'Нет'}\n` +
          `📅 Дата: ${new Date(withdrawal.createdAt).toLocaleString('ru-RU')}\n\n` +
          `Выберите действие:`;
        
        await ctx.reply(message, 
          Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Одобрить', `approve_withdrawal:${withdrawal.id}`),
              Markup.button.callback('❌ Отклонить', `reject_withdrawal:${withdrawal.id}`)
            ],
            [
              Markup.button.callback('👤 Инфо о пользователе', `user_info:${user.id}`)
            ]
          ])
        );
      }
      
      ctx.reply(`📊 Всего выводов на одобрении: ${withdrawals.length}`);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения pending выводов:', error);
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
  
  // Команда для просмотра статистики выводов
  bot.command('withdrawal_stats', async (ctx) => {
    try {
      console.log('ADMIN: Запрос статистики выводов');
      
      const response = await axios.get(`${apiUrl}/admin/withdrawals/stats`, {
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` }
      });
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить статистику');
      }
      
      const stats = response.data.data.stats;
      let message = '📊 Статистика выводов:\n\n';
      
      let totalCount = 0;
      let totalAmount = 0;
      
      for (const stat of stats) {
        const status = stat._id;
        let statusText = '';
        
        switch (status) {
          case 'pending': statusText = 'Ожидают'; break;
          case 'approved': statusText = 'Одобрены'; break;
          case 'processing': statusText = 'Обрабатываются'; break;
          case 'completed': statusText = 'Завершены'; break;
          case 'rejected': statusText = 'Отклонены'; break;
          case 'failed': statusText = 'Неудачны'; break;
          default: statusText = status;
        }
        
        message += `${statusText}:\n`;
        message += `  Количество: ${stat.count}\n`;
        message += `  Сумма: ${stat.totalAmount.toFixed(2)} USDT\n`;
        message += `  Средняя: ${stat.avgAmount.toFixed(2)} USDT\n\n`;
        
        totalCount += stat.count;
        totalAmount += stat.totalAmount;
      }
      
      message += `📈 Итого:\n`;
      message += `  Всего выводов: ${totalCount}\n`;
      message += `  Общая сумма: ${totalAmount.toFixed(2)} USDT`;
      
      ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения статистики выводов:', error);
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
  
  // Callback обработчики для выводов
  bot.action(/^approve_withdrawal:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      await ctx.answerCbQuery('⏳ Одобряем вывод...');
      
      console.log(`ADMIN: Одобрение вывода ${withdrawalId}`);
      
      const response = await axios.post(
        `${apiUrl}/admin/withdrawals/${withdrawalId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` } }
      );
      
      if (response.data.success) {
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n✅ ОДОБРЕНО',
          { parse_mode: 'HTML' }
        );
        await ctx.reply(`✅ Вывод #${withdrawalId} одобрен и отправлен на обработку`);
      } else {
        await ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
      
    } catch (error) {
      console.error('ADMIN: Ошибка одобрения вывода:', error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
  
  bot.action(/^reject_withdrawal:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      await ctx.answerCbQuery();
      
      // Сохраняем ID вывода в сессии для следующего шага
      ctx.session = ctx.session || {};
      ctx.session.rejectingWithdrawalId = withdrawalId;
      
      await ctx.reply(
        `❌ Отклонение вывода #${withdrawalId}\n\n` +
        `Укажите причину отклонения:`
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка при начале отклонения вывода:', error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
  
  // Обработка текстовых сообщений для причины отклонения
  bot.on('text', async (ctx, next) => {
    // Проверяем, есть ли в сессии ID отклоняемого вывода
    if (ctx.session && ctx.session.rejectingWithdrawalId) {
      const withdrawalId = ctx.session.rejectingWithdrawalId;
      const reason = ctx.message.text;
      
      try {
        console.log(`ADMIN: Отклонение вывода ${withdrawalId} с причиной: ${reason}`);
        
        const response = await axios.post(
          `${apiUrl}/admin/withdrawals/${withdrawalId}/reject`,
          { reason },
          { headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` } }
        );
        
        if (response.data.success) {
          await ctx.reply(
            `✅ Вывод #${withdrawalId} отклонен\n` +
            `Причина: ${reason}\n` +
            `Средства возвращены пользователю`
          );
        } else {
          await ctx.reply(`❌ Ошибка: ${response.data.message}`);
        }
        
        // Очищаем сессию
        delete ctx.session.rejectingWithdrawalId;
        
      } catch (error) {
        console.error('ADMIN: Ошибка отклонения вывода:', error);
        await ctx.reply(`❌ Ошибка: ${error.message}`);
        delete ctx.session.rejectingWithdrawalId;
      }
    } else {
      // Передаем управление следующему обработчику
      return next();
    }
  });

  return bot;
}

module.exports = {
  registerCommands
};