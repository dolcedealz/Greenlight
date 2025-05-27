// admin/src/commands/index.js
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Проверяем наличие токена при инициализации
if (!adminToken) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: ADMIN_API_TOKEN не установлен!');
  console.error('   Добавьте ADMIN_API_TOKEN в переменные окружения Render');
}

// Создаем axios instance с предустановленными заголовками
const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Добавляем interceptor для логирования
apiClient.interceptors.request.use(request => {
  console.log(`📤 API Request: ${request.method.toUpperCase()} ${request.url}`);
  console.log('   Headers:', {
    ...request.headers,
    'Authorization': request.headers['Authorization'] ? 'Bearer [HIDDEN]' : undefined
  });
  return request;
}, error => {
  console.error('❌ Request Error:', error);
  return Promise.reject(error);
});

apiClient.interceptors.response.use(response => {
  console.log(`✅ API Response: ${response.status} ${response.config.url}`);
  return response;
}, error => {
  console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`);
  console.error('   Error Data:', error.response?.data);
  return Promise.reject(error);
});

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
  bot.command('finance', async (ctx) => {
    try {
      console.log('ADMIN: Запрос финансового состояния');
      
      const response = await apiClient.get('/admin/finance/state');
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить финансовое состояние');
      }
      
      const { balances, settings, warnings } = response.data.data;
      
      // Формируем сообщение
      let message = '💰 ФИНАНСОВОЕ СОСТОЯНИЕ КАЗИНО\n\n';
      
      message += '📊 Балансы:\n';
      message += `├ Баланс пользователей: ${balances.totalUsers.toFixed(2)} USDT\n`;
      message += `├ Оперативный счет: ${balances.operational.toFixed(2)} USDT\n`;
      message += `├ Резерв (${settings.reservePercentage}%): ${balances.reserve.toFixed(2)} USDT\n`;
      message += `└ Доступно для вывода: ${balances.availableForWithdrawal.toFixed(2)} USDT\n\n`;
      
      // Предупреждения
      if (warnings.lowReserve || warnings.highRiskRatio || warnings.negativeOperational) {
        message += '⚠️ ПРЕДУПРЕЖДЕНИЯ:\n';
        if (warnings.lowReserve) message += '├ Низкий уровень резерва\n';
        if (warnings.highRiskRatio) message += '├ Высокое соотношение балансов к резерву\n';
        if (warnings.negativeOperational) message += '└ Отрицательный оперативный баланс\n\n';
      }
      
      await ctx.reply(message, 
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📈 Отчет за день', 'finance_report:day'),
            Markup.button.callback('📊 Отчет за неделю', 'finance_report:week')
          ],
          [
            Markup.button.callback('🔄 Пересчитать', 'finance_recalculate'),
            Markup.button.callback('⚙️ Настройки', 'finance_settings')
          ],
          [
            Markup.button.callback('💸 Вывести прибыль', 'finance_withdraw')
          ]
        ])
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения финансов:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
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
      '/withdrawal_stats - Статистика выводов\n' +
      '/casino_balance - Баланс казино в CryptoBot\n' +
      '/recent_withdrawals - Последние 10 выводов\n\n' +
      '--- Управление финансами ---\n' +
      '/finance - Финансовое состояние\n' +
      '/profit - Доступная прибыль\n' +
      '/set_reserve - Установить процент резерва\n' +
      '/game_stats - Статистика по играм\n' +
      '/finance_history - История изменений балансов\n' +
      '/monitor - Включить/выключить мониторинг\n\n' +
      '--- Управление реферальной системой ---\n' +
      '/referral_stats - Общая статистика реферальной системы\n' +
      '/top_partners [количество] - Топ партнеров\n' +
      '/partner_info [user_id/@username] - Информация о партнере\n' +
      '/referral_fraud - Проверка мошеннической активности'
    );
  });

  // КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ
  
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
      const response = await apiClient.post('/admin/win-chance/base', {
        gameType,
        winChance
      });
      
      if (response.data.success) {
        ctx.reply(`✅ Базовый шанс выигрыша для ${gameType} установлен на ${winChance * 100}%`);
      } else {
        ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
    } catch (error) {
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
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
      const response = await apiClient.post('/admin/win-chance/user', {
        userId,
        gameType,
        modifierPercent
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
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
      console.error(error);
    }
  });

  // Команда для получения текущих настроек шансов
  bot.command('get_chance_settings', async (ctx) => {
    try {
      // Отправляем запрос на API
      const response = await apiClient.get('/admin/win-chance/settings');
      
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
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
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
      const response = await apiClient.get('/admin/win-chance/user', {
        params: { userId, gameType }
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
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
      console.error(error);
    }
  });

  // КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ ВЫВОДАМИ
  
  // Команда для просмотра pending выводов
  bot.command('pending_withdrawals', async (ctx) => {
    try {
      console.log('ADMIN: Запрос pending выводов');
      
      const response = await apiClient.get('/admin/withdrawals/pending');
      
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
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Команда для просмотра статистики выводов
  bot.command('withdrawal_stats', async (ctx) => {
    try {
      console.log('ADMIN: Запрос статистики выводов');
      
      const response = await apiClient.get('/admin/withdrawals/stats');
      
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
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Callback обработчики для выводов
  bot.action(/^approve_withdrawal:([0-9a-fA-F]{24})$/, async (ctx) => {
    try {
      const withdrawalId = ctx.match[1];
      await ctx.answerCbQuery('⏳ Одобряем вывод...');
      
      console.log(`ADMIN: Одобрение вывода ${withdrawalId}`);
      
      const response = await apiClient.post(`/admin/withdrawals/${withdrawalId}/approve`, {});
      
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
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
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
  
  // Обработка текстовых сообщений для причины отклонения и вывода прибыли
  bot.on('text', async (ctx, next) => {
    // Проверяем, ожидаем ли мы сумму для вывода прибыли
    if (ctx.session && ctx.session.withdrawingProfit) {
      const amount = parseFloat(ctx.message.text);
      
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Некорректная сумма. Введите положительное число:');
        return;
      }
      
      if (amount < 10) {
        await ctx.reply('❌ Минимальная сумма для вывода: 10 USDT. Введите другую сумму:');
        return;
      }
      
      try {
        console.log(`ADMIN: Вывод прибыли ${amount} USDT`);
        
        const response = await apiClient.post('/admin/finance/withdraw-profit', { 
          amount,
          recipient: ctx.from.username || `admin_${ctx.from.id}`,
          comment: 'Вывод прибыли казино'
        });
        
        if (response.data.success) {
          await ctx.reply(
            `✅ Прибыль успешно выведена!\n\n` +
            `Сумма: ${amount} USDT\n` +
            `Новый оперативный баланс: ${response.data.data.newOperationalBalance.toFixed(2)} USDT\n` +
            `Осталось доступно: ${response.data.data.newAvailable.toFixed(2)} USDT\n\n` +
            `⚠️ Средства будут переведены вручную через CryptoBot`
          );
        } else {
          await ctx.reply(`❌ Ошибка: ${response.data.message}`);
        }
        
        delete ctx.session.withdrawingProfit;
        
      } catch (error) {
        console.error('ADMIN: Ошибка вывода прибыли:', error);
        await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
        delete ctx.session.withdrawingProfit;
      }
    }
    // Проверяем, есть ли в сессии ID отклоняемого вывода
    else if (ctx.session && ctx.session.rejectingWithdrawalId) {
      const withdrawalId = ctx.session.rejectingWithdrawalId;
      const reason = ctx.message.text;
      
      try {
        console.log(`ADMIN: Отклонение вывода ${withdrawalId} с причиной: ${reason}`);
        
        const response = await apiClient.post(`/admin/withdrawals/${withdrawalId}/reject`, { reason });
        
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
        await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
        delete ctx.session.rejectingWithdrawalId;
      }
    } else {
      // Передаем управление следующему обработчику
      return next();
    }
  });

  // Команда для проверки баланса казино в CryptoBot
  bot.command('casino_balance', async (ctx) => {
    try {
      console.log('ADMIN: Запрос баланса казино в CryptoBot');
      
      await ctx.reply('⏳ Проверяем баланс казино в CryptoBot...');
      
      // Делаем запрос к CryptoBot API
      const cryptoBotToken = process.env.CRYPTO_PAY_API_TOKEN;
      const cryptoBotApiUrl = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api';
      
      if (!cryptoBotToken) {
        return ctx.reply('❌ CRYPTO_PAY_API_TOKEN не настроен');
      }
      
      const response = await axios.get(`${cryptoBotApiUrl}/getBalance`, {
        headers: {
          'Crypto-Pay-API-Token': cryptoBotToken
        }
      });
      
      if (response.data.ok) {
        const balances = response.data.result;
        let message = '💰 Баланс казино в CryptoBot:\n\n';
        
        let totalInUSDT = 0;
        
        for (const balance of balances) {
          const available = parseFloat(balance.available);
          const onhold = parseFloat(balance.onhold || 0);
          const total = available + onhold;
          
          message += `${balance.currency_code}:\n`;
          message += `  Доступно: ${available.toFixed(2)}\n`;
          if (onhold > 0) {
            message += `  Заморожено: ${onhold.toFixed(2)}\n`;
          }
          message += `  Всего: ${total.toFixed(2)}\n\n`;
          
          // Для упрощения считаем все как USDT (в реальности нужна конвертация)
          if (balance.currency_code === 'USDT') {
            totalInUSDT += total;
          }
        }
        
        // Получаем статистику выводов из БД
        const response2 = await apiClient.get('/admin/withdrawals/stats');
        
        if (response2.data.success) {
          const stats = response2.data.data.stats;
          message += '📊 Статистика выводов:\n';
          
          for (const stat of stats) {
            if (stat._id === 'processing' || stat._id === 'pending') {
              message += `${stat._id}: ${stat.count} шт. на ${stat.totalAmount.toFixed(2)} USDT\n`;
            }
          }
        }
        
        // Рекомендации
        message += '\n💡 Рекомендации:\n';
        if (totalInUSDT < 100) {
          message += '⚠️ Низкий баланс! Рекомендуется пополнить счет казино.\n';
        } else if (totalInUSDT < 500) {
          message += '⚠️ Средний баланс. Следите за крупными выводами.\n';
        } else {
          message += '✅ Баланс в норме.\n';
        }
        
        await ctx.reply(message);
        
      } else {
        await ctx.reply('❌ Ошибка получения баланса от CryptoBot');
      }
      
    } catch (error) {
      console.error('ADMIN: Ошибка проверки баланса казино:', error);
      ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // Команда для получения детальной информации о последних выводах
  bot.command('recent_withdrawals', async (ctx) => {
    try {
      console.log('ADMIN: Запрос последних выводов');
      
      const response = await apiClient.get('/admin/withdrawals', {
        params: { limit: 10 }
      });
      
      if (!response.data.success || response.data.data.withdrawals.length === 0) {
        return ctx.reply('📋 Нет выводов');
      }
      
      const withdrawals = response.data.data.withdrawals;
      let message = '📋 Последние 10 выводов:\n\n';
      
      for (const w of withdrawals) {
        const date = new Date(w.createdAt).toLocaleString('ru-RU');
        let statusEmoji = '';
        
        switch (w.status) {
          case 'pending': statusEmoji = '⏳'; break;
          case 'approved': statusEmoji = '✅'; break;
          case 'processing': statusEmoji = '⚙️'; break;
          case 'completed': statusEmoji = '✅'; break;
          case 'rejected': statusEmoji = '❌'; break;
          case 'failed': statusEmoji = '⚠️'; break;
        }
        
        message += `${statusEmoji} ${date}\n`;
        message += `Сумма: ${w.amount} USDT\n`;
        message += `Пользователь: @${w.user.username || 'нет'} (${w.user.firstName})\n`;
        message += `Получатель: @${w.recipient}\n`;
        message += `Статус: ${w.status}\n`;
        
        if (w.lastError && w.lastError.message) {
          message += `Ошибка: ${w.lastError.message}\n`;
        }
        
        message += '\n';
      }
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения последних выводов:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // Команда для быстрого просмотра доступной прибыли
  bot.command('profit', async (ctx) => {
    try {
      const response = await apiClient.get('/admin/finance/state');
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить данные');
      }
      
      const { balances } = response.data.data;
      
      await ctx.reply(
        `💵 ДОСТУПНАЯ ПРИБЫЛЬ\n\n` +
        `💰 Доступно для вывода: ${balances.availableForWithdrawal.toFixed(2)} USDT\n` +
        `📊 Оперативный счет: ${balances.operational.toFixed(2)} USDT\n` +
        `🛡️ Резерв: ${balances.reserve.toFixed(2)} USDT\n\n` +
        `Используйте /finance для подробной информации`
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения прибыли:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // Обработчики callback для финансов
  bot.action(/^finance_report:(.+)$/, async (ctx) => {
    try {
      const period = ctx.match[1];
      await ctx.answerCbQuery('⏳ Генерируем отчет...');
      
      const response = await apiClient.get('/admin/finance/report', {
        params: { period }
      });
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить отчет');
      }
      
      const report = response.data.data;
      
      let periodName = '';
      switch (period) {
        case 'day': periodName = 'ДЕНЬ'; break;
        case 'week': periodName = 'НЕДЕЛЮ'; break;
        case 'month': periodName = 'МЕСЯЦ'; break;
        default: periodName = 'ВСЕ ВРЕМЯ';
      }
      
      let message = `📊 ФИНАНСОВЫЙ ОТЧЕТ ЗА ${periodName}\n\n`;
      
      message += '💳 Депозиты:\n';
      message += `├ Количество: ${report.period.deposits.count}\n`;
      message += `└ Сумма: ${report.period.deposits.total.toFixed(2)} USDT\n\n`;
      
      message += '💸 Выводы:\n';
      message += `├ Количество: ${report.period.withdrawals.count}\n`;
      message += `└ Сумма: ${report.period.withdrawals.total.toFixed(2)} USDT\n\n`;
      
      message += '🎮 Игры:\n';
      message += `├ Количество: ${report.period.games.count}\n`;
      message += `├ Ставки: ${report.period.games.totalBets.toFixed(2)} USDT\n`;
      message += `├ Выигрыши: ${report.period.games.totalWins.toFixed(2)} USDT\n`;
      message += `└ Прибыль: ${report.period.games.profit.toFixed(2)} USDT\n\n`;
      
      message += `👥 Активных пользователей: ${report.period.activeUsers}\n\n`;
      
      message += '📈 ИТОГО ЗА ВСЕ ВРЕМЯ:\n';
      message += `├ Депозиты: ${report.allTime.totalDeposits.toFixed(2)} USDT\n`;
      message += `├ Выводы: ${report.allTime.totalWithdrawals.toFixed(2)} USDT\n`;
      message += `├ Ставки: ${report.allTime.totalBets.toFixed(2)} USDT\n`;
      message += `├ Выигрыши: ${report.allTime.totalWins.toFixed(2)} USDT\n`;
      message += `└ Выведено владельцем: ${report.allTime.totalOwnerWithdrawals.toFixed(2)} USDT`;
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения отчета:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  bot.action('finance_recalculate', async (ctx) => {
    try {
      await ctx.answerCbQuery('⏳ Пересчитываем...');
      
      const response = await apiClient.post('/admin/finance/recalculate', {});
      
      if (response.data.success) {
        const { balances, warnings } = response.data.data;
        
        let message = '✅ Финансы успешно пересчитаны\n\n';
        message += `💰 Баланс пользователей: ${balances.totalUsers.toFixed(2)} USDT\n`;
        message += `📊 Оперативный: ${balances.operational.toFixed(2)} USDT\n`;
        message += `🛡️ Резерв: ${balances.reserve.toFixed(2)} USDT\n`;
        message += `💵 Доступно: ${balances.availableForWithdrawal.toFixed(2)} USDT`;
        
        if (warnings.lowReserve || warnings.highRiskRatio || warnings.negativeOperational) {
          message += '\n\n⚠️ Есть предупреждения!';
        }
        
        await ctx.reply(message);
      } else {
        await ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
      
    } catch (error) {
      console.error('ADMIN: Ошибка пересчета:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  bot.action('finance_settings', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const response = await apiClient.get('/admin/finance/state');
      
      const { settings } = response.data.data;
      
      await ctx.reply(
        `⚙️ НАСТРОЙКИ ФИНАНСОВ\n\n` +
        `Текущий процент резервирования: ${settings.reservePercentage}%\n\n` +
        `Для изменения используйте:\n` +
        `/set_reserve [процент]\n` +
        `Например: /set_reserve 40`
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения настроек:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  bot.action('finance_withdraw', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      ctx.session = ctx.session || {};
      ctx.session.withdrawingProfit = true;
      
      const response = await apiClient.get('/admin/finance/state');
      
      const { balances } = response.data.data;
      
      await ctx.reply(
        `💸 ВЫВОД ПРИБЫЛИ\n\n` +
        `Доступно для вывода: ${balances.availableForWithdrawal.toFixed(2)} USDT\n` +
        `Минимальная сумма: 10 USDT\n\n` +
        `Введите сумму для вывода:`
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка начала вывода:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // Команда для установки процента резерва
  bot.command('set_reserve', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        return ctx.reply('Использование: /set_reserve [процент]\nПример: /set_reserve 40');
      }
      
      const percentage = parseFloat(args[1]);
      
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return ctx.reply('Процент должен быть числом от 0 до 100');
      }
      
      const response = await apiClient.post('/admin/finance/reserve-percentage', { percentage });
      
      if (response.data.success) {
        const { reservePercentage, reserveBalance, availableForWithdrawal } = response.data.data;
        
        await ctx.reply(
          `✅ Процент резервирования изменен\n\n` +
          `Новый процент: ${reservePercentage}%\n` +
          `Резерв: ${reserveBalance.toFixed(2)} USDT\n` +
          `Доступно для вывода: ${availableForWithdrawal.toFixed(2)} USDT`
        );
      } else {
        await ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
      
    } catch (error) {
      console.error('ADMIN: Ошибка установки резерва:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // Команда для включения/выключения мониторинга
  bot.command('monitor', async (ctx) => {
    ctx.session = ctx.session || {};
    
    if (ctx.session.monitoring) {
      // Выключаем мониторинг
      clearInterval(ctx.session.monitoringInterval);
      delete ctx.session.monitoring;
      delete ctx.session.monitoringInterval;
      delete ctx.session.monitoringMessageId;
      
      await ctx.reply('📊 Мониторинг финансов выключен');
    } else {
      // Включаем мониторинг
      ctx.session.monitoring = true;
      
      try {
        // Отправляем первое сообщение
        const message = await ctx.reply('⏳ Запуск мониторинга...');
        ctx.session.monitoringMessageId = message.message_id;
        
        // Функция обновления данных
        const updateMonitoring = async () => {
          try {
            const response = await apiClient.get('/admin/finance/state');
            
            if (!response.data.success) return;
            
            const { balances, statistics } = response.data.data;
            
            const monitorText = 
              `📊 МОНИТОРИНГ ФИНАНСОВ\n` +
              `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
              `💰 Баланс пользователей: ${balances.totalUsers.toFixed(2)} USDT\n` +
              `📈 Оперативный счет: ${balances.operational.toFixed(2)} USDT\n` +
              `🛡️ Резерв: ${balances.reserve.toFixed(2)} USDT\n` +
              `💵 Доступно для вывода: ${balances.availableForWithdrawal.toFixed(2)} USDT\n\n` +
              `📊 Статистика:\n` +
              `├ Всего депозитов: ${statistics.totalDeposits.toFixed(2)} USDT\n` +
              `├ Всего выводов: ${statistics.totalWithdrawals.toFixed(2)} USDT\n` +
              `├ Всего ставок: ${statistics.totalBets.toFixed(2)} USDT\n` +
              `└ Всего выигрышей: ${statistics.totalWins.toFixed(2)} USDT\n\n` +
              `Для остановки используйте /monitor`;
            
            // Редактируем сообщение
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              ctx.session.monitoringMessageId,
              null,
              monitorText
            );
            
          } catch (error) {
            console.error('MONITOR: Ошибка обновления:', error);
            // Если не удалось отредактировать, останавливаем мониторинг
            if (error.response && error.response.error_code === 400) {
              clearInterval(ctx.session.monitoringInterval);
              delete ctx.session.monitoring;
              delete ctx.session.monitoringInterval;
              delete ctx.session.monitoringMessageId;
            }
          }
        };
        
        // Запускаем первое обновление
        await updateMonitoring();
        
        // Запускаем обновление каждые 30 секунд
        ctx.session.monitoringInterval = setInterval(updateMonitoring, 30000);
        
      } catch (error) {
        console.error('MONITOR: Ошибка запуска мониторинга:', error);
        await ctx.reply(`❌ Ошибка запуска мониторинга: ${error.message}`);
        delete ctx.session.monitoring;
      }
    }
  });

  // Команда для просмотра истории балансов
  bot.command('finance_history', async (ctx) => {
    try {
      const response = await apiClient.get('/admin/finance/history', {
        params: { limit: 20 }
      });
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить историю');
      }
      
      const { history } = response.data.data;
      
      if (history.length === 0) {
        return ctx.reply('📊 История изменений пока пуста');
      }
      
      let message = '📊 ИСТОРИЯ ИЗМЕНЕНИЙ БАЛАНСОВ\n\n';
      
      history.slice(0, 10).forEach(record => {
        const date = new Date(record.timestamp).toLocaleString('ru-RU');
        let eventName = '';
        
        switch (record.event) {
          case 'deposit': eventName = '💳 Депозит'; break;
          case 'user_withdrawal': eventName = '💸 Вывод пользователя'; break;
          case 'owner_withdrawal': eventName = '💰 Вывод прибыли'; break;
          case 'game_win': eventName = '🎮 Выигрыш в игре'; break;
          case 'game_loss': eventName = '🎮 Проигрыш в игре'; break;
          case 'full_recalculation': eventName = '🔄 Пересчет'; break;
          default: eventName = record.event;
        }
        
        message += `${date}\n`;
        message += `${eventName}\n`;
        message += `Оперативный: ${record.operationalBalance.toFixed(2)} USDT\n`;
        if (record.details && record.details.amount) {
          message += `Сумма: ${record.details.amount.toFixed(2)} USDT\n`;
        }
        message += '\n';
      });
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения истории:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // Команда для быстрой статистики по играм
  bot.command('game_stats', async (ctx) => {
    try {
      const response = await apiClient.get('/admin/finance/game-stats');
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить статистику');
      }
      
      const { games, total } = response.data.data;
      
      let message = '🎮 СТАТИСТИКА ПО ИГРАМ\n\n';
      
      // Статистика по каждой игре
      const gameNames = {
        coin: '🪙 Монетка',
        mines: '💣 Мины',
        slots: '🎰 Слоты',
        crash: '📈 Краш'
      };
      
      for (const [gameType, stats] of Object.entries(games)) {
        message += `${gameNames[gameType] || gameType}:\n`;
        message += `├ Игр: ${stats.totalGames}\n`;
        message += `├ Ставок: ${stats.totalBets.toFixed(2)} USDT\n`;
        message += `├ Выплат: ${stats.totalWins.toFixed(2)} USDT\n`;
        message += `├ Прибыль: ${stats.profit.toFixed(2)} USDT\n`;
        message += `├ RTP: ${stats.rtp}%\n`;
        message += `└ House Edge: ${stats.houseEdge}%\n\n`;
      }
      
      // Общая статистика
      message += '📊 ИТОГО:\n';
      message += `├ Всего ставок: ${total.totalBets.toFixed(2)} USDT\n`;
      message += `├ Всего выплат: ${total.totalWins.toFixed(2)} USDT\n`;
      message += `├ Прибыль казино: ${total.totalProfit.toFixed(2)} USDT\n`;
      message += `├ Общий RTP: ${total.rtp}%\n`;
      message += `└ House Edge: ${total.houseEdge}%`;
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения статистики игр:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });

  // === КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ РЕФЕРАЛЬНОЙ СИСТЕМОЙ ===
  
  // Команда для просмотра статистики реферальной системы
  bot.command('referral_stats', async (ctx) => {
    try {
      console.log('ADMIN: Запрос статистики реферальной системы');
      
      const response = await apiClient.get('/referrals/admin/stats');
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить статистику');
      }
      
      const stats = response.data.data;
      
      let message = '📊 СТАТИСТИКА РЕФЕРАЛЬНОЙ СИСТЕМЫ\n\n';
      
      message += '💰 Финансы:\n';
      message += `├ Всего выплачено партнерам: ${stats.finance.totalReferralPayments.toFixed(2)} USDT\n`;
      message += `├ % от прибыли казино: ${stats.finance.impactPercent}%\n`;
      message += `└ Ожидает выплаты: ${stats.partners.totalBalance.toFixed(2)} USDT\n\n`;
      
      message += '👥 Партнеры:\n';
      message += `├ Всего партнеров: ${stats.partners.total}\n`;
      stats.partners.byLevel.forEach(level => {
        const levelNames = {
          bronze: '🥉 Бронза',
          silver: '🥈 Серебро',
          gold: '🥇 Золото',
          platinum: '💎 Платина',
          vip: '🌟 VIP'
        };
        message += `├ ${levelNames[level._id] || level._id}: ${level.count} (заработали ${level.totalEarned.toFixed(2)} USDT)\n`;
      });
      message += '\n';
      
      message += '📈 Эффективность:\n';
      message += `├ Всего привлечено: ${stats.referrals.total}\n`;
      message += `├ Активных рефералов: ${stats.referrals.active}\n`;
      message += `├ Конверсия: ${stats.referrals.conversionRate}%\n\n`;
      
      message += '💸 Выплаты:\n';
      message += `├ Всего выплат: ${stats.payouts.payoutsCount}\n`;
      message += `├ Общая сумма: ${stats.payouts.totalPaid.toFixed(2)} USDT\n`;
      message += `└ Средняя выплата: ${stats.payouts.avgPayout.toFixed(2)} USDT`;
      
      await ctx.reply(message, 
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🏆 Топ партнеров', 'ref_top_partners'),
            Markup.button.callback('🚨 Проверка фрода', 'ref_fraud_check')
          ],
          [
            Markup.button.callback('📊 Отчет за день', 'ref_report:day'),
            Markup.button.callback('📊 Отчет за неделю', 'ref_report:week')
          ]
        ])
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения статистики рефералов:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Команда для просмотра топ партнеров
  bot.command('top_partners', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      const limit = args[1] || 10;
      
      const response = await apiClient.get('/referrals/admin/top-partners', {
        params: { limit }
      });
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить топ партнеров');
      }
      
      const partners = response.data.data.partners;
      
      let message = `🏆 ТОП-${limit} ПАРТНЕРОВ\n\n`;
      
      partners.forEach((partner, index) => {
        const levelEmojis = {
          bronze: '🥉',
          silver: '🥈',
          gold: '🥇',
          platinum: '💎',
          vip: '🌟'
        };
        
        message += `${index + 1}. @${partner.username || 'нет'} (${partner.firstName})\n`;
        message += `   ${levelEmojis[partner.referralStats.level]} ${partner.referralStats.level.toUpperCase()}\n`;
        message += `   ├ Заработано: ${partner.referralStats.totalEarned.toFixed(2)} USDT\n`;
        message += `   ├ Баланс: ${partner.referralStats.referralBalance.toFixed(2)} USDT\n`;
        message += `   ├ Активных рефералов: ${partner.referralStats.activeReferrals}\n`;
        message += `   └ Конверсия: ${partner.referralDetails.conversionRate}%\n\n`;
      });
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения топ партнеров:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Команда для получения информации о конкретном партнере
  bot.command('partner_info', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        return ctx.reply('Использование: /partner_info [user_id или @username]');
      }
      
      let partnerId = args[1];
      
      // Если это username, нужно найти пользователя
      if (partnerId.startsWith('@')) {
        const { User } = require('../../../backend/src/models');
        const username = partnerId.substring(1);
        const user = await User.findOne({ username });
        if (!user) {
          return ctx.reply('❌ Пользователь не найден');
        }
        partnerId = user._id.toString();
      }
      
      const response = await apiClient.get(`/referrals/admin/partner/${partnerId}`);
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить информацию о партнере');
      }
      
      const data = response.data.data;
      const partner = data.partner;
      const stats = data.stats;
      
      const levelEmojis = {
        bronze: '🥉',
        silver: '🥈',
        gold: '🥇',
        platinum: '💎',
        vip: '🌟'
      };
      
      let message = `👤 ПАРТНЕР: @${partner.username || 'нет'} (${partner.name})\n\n`;
      
      message += '📊 Статус:\n';
      message += `├ Уровень: ${levelEmojis[partner.level]} ${partner.levelInfo.name} (${partner.levelInfo.commissionPercent}%)\n`;
      message += `├ До ${partner.progress.nextLevel || 'максимума'}: ${partner.progress.needed} активных рефералов\n`;
      message += `├ Прогресс: ${partner.progress.progress.toFixed(0)}%\n`;
      message += `└ Реферальный код: ${partner.referralCode}\n\n`;
      
      message += '💰 Финансы:\n';
      message += `├ Всего заработано: ${stats.totalEarned.toFixed(2)} USDT\n`;
      message += `├ Реферальный баланс: ${stats.referralBalance.toFixed(2)} USDT\n`;
      message += `├ Выведено: ${stats.totalWithdrawn.toFixed(2)} USDT\n`;
      message += `└ Транзакций: ${stats.totalTransactions}\n\n`;
      
      message += '👥 Рефералы:\n';
      message += `├ Всего привлечено: ${stats.totalReferrals}\n`;
      message += `├ Активных (30д): ${stats.activeReferrals}\n`;
      message += `└ С депозитами: ${stats.referralsWithDeposits}\n\n`;
      
      // Топ рефералы
      if (data.referrals.top.length > 0) {
        message += '🏆 Топ-3 реферала:\n';
        data.referrals.top.slice(0, 3).forEach((ref, index) => {
          message += `${index + 1}. @${ref.referral.username || 'нет'} - принес ${ref.totalBrought.toFixed(2)} USDT\n`;
        });
      }
      
      await ctx.reply(message,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📝 Изменить уровень', `ref_change_level:${partnerId}`),
            Markup.button.callback('📊 Детальная статистика', `ref_detailed_stats:${partnerId}`)
          ],
          [
            Markup.button.callback('👥 Список рефералов', `ref_list:${partnerId}`),
            Markup.button.callback('💸 История выплат', `ref_payout_history:${partnerId}`)
          ]
        ])
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения информации о партнере:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Команда для проверки мошеннической активности
  bot.command('referral_fraud', async (ctx) => {
    try {
      console.log('ADMIN: Запрос проверки мошеннической активности');
      
      const response = await apiClient.get('/referrals/admin/fraud');
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось выполнить проверку');
      }
      
      const { patterns, totalSuspicious } = response.data.data;
      
      if (totalSuspicious === 0) {
        return ctx.reply('✅ Подозрительная активность не обнаружена');
      }
      
      let message = `⚠️ ОБНАРУЖЕНА ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ\n\n`;
      message += `Всего подозрительных случаев: ${totalSuspicious}\n\n`;
      
      patterns.forEach(pattern => {
        message += `🚨 ${pattern.message}:\n`;
        
        if (pattern.type === 'high_inactive_rate') {
          pattern.data.forEach(partner => {
            message += `├ @${partner.username || 'ID:' + partner.telegramId}: ${partner.inactivePercent.toFixed(0)}% неактивных\n`;
          });
        } else if (pattern.type === 'bulk_registrations') {
          pattern.data.forEach(bulk => {
            const partner = bulk.partnerInfo[0];
            message += `├ @${partner?.username || 'ID:' + bulk._id.referrer}: ${bulk.count} регистраций за час\n`;
          });
        } else if (pattern.type === 'deposits_without_games') {
          pattern.data.forEach(group => {
            message += `├ Партнер ID:${group._id}: ${group.count} рефералов с депозитами без игр\n`;
          });
        }
        
        message += '\n';
      });
      
      message += '💡 Рекомендации:\n';
      message += '├ Проверить IP адреса подозрительных аккаунтов\n';
      message += '├ Изучить историю игр на предмет паттернов\n';
      message += '└ Рассмотреть временную блокировку выплат';
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка проверки фрода:', error);
      ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  // Callback обработчики для реферальной системы
  bot.action('ref_top_partners', async (ctx) => {
    await ctx.answerCbQuery();
    // Вызываем команду top_partners
    ctx.message = { text: '/top_partners 10' };
    await bot.handleUpdate({ message: ctx.message, update_id: Date.now() });
  });
  
  bot.action('ref_fraud_check', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.message = { text: '/referral_fraud' };
    await bot.handleUpdate({ message: ctx.message, update_id: Date.now() });
  });
  
  bot.action(/^ref_report:(.+)$/, async (ctx) => {
    try {
      const period = ctx.match[1];
      await ctx.answerCbQuery('⏳ Генерируем отчет...');
      
      const response = await apiClient.get('/referrals/admin/stats', {
        params: { period }
      });
      
      if (!response.data.success) {
        return ctx.reply('❌ Не удалось получить отчет');
      }
      
      const stats = response.data.data;
      
      let periodName = '';
      switch (period) {
        case 'day': periodName = 'ДЕНЬ'; break;
        case 'week': periodName = 'НЕДЕЛЮ'; break;
        case 'month': periodName = 'МЕСЯЦ'; break;
      }
      
      let message = `📊 РЕФЕРАЛЬНЫЙ ОТЧЕТ ЗА ${periodName}\n\n`;
      
      message += '💰 Начисления:\n';
      stats.earnings.forEach(earning => {
        const typeNames = {
          game_loss: '🎮 Комиссии с проигрышей',
          registration_bonus: '🎁 Бонусы за регистрацию'
        };
        message += `├ ${typeNames[earning._id] || earning._id}: ${earning.totalAmount.toFixed(2)} USDT (${earning.count} раз)\n`;
      });
      
      const totalEarnings = stats.earnings.reduce((sum, e) => sum + e.totalAmount, 0);
      message += `└ Всего: ${totalEarnings.toFixed(2)} USDT\n\n`;
      
      message += '📈 Динамика:\n';
      message += `├ Новых партнеров: ${stats.partners.byLevel.filter(l => l._id === 'bronze').reduce((sum, l) => sum + l.count, 0)}\n`;
      message += `├ Новых рефералов: ${stats.referrals.total}\n`;
      message += `└ ROI программы: ${totalEarnings > 0 ? ((stats.finance.totalReferralPayments / totalEarnings * 100).toFixed(0)) : 0}%`;
      
      await ctx.reply(message);
      
    } catch (error) {
      console.error('ADMIN: Ошибка получения отчета:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  bot.action(/^ref_change_level:(.+)$/, async (ctx) => {
    try {
      const partnerId = ctx.match[1];
      await ctx.answerCbQuery();
      
      ctx.session = ctx.session || {};
      ctx.session.changingLevelForPartner = partnerId;
      
      await ctx.reply(
        'Выберите новый уровень для партнера:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🥉 Бронза (5%)', 'set_partner_level:bronze'),
            Markup.button.callback('🥈 Серебро (7%)', 'set_partner_level:silver')
          ],
          [
            Markup.button.callback('🥇 Золото (10%)', 'set_partner_level:gold'),
            Markup.button.callback('💎 Платина (12%)', 'set_partner_level:platinum')
          ],
          [
            Markup.button.callback('🌟 VIP (15%)', 'set_partner_level:vip')
          ],
          [
            Markup.button.callback('❌ Отмена', 'cancel_level_change')
          ]
        ])
      );
      
    } catch (error) {
      console.error('ADMIN: Ошибка начала изменения уровня:', error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
  
  bot.action(/^set_partner_level:(.+)$/, async (ctx) => {
    try {
      const level = ctx.match[1];
      const partnerId = ctx.session?.changingLevelForPartner;
      
      if (!partnerId) {
        await ctx.answerCbQuery('❌ Сессия истекла');
        return;
      }
      
      await ctx.answerCbQuery('⏳ Изменяем уровень...');
      
      const response = await apiClient.put(`/referrals/admin/partner/${partnerId}/level`, { level });
      
      if (response.data.success) {
        await ctx.editMessageText(
          `✅ ${response.data.message}\n\n` +
          `Новая комиссия: ${response.data.data.commissionPercent}%`
        );
      } else {
        await ctx.reply(`❌ Ошибка: ${response.data.message}`);
      }
      
      delete ctx.session.changingLevelForPartner;
      
    } catch (error) {
      console.error('ADMIN: Ошибка изменения уровня:', error);
      await ctx.reply(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  });
  
  bot.action('cancel_level_change', async (ctx) => {
    await ctx.answerCbQuery('Отменено');
    await ctx.deleteMessage();
    delete ctx.session?.changingLevelForPartner;
  });

  return bot;
}

module.exports = {
  registerCommands
};