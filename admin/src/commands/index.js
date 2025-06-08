// admin/src/commands/index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Логируем URL для отладки
console.log('INDEX COMMAND: API URL:', apiUrl);

// Проверяем наличие токена при инициализации
if (!adminToken) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: ADMIN_API_TOKEN не установлен!');
  console.error('   Добавьте ADMIN_API_TOKEN в переменные окружения Render');
} else {
  console.log('✅ ADMIN_API_TOKEN найден');
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
      `👋 Привет, ${first_name}!\n\n🎰 *Административная панель Greenlight Casino*\n\nПолный контроль над вашим казино:\n\n📊 Финансовая аналитика и отчеты\n👥 Управление пользователями\n🏦 Обработка выводов и депозитов\n✅ Одобрение транзакций\n🎯 Настройка коэффициентов\n🔮 Управление событиями\n⚙️ Системные настройки`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['📊 Финансы', '👥 Пользователи'],
          ['🏦 Транзакции', '🔮 События'],
          ['🎯 Коэффициенты', '🎁 Промокоды'],
          ['🛡️ Безопасность', '📊 Мониторинг'],
          ['💾 Бэкапы', '📢 Уведомления'],
          ['⚙️ Настройки']
        ]).resize()
      }
    );
  });
  
  // === КОМАНДЫ ДЛЯ СОБЫТИЙ ===
  
  // Команда /events - события
  bot.command('events', async (ctx) => {
    console.log('ADMIN: Команда /events вызвана');
    await showEventsMenu(ctx);
  });
  
  // Команда /create_event - быстрое создание события
  bot.command('create_event', async (ctx) => {
    console.log('ADMIN: Команда /create_event вызвана');
    await startEventCreation(ctx);
  });
  
  // Команда /finish_event - завершение события
  bot.command('finish_event', async (ctx) => {
    console.log('ADMIN: Команда /finish_event вызвана');
    await startEventFinishing(ctx);
  });
  
  // Команда /events_list - список событий
  bot.command('events_list', async (ctx) => {
    console.log('ADMIN: Команда /events_list вызвана');
    await showEventsList(ctx);
  });

  // === НОВЫЕ КОМАНДЫ ДЛЯ ПОЛНОЦЕННОГО УПРАВЛЕНИЯ ===
  
  // Команда /finances - финансовая панель
  bot.command('finances', async (ctx) => {
    console.log('ADMIN: Команда /finances вызвана');
    await showFinancesMenu(ctx);
  });

  // Команда /users - управление пользователями
  bot.command('users', async (ctx) => {
    console.log('ADMIN: Команда /users вызвана');
    await showUsersMenu(ctx);
  });

  // Команда /transactions - управление транзакциями
  bot.command('transactions', async (ctx) => {
    console.log('ADMIN: Команда /transactions вызвана');
    await showTransactionsMenu(ctx);
  });

  // Команда /coefficients - управление коэффициентами
  bot.command('coefficients', async (ctx) => {
    console.log('ADMIN: Команда /coefficients вызвана');
    await showCoefficientsMenu(ctx);
  });

  // Команда /promo - управление промокодами
  bot.command('promo', async (ctx) => {
    console.log('ADMIN: Команда /promo вызвана');
    await promoCommands.showPromoMenu(ctx);
  });

  // Команда /stats - статистика с новой финансовой информацией
  const statsCommand = require('./stats.command');
  bot.command('stats', statsCommand);

  // Команда /security - безопасность и аудит
  bot.command('security', async (ctx) => {
    console.log('ADMIN: Команда /security вызвана');
    await securityCommands.showSecurityMenu(ctx);
  });

  // Команда /monitoring - мониторинг системы
  bot.command('monitoring', async (ctx) => {
    console.log('ADMIN: Команда /monitoring вызвана');
    await monitoringCommands.showMonitoringMenu(ctx);
  });

  // Команда /backup - система бэкапов
  bot.command('backup', async (ctx) => {
    console.log('ADMIN: Команда /backup вызвана');
    await backupCommands.showBackupMenu(ctx);
  });

  // Команда /notifications - массовые уведомления
  bot.command('notifications', async (ctx) => {
    console.log('ADMIN: Команда /notifications вызвана');
    await notificationsCommands.showNotificationsMenu(ctx);
  });

  // NOTE: Callback handlers and text message handlers have been moved to dedicated handler files:
  // - /src/handlers/callback.handler.js - All callback handlers
  // - /src/handlers/message.handler.js - Text message processing
  // This avoids duplicate handler registration and conflicts.

  // === ФУНКЦИИ ДЛЯ СОБЫТИЙ ===
  
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

    const message = '🔮 *Управление событиями*\n\n' + 'Выберите действие:';
    
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
      console.error('ADMIN: Ошибка показа меню событий:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Показать список событий
   */
  async function showEventsList(ctx) {
    console.log('ADMIN: Запрос списка событий');
    
    try {
      const response = await apiClient.get('/events/admin/all', {
        params: { limit: 10 }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка получения событий');
      }
      
      const events = response.data.data.events;
      
      if (events.length === 0) {
        const message = '📋 *Список событий*\n\n' + 'События не найдены.';
        const keyboard = Markup.inlineKeyboard([[
          Markup.button.callback('◀️ Назад', 'events_menu')
        ]]);
        
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
        return;
      }
      
      let message = '📋 *Список событий*\n\n';
      
      events.slice(0, 10).forEach((event, index) => {
        const statusEmoji = {
          'upcoming': '⏳',
          'active': '🟢',
          'betting_closed': '🔒',
          'finished': '✅',
          'cancelled': '❌'
        }[event.status] || '❓';
        
        message += `${index + 1}. ${statusEmoji} *${event.title}*\n`;
        message += `   Статус: ${event.status}\n`;
        message += `   Пул: ${event.totalPool.toFixed(2)} USDT\n`;
        message += `   ID: \`${event._id}\`\n\n`;
      });
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'events_list')],
        [Markup.button.callback('◀️ Назад', 'events_menu')]
      ]);
      
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
      console.error('ADMIN: Ошибка получения списка событий:', error);
      const errorMessage = `❌ Ошибка получения событий: ${error.message}`;
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(errorMessage);
      } else {
        await ctx.reply(errorMessage);
      }
    }
  }

  /**
   * Начать создание события
   */
  async function startEventCreation(ctx) {
    console.log('ADMIN: Начало создания события');
    
    ctx.session = ctx.session || {};
    ctx.session.creatingEvent = {
      step: 'title'
    };
    
    const message = '➕ *Создание нового события*\n\n' + 'Шаг 1/6: Введите название события:';
    const keyboard = Markup.inlineKeyboard([[
      Markup.button.callback('❌ Отмена', 'events_cancel')
    ]]);
    
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
  }

  /**
   * Начать завершение события
   */
  async function startEventFinishing(ctx) {
    console.log('ADMIN: Начало завершения события');
    
    ctx.session = ctx.session || {};
    ctx.session.finishingEvent = {
      step: 'eventId'
    };
    
    const message = '✅ *Завершение события*\n\n' + 'Введите ID события для завершения:';
    const keyboard = Markup.inlineKeyboard([[
      Markup.button.callback('❌ Отмена', 'events_cancel')
    ]]);
    
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
  }

  /**
   * Показать статистику событий
   */
  async function showEventsStats(ctx) {
    console.log('ADMIN: Запрос статистики событий');
    
    try {
      const response = await apiClient.get('/events/stats/general');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка получения статистики');
      }
      
      const stats = response.data.data;
      
      let message = '📊 *Статистика событий*\n\n';
      message += `📝 Всего событий: ${stats.totalEvents}\n`;
      message += `🟢 Активных событий: ${stats.activeEvents}\n`;
      message += `💰 Всего ставок: ${stats.totalBets}\n`;
      message += `💵 Общий объем: ${stats.totalVolume.toFixed(2)} USDT\n`;
      message += `💸 Общие выплаты: ${stats.totalPayout.toFixed(2)} USDT\n`;
      message += `🏦 Маржа казино: ${stats.houseEdge}%`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'events_stats')],
        [Markup.button.callback('◀️ Назад', 'events_menu')]
      ]);
      
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
      console.error('ADMIN: Ошибка получения статистики:', error);
      const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(errorMessage);
      } else {
        await ctx.reply(errorMessage);
      }
    }
  }

  /**
   * Обработка создания события
   */
  async function handleEventCreation(ctx) {
    if (!ctx.session || !ctx.session.creatingEvent) {
      return;
    }
    
    const eventData = ctx.session.creatingEvent;
    const text = ctx.message.text;
    
    console.log(`ADMIN: Шаг создания события: ${eventData.step}, текст: ${text}`);
    
    switch (eventData.step) {
      case 'title':
        eventData.title = text;
        eventData.step = 'description';
        await ctx.reply(
          '📝 Шаг 2/6: Введите описание события:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_cancel')
          ]])
        );
        break;
        
      case 'description':
        eventData.description = text;
        eventData.step = 'outcome1';
        await ctx.reply(
          '🎯 Шаг 3/6: Введите название первого исхода:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_cancel')
          ]])
        );
        break;
        
      case 'outcome1':
        eventData.outcome1 = text;
        eventData.step = 'outcome2';
        await ctx.reply(
          '🎯 Шаг 4/6: Введите название второго исхода:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_cancel')
          ]])
        );
        break;
        
      case 'outcome2':
        eventData.outcome2 = text;
        eventData.step = 'category';
        await ctx.reply(
          '📂 Шаг 5/6: Выберите категорию события:',
          Markup.inlineKeyboard([
            [
              Markup.button.callback('⚽ Спорт', 'event_category_sports'),
              Markup.button.callback('₿ Крипто', 'event_category_crypto')
            ],
            [
              Markup.button.callback('🗳️ Политика', 'event_category_politics'),
              Markup.button.callback('🎬 Развлечения', 'event_category_entertainment')
            ],
            [
              Markup.button.callback('🎯 Другое', 'event_category_other')
            ],
            [
              Markup.button.callback('❌ Отмена', 'events_cancel')
            ]
          ])
        );
        break;
        
      case 'duration':
        const hours = parseInt(text);
        if (isNaN(hours) || hours < 1 || hours > 720) {
          await ctx.reply('❌ Введите корректное количество часов (от 1 до 720):');
          return;
        }
        
        eventData.durationHours = hours;
        
        // Создаем событие
        await createEvent(ctx, eventData);
        break;
    }
  }

  /**
   * Обработка выбора категории
   */
  async function handleCategorySelection(ctx, category) {
    console.log(`ADMIN: Выбор категории: ${category}`);
    
    if (!ctx.session || !ctx.session.creatingEvent) {
      return ctx.answerCbQuery('❌ Сессия создания события истекла');
    }
    
    ctx.session.creatingEvent.category = category;
    ctx.session.creatingEvent.step = 'duration';
    
    await ctx.editMessageText(
      '⏰ Шаг 6/6: Введите продолжительность события в часах (1-720):',
      {
        ...Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'events_cancel')
        ]])
      }
    );
    
    await ctx.answerCbQuery();
  }

  /**
   * Создать событие - ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async function createEvent(ctx, eventData) {
    console.log('ADMIN: Создание события с данными:', eventData);
    
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + eventData.durationHours * 60 * 60 * 1000);
      const bettingEndsAt = new Date(endTime.getTime() - 30 * 60 * 1000);
      
      // Генерируем уникальные ID для исходов
      const outcome1Id = `outcome_${Date.now()}_1_${Math.random().toString(36).substring(2, 8)}`;
      const outcome2Id = `outcome_${Date.now()}_2_${Math.random().toString(36).substring(2, 8)}`;
      
      const createData = {
        title: eventData.title,
        description: eventData.description,
        outcomes: [
          { 
            id: outcome1Id,
            name: eventData.outcome1 
          },
          { 
            id: outcome2Id,
            name: eventData.outcome2 
          }
        ],
        category: eventData.category,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        bettingEndsAt: bettingEndsAt.toISOString(),
        featured: true,
        initialOdds: 2.0,
        minBet: 1,
        maxBet: 1000
      };
      
      console.log('ADMIN: Отправляем данные для создания события:', JSON.stringify(createData, null, 2));
      
      const response = await apiClient.post('/events/admin/create', createData);
      
      if (response.data.success) {
        const event = response.data.data.event;
        
        await ctx.reply(
          '✅ *Событие создано успешно!*\n\n' +
          `📝 Название: ${event.title}\n` +
          `📋 Описание: ${event.description}\n` +
          `🎯 Исходы: ${event.outcomes[0].name} / ${event.outcomes[1].name}\n` +
          `📂 Категория: ${event.category}\n` +
          `📊 Статус: ${event.status}\n` +
          `⏰ Окончание: ${new Date(event.endTime).toLocaleString('ru-RU')}\n` +
          `🆔 ID: \`${event._id}\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
              Markup.button.callback('📋 К списку событий', 'events_list')
            ]])
          }
        );
      } else {
        throw new Error(response.data.message);
      }
      
      // Очищаем сессию
      delete ctx.session.creatingEvent;
      
    } catch (error) {
      console.error('ADMIN: Ошибка создания события:', error);
      await ctx.reply(
        `❌ Ошибка создания события: ${error.response?.data?.message || error.message}`,
        Markup.inlineKeyboard([[
          Markup.button.callback('🔄 Попробовать снова', 'events_create')
        ]])
      );
      delete ctx.session.creatingEvent;
    }
  }

  /**
   * Обработка завершения события
   */
  async function handleEventFinishing(ctx) {
    if (!ctx.session || !ctx.session.finishingEvent) {
      return;
    }
    
    const text = ctx.message.text.trim();
    
    console.log(`ADMIN: Шаг завершения события: ${ctx.session.finishingEvent.step}, текст: ${text}`);
    
    if (ctx.session.finishingEvent.step === 'eventId') {
      try {
        console.log('ADMIN: Получение события для завершения:', text);
        
        const response = await apiClient.get(`/events/admin/${text}`);
        
        if (!response.data.success) {
          await ctx.reply('❌ Событие не найдено. Введите корректный ID:');
          return;
        }
        
        const event = response.data.data.event;
        
        if (event.status === 'finished') {
          await ctx.reply('❌ Событие уже завершено. Введите ID другого события:');
          return;
        }
        
        ctx.session.finishingEvent.eventId = text;
        ctx.session.finishingEvent.event = event;
        ctx.session.finishingEvent.step = 'outcome';
        
        await ctx.reply(
          `🎯 Событие: *${event.title}*\n\n` +
          'Выберите победивший исход:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  `1️⃣ ${event.outcomes[0].name}`, 
                  `finish_outcome_${event.outcomes[0].id}`
                )
              ],
              [
                Markup.button.callback(
                  `2️⃣ ${event.outcomes[1].name}`, 
                  `finish_outcome_${event.outcomes[1].id}`
                )
              ],
              [
                Markup.button.callback('❌ Отмена', 'events_cancel')
              ]
            ])
          }
        );
        
      } catch (error) {
        console.error('ADMIN: Ошибка получения события:', error);
        await ctx.reply('❌ Ошибка получения события. Проверьте ID и попробуйте снова:');
      }
    }
  }

  /**
   * Завершить событие с выбранным исходом
   */
  async function completeEventFinishing(ctx, outcomeId) {
    console.log(`ADMIN: Завершение события, исход: ${outcomeId}`);
    
    if (!ctx.session || !ctx.session.finishingEvent || !ctx.session.finishingEvent.eventId) {
      return ctx.answerCbQuery('❌ Сессия завершения события истекла');
    }
    
    try {
      const eventId = ctx.session.finishingEvent.eventId;
      const event = ctx.session.finishingEvent.event;
      
      console.log('ADMIN: Завершение события:', eventId, 'исход:', outcomeId);
      
      const response = await apiClient.put(`/events/admin/${eventId}/finish`, {
        winningOutcomeId: outcomeId
      });
      
      if (response.data.success) {
        const result = response.data.data;
        const winningOutcome = event.outcomes.find(o => o.id === outcomeId);
        
        await ctx.editMessageText(
          '✅ *Событие успешно завершено!*\n\n' +
          `📝 Событие: ${event.title}\n` +
          `🏆 Победитель: ${winningOutcome.name}\n` +
          `💰 Выигрышных ставок: ${result.settlementResults.winningBets}\n` +
          `📉 Проигрышных ставок: ${result.settlementResults.losingBets}\n` +
          `💵 Общие выплаты: ${result.settlementResults.totalPayout.toFixed(2)} USDT\n` +
          `🏦 Прибыль казино: ${result.houseProfit.toFixed(2)} USDT`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
              Markup.button.callback('📋 К списку событий', 'events_list')
            ]])
          }
        );
      } else {
        throw new Error(response.data.message);
      }
      
      delete ctx.session.finishingEvent;
      
    } catch (error) {
      console.error('ADMIN: Ошибка завершения события:', error);
      await ctx.answerCbQuery(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  }

  // === НОВЫЕ ФУНКЦИИ ДЛЯ ПОЛНОЦЕННОГО УПРАВЛЕНИЯ ===

  /**
   * Показать меню финансов
   */
  async function showFinancesMenu(ctx) {
    console.log('ADMIN: Показ меню финансов');
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Текущее состояние', 'finances_stats')],
      [Markup.button.callback('📈 Отчет за период', 'finances_report')],
      [Markup.button.callback('🎮 Статистика по играм', 'finances_games')],
      [Markup.button.callback('💰 Баланс казино', 'finances_balance')],
      [Markup.button.callback('◀️ Главное меню', 'main_menu')]
    ]);

    const message = '💰 *Финансовое управление*\n\nВыберите раздел для просмотра:';
    
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
      console.error('ADMIN: Ошибка показа меню финансов:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Показать финансовую статистику
   */
  async function showFinanceStats(ctx) {
    console.log('ADMIN: Запрос финансовой статистики');
    
    try {
      const response = await apiClient.get('/admin/finance/report');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка получения статистики');
      }
      
      const reportData = response.data.data;
      const current = reportData.current;
      
      let message = '📊 *ФИНАНСОВАЯ СТАТИСТИКА*\n\n';
      
      // Основные балансы
      message += '🏦 *Основные балансы:*\n';
      message += `💰 Баланс пользователей: \`${current.totalUserBalance?.toFixed(2) || '0.00'} USDT\`\n`;
      message += `💰 Оперативный баланс: \`${current.operationalBalance?.toFixed(2) || '0.00'} USDT\`\n`;
      message += `💰 Резерв (${current.reservePercentage || 0}%): \`${current.reserveBalance?.toFixed(2) || '0.00'} USDT\`\n`;
      message += `✅ Доступно для вывода: \`${current.availableForWithdrawal?.toFixed(2) || '0.00'} USDT\`\n\n`;
      
      // Предупреждения
      if (current.warnings && Object.keys(current.warnings).length > 0) {
        const warningsList = [];
        if (current.warnings.lowReserve) warningsList.push('⚠️ Низкий резерв');
        if (current.warnings.highRiskRatio) warningsList.push('🔴 Высокий риск');
        if (current.warnings.negativeOperational) warningsList.push('⚠️ Отрицательный баланс');
        
        if (warningsList.length > 0) {
          message += '⚠️ *Предупреждения:*\n';
          warningsList.forEach(warning => {
            message += `• ${warning}\n`;
          });
          message += '\n';
        }
      }
      
      // Статистика за период
      if (reportData.period) {
        message += `📊 *За сегодня:*\n`;
        message += `   Игр: ${reportData.period.games?.count || 0}\n`;
        message += `   Ставки: \`${reportData.period.games?.totalBets?.toFixed(2) || '0.00'} USDT\`\n`;
        message += `   Выплаты: \`${reportData.period.games?.totalWins?.toFixed(2) || '0.00'} USDT\`\n`;
        message += `   Прибыль: \`${reportData.period.games?.profit?.toFixed(2) || '0.00'} USDT\`\n\n`;
      }
      
      // Формула расчета
      message += '📊 *Формула оперативного баланса:*\n';
      message += '_Ставки - Выигрыши + Комиссии - Промокоды_';
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Комиссии', 'stats_commission'),
          Markup.button.callback('🔄 Обновить', 'finances_stats')
        ],
        [Markup.button.callback('◀️ Назад', 'finances_menu')]
      ]);
      
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
      console.error('ADMIN: Ошибка получения финансовой статистики:', error);
      const errorMessage = `❌ Ошибка получения статистики: ${error.response?.data?.message || error.message}`;
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(errorMessage);
      } else {
        await ctx.reply(errorMessage);
      }
    }
  }

  /**
   * Показать финансовый отчет
   */
  async function showFinanceReport(ctx) {
    console.log('ADMIN: Запрос финансового отчета');
    
    try {
      const response = await apiClient.get('/admin/finance/report', {
        params: { period: 'week' }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка получения отчета');
      }
      
      const report = response.data.data;
      
      let message = '📈 *Финансовый отчет за неделю*\n\n';
      message += `💵 *Доходы:* ${report.income?.toFixed(2) || '0.00'} USDT\n`;
      message += `💸 *Расходы:* ${report.expenses?.toFixed(2) || '0.00'} USDT\n`;
      message += `📊 *Чистая прибыль:* ${report.netProfit?.toFixed(2) || '0.00'} USDT\n`;
      message += `📈 *ROI:* ${report.roi?.toFixed(1) || '0.0'}%\n\n`;
      message += `🎰 *Игры:*\n`;
      message += `   Общий объем ставок: ${report.totalBets?.toFixed(2) || '0.00'} USDT\n`;
      message += `   Общие выплаты: ${report.totalPayouts?.toFixed(2) || '0.00'} USDT\n`;
      message += `   House Edge: ${report.houseEdge?.toFixed(1) || '0.0'}%\n\n`;
      message += `🏦 *Транзакции:*\n`;
      message += `   Депозиты: ${report.deposits?.toFixed(2) || '0.00'} USDT\n`;
      message += `   Выводы: ${report.withdrawals?.toFixed(2) || '0.00'} USDT\n`;
      message += `   Комиссии: ${report.fees?.toFixed(2) || '0.00'} USDT`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📅 День', 'report_day'),
          Markup.button.callback('📅 Месяц', 'report_month')
        ],
        [Markup.button.callback('🔄 Обновить', 'finances_report')],
        [Markup.button.callback('◀️ Назад', 'finances_menu')]
      ]);
      
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
      console.error('ADMIN: Ошибка получения отчета:', error);
      const errorMessage = `❌ Ошибка получения отчета: ${error.message}`;
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(errorMessage);
      } else {
        await ctx.reply(errorMessage);
      }
    }
  }

  /**
   * Показать статистику по играм
   */
  async function showGameFinanceStats(ctx) {
    console.log('ADMIN: Запрос статистики по играм');
    
    try {
      const response = await apiClient.get('/admin/finance/game-stats');
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка получения статистики');
      }
      
      const stats = response.data.data;
      
      let message = '🎮 *Статистика по играм*\n\n';
      
      if (stats.coin) {
        message += `🪙 *Coin Flip:*\n`;
        message += `   Игр: ${stats.coin.gamesCount || 0}\n`;
        message += `   Ставки: ${stats.coin.totalBets?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Выплаты: ${stats.coin.totalPayouts?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Прибыль: ${stats.coin.profit?.toFixed(2) || '0.00'} USDT\n\n`;
      }
      
      if (stats.crash) {
        message += `🚀 *Crash:*\n`;
        message += `   Раундов: ${stats.crash.roundsCount || 0}\n`;
        message += `   Ставки: ${stats.crash.totalBets?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Выплаты: ${stats.crash.totalPayouts?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Прибыль: ${stats.crash.profit?.toFixed(2) || '0.00'} USDT\n\n`;
      }
      
      if (stats.slots) {
        message += `🎰 *Slots:*\n`;
        message += `   Игр: ${stats.slots.gamesCount || 0}\n`;
        message += `   Ставки: ${stats.slots.totalBets?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Выплаты: ${stats.slots.totalPayouts?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Прибыль: ${stats.slots.profit?.toFixed(2) || '0.00'} USDT\n\n`;
      }
      
      if (stats.mines) {
        message += `💣 *Mines:*\n`;
        message += `   Игр: ${stats.mines.gamesCount || 0}\n`;
        message += `   Ставки: ${stats.mines.totalBets?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Выплаты: ${stats.mines.totalPayouts?.toFixed(2) || '0.00'} USDT\n`;
        message += `   Прибыль: ${stats.mines.profit?.toFixed(2) || '0.00'} USDT`;
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'finances_games')],
        [Markup.button.callback('◀️ Назад', 'finances_menu')]
      ]);
      
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
      console.error('ADMIN: Ошибка получения статистики игр:', error);
      const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
      
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(errorMessage);
      } else {
        await ctx.reply(errorMessage);
      }
    }
  }

  /**
   * Показать меню пользователей
   */
  async function showUsersMenu(ctx) {
    console.log('ADMIN: Показ меню пользователей');
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👥 Список пользователей', 'users_list')],
      [Markup.button.callback('🔍 Поиск пользователя', 'users_search')],
      [Markup.button.callback('📊 Статистика пользователей', 'users_stats')],
      [Markup.button.callback('🚫 Заблокированные', 'users_blocked')],
      [Markup.button.callback('◀️ Главное меню', 'main_menu')]
    ]);

    const message = '👥 *Управление пользователями*\n\nВыберите действие:';
    
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
      console.error('ADMIN: Ошибка показа меню пользователей:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Показать меню транзакций
   */
  async function showTransactionsMenu(ctx) {
    console.log('ADMIN: Показ меню транзакций');
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Ожидающие одобрения', 'transactions_pending')],
      [Markup.button.callback('📋 История транзакций', 'transactions_history')],
      [Markup.button.callback('💰 Статистика выводов', 'transactions_stats')],
      [Markup.button.callback('🏦 Депозиты', 'transactions_deposits')],
      [Markup.button.callback('◀️ Главное меню', 'main_menu')]
    ]);

    const message = '🏦 *Управление транзакциями*\n\nВыберите раздел:';
    
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
      console.error('ADMIN: Ошибка показа меню транзакций:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Показать меню коэффициентов
   */
  async function showCoefficientsMenu(ctx) {
    console.log('ADMIN: Показ меню коэффициентов');
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🌍 Глобальные настройки', 'coefficients_global')],
      [Markup.button.callback('👤 Пользовательские', 'coefficients_users')],
      [Markup.button.callback('📊 Статистика модификаторов', 'coefficients_stats')],
      [Markup.button.callback('🔄 Сбросить все', 'coefficients_reset')],
      [Markup.button.callback('◀️ Главное меню', 'main_menu')]
    ]);

    const message = '🎯 *Управление коэффициентами*\n\nВыберите тип настроек:';
    
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
      console.error('ADMIN: Ошибка показа меню коэффициентов:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * Показать меню настроек
   */
  async function showSettingsMenu(ctx) {
    console.log('ADMIN: Показ меню настроек');
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎮 Настройки игр', 'settings_games')],
      [Markup.button.callback('💰 Финансовые настройки', 'settings_finance')],
      [Markup.button.callback('🔔 Уведомления', 'settings_notifications')],
      [Markup.button.callback('🛡️ Безопасность', 'settings_security')],
      [Markup.button.callback('◀️ Главное меню', 'main_menu')]
    ]);

    const message = '⚙️ *Системные настройки*\n\nВыберите категорию:';
    
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
      console.error('ADMIN: Ошибка показа меню настроек:', error);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  // === ИМПОРТ ФУНКЦИЙ ИЗ МОДУЛЕЙ ===
  
  // Импортируем функции управления пользователями (только существующие модули)
  let usersCommands, transactionsCommands, coefficientsCommands, promoCommands;
  let securityCommands, monitoringCommands, backupCommands, notificationsCommands;
  
  try {
    usersCommands = require('./users.command');
  } catch (e) {
    console.warn('users.command module not found');
    usersCommands = { 
      showUsersList: async (ctx) => await ctx.reply('❌ Функция списка пользователей временно недоступна'),
      startUserSearch: async (ctx) => await ctx.reply('❌ Функция поиска пользователей временно недоступна'),
      handleUserSearch: async (ctx) => await ctx.reply('❌ Функция обработки поиска пользователей временно недоступна'),
      showUsersStats: async (ctx) => await ctx.reply('❌ Функция статистики пользователей временно недоступна'),
      showUserDetails: async (ctx) => await ctx.reply('❌ Функция деталей пользователя временно недоступна'),
      toggleUserBlock: async (ctx) => await ctx.reply('❌ Функция блокировки пользователей временно недоступна'),
      startBalanceAdjustment: async (ctx) => await ctx.reply('❌ Функция изменения баланса временно недоступна'),
      handleBalanceAdjustment: async (ctx) => await ctx.reply('❌ Функция обработки изменения баланса временно недоступна')
    };
  }
  
  try {
    transactionsCommands = require('./transactions.command');
  } catch (e) {
    console.warn('transactions.command module not found');
    transactionsCommands = { 
      showPendingWithdrawals: async (ctx) => await ctx.reply('❌ Функция ожидающих выводов временно недоступна'),
      showTransactionsHistory: async (ctx) => await ctx.reply('❌ Функция истории транзакций временно недоступна'),
      showTransactionsStats: async (ctx) => await ctx.reply('❌ Функция статистики транзакций временно недоступна'),
      showDepositsInfo: async (ctx) => await ctx.reply('❌ Функция информации о депозитах временно недоступна'),
      approveWithdrawal: async (ctx) => await ctx.reply('❌ Функция одобрения выводов временно недоступна'),
      rejectWithdrawal: async (ctx) => await ctx.reply('❌ Функция отклонения выводов временно недоступна')
    };
  }
  
  try {
    coefficientsCommands = require('./coefficients.command');
  } catch (e) {
    console.warn('coefficients.command module not found');
    coefficientsCommands = { 
      showGlobalCoefficients: async (ctx) => await ctx.reply('❌ Функция глобальных коэффициентов временно недоступна'),
      showUserCoefficients: async (ctx) => await ctx.reply('❌ Функция пользовательских коэффициентов временно недоступна'),
      handleCoefficientSetting: async (ctx) => await ctx.reply('❌ Функция настройки коэффициентов временно недоступна'),
      showCoefficientsStats: async (ctx) => await ctx.reply('❌ Функция статистики коэффициентов временно недоступна'),
      resetAllModifiers: async (ctx) => await ctx.reply('❌ Функция сброса модификаторов временно недоступна'),
      toggleModifierMode: async (ctx) => await ctx.reply('❌ Функция переключения режима временно недоступна')
    };
  }
  
  try {
    promoCommands = require('./promo.command');
  } catch (e) {
    console.warn('promo.command module not found');
    promoCommands = { showPromoMenu: () => {} };
  }
  
  try {
    securityCommands = require('./security.command');
  } catch (e) {
    console.warn('security.command module not found');
    securityCommands = { 
      showSecurityMenu: async (ctx) => await ctx.reply('❌ Модуль безопасности временно недоступен'),
      showSecurityAlerts: async (ctx) => await ctx.reply('❌ Функция алертов временно недоступна'),
      showAuditLog: async (ctx) => await ctx.reply('❌ Функция аудита временно недоступна'),
      showSuspiciousActivity: async (ctx) => await ctx.reply('❌ Функция мониторинга активности временно недоступна')
    };
  }
  
  try {
    monitoringCommands = require('./monitoring.command');
  } catch (e) {
    console.warn('monitoring.command module not found');
    monitoringCommands = { 
      showMonitoringMenu: async (ctx) => await ctx.reply('❌ Модуль мониторинга временно недоступен'),
      showSystemMetrics: async (ctx) => await ctx.reply('❌ Функция системных метрик временно недоступна'),
      showPerformanceMetrics: async (ctx) => await ctx.reply('❌ Функция метрик производительности временно недоступна'),
      showOnlineUsers: async (ctx) => await ctx.reply('❌ Функция онлайн пользователей временно недоступна'),
      showFinancialMonitoring: async (ctx) => await ctx.reply('❌ Функция финансового мониторинга временно недоступна'),
      showActiveAlerts: async (ctx) => await ctx.reply('❌ Функция активных алертов временно недоступна')
    };
  }
  
  try {
    backupCommands = require('./backup.command');
  } catch (e) {
    console.warn('backup.command module not found');
    backupCommands = { 
      showBackupMenu: async (ctx) => await ctx.reply('❌ Модуль бэкапов временно недоступен'),
      createBackup: async (ctx) => await ctx.reply('❌ Функция создания бэкапов временно недоступна'),
      showBackupList: async (ctx) => await ctx.reply('❌ Функция списка бэкапов временно недоступна'),
      showBackupStats: async (ctx) => await ctx.reply('❌ Функция статистики бэкапов временно недоступна')
    };
  }
  
  try {
    notificationsCommands = require('./notifications.command');
  } catch (e) {
    console.warn('notifications.command module not found');
    notificationsCommands = { 
      showNotificationsMenu: async (ctx) => await ctx.reply('❌ Модуль уведомлений временно недоступен'),
      startNotificationCreation: async (ctx) => await ctx.reply('❌ Функция создания уведомлений временно недоступна'),
      showNotificationsHistory: async (ctx) => await ctx.reply('❌ Функция истории уведомлений временно недоступна'),
      showNotificationsStats: async (ctx) => await ctx.reply('❌ Функция статистики уведомлений временно недоступна')
    };
  }

  // === ДЕЛЕГИРОВАНИЕ К МОДУЛЯМ ===
  
  // Пользователи
  async function showUsersList(ctx, page) {
    try {
      return await usersCommands.showUsersList(ctx, page);
    } catch (error) {
      console.error('ADMIN: Ошибка показа списка пользователей:', error);
      await ctx.reply('❌ Функция списка пользователей временно недоступна');
    }
  }

  async function startUserSearch(ctx) {
    try {
      return await usersCommands.startUserSearch(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка начала поиска пользователей:', error);
      await ctx.reply('❌ Функция поиска пользователей временно недоступна');
    }
  }

  async function handleUserSearch(ctx) {
    try {
      return await usersCommands.handleUserSearch(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка обработки поиска пользователей:', error);
      await ctx.reply('❌ Функция поиска пользователей временно недоступна');
    }
  }

  async function showUsersStats(ctx) {
    try {
      return await usersCommands.showUsersStats(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа статистики пользователей:', error);
      await ctx.reply('❌ Функция статистики пользователей временно недоступна');
    }
  }

  // Транзакции
  async function showPendingWithdrawals(ctx) {
    try {
      return await transactionsCommands.showPendingWithdrawals(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа ожидающих выводов:', error);
      await ctx.reply('❌ Функция управления выводами временно недоступна');
    }
  }

  async function showTransactionsHistory(ctx, page) {
    try {
      return await transactionsCommands.showTransactionsHistory(ctx, page);
    } catch (error) {
      console.error('ADMIN: Ошибка показа истории транзакций:', error);
      await ctx.reply('❌ Функция истории транзакций временно недоступна');
    }
  }

  async function showTransactionsStats(ctx) {
    try {
      return await transactionsCommands.showTransactionsStats(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа статистики транзакций:', error);
      await ctx.reply('❌ Функция статистики транзакций временно недоступна');
    }
  }

  async function showDepositsInfo(ctx) {
    try {
      return await transactionsCommands.showDepositsInfo(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа информации о депозитах:', error);
      await ctx.reply('❌ Функция информации о депозитах временно недоступна');
    }
  }

  // Коэффициенты
  async function showGlobalCoefficients(ctx) {
    try {
      return await coefficientsCommands.showGlobalCoefficients(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа глобальных коэффициентов:', error);
      await ctx.reply('❌ Функция управления коэффициентами временно недоступна');
    }
  }

  async function showUserCoefficients(ctx) {
    try {
      return await coefficientsCommands.showUserCoefficients(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа пользовательских коэффициентов:', error);
      await ctx.reply('❌ Функция пользовательских коэффициентов временно недоступна');
    }
  }

  async function handleCoefficientSetting(ctx) {
    try {
      return await coefficientsCommands.handleCoefficientSetting(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка настройки коэффициентов:', error);
      await ctx.reply('❌ Функция настройки коэффициентов временно недоступна');
    }
  }

  async function showCoefficientsStats(ctx) {
    try {
      return await coefficientsCommands.showCoefficientsStats(ctx);
    } catch (error) {
      console.error('ADMIN: Ошибка показа статистики коэффициентов:', error);
      await ctx.reply('❌ Функция статистики коэффициентов временно недоступна');
    }
  }

  // === HELPER FUNCTIONS ===
  
  /**
   * Безопасное редактирование сообщения - предотвращает ошибки "message is not modified"
   */
  async function safeEditMessage(ctx, text, options = {}) {
    try {
      if (ctx.callbackQuery) {
        // Сравниваем текущий текст с новым
        const currentText = ctx.callbackQuery.message.text;
        if (currentText === text) {
          console.log('ADMIN: Контент идентичен, пропускаем editMessageText');
          return;
        }
        await ctx.editMessageText(text, options);
      } else {
        await ctx.reply(text, options);
      }
    } catch (error) {
      if (error.message.includes('message is not modified')) {
        console.log('ADMIN: Сообщение не изменено, игнорируем ошибку');
        return;
      }
      console.error('ADMIN: Ошибка редактирования сообщения:', error);
      // Fallback - отправляем новое сообщение
      await ctx.reply(text, options);
    }
  }

  return bot;
}

module.exports = {
  registerCommands
};
