// admin/src/commands/index.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

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
      `👋 Привет, ${first_name}!\n\nЭто административный бот для управления Greenlight Casino.\n\nИспользуйте команды для получения статистики и управления системой.`,
      Markup.keyboard([
        ['📊 Статистика', '👥 Пользователи'],
        ['🎮 Игры', '🔮 События'],
        ['💰 Финансы', '⚙️ Настройки']
      ]).resize()
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

  // === CALLBACK ОБРАБОТЧИКИ ДЛЯ СОБЫТИЙ ===
  
  // Главное меню событий
  bot.action('events_menu', async (ctx) => {
    console.log('ADMIN: Callback events_menu');
    await ctx.answerCbQuery();
    await showEventsMenu(ctx);
  });
  
  // Список событий
  bot.action('events_list', async (ctx) => {
    console.log('ADMIN: Callback events_list');
    await ctx.answerCbQuery();
    await showEventsList(ctx);
  });
  
  // Создание события
  bot.action('events_create', async (ctx) => {
    console.log('ADMIN: Callback events_create');
    await ctx.answerCbQuery();
    await startEventCreation(ctx);
  });
  
  // Завершение события
  bot.action('events_finish', async (ctx) => {
    console.log('ADMIN: Callback events_finish');
    await ctx.answerCbQuery();
    await startEventFinishing(ctx);
  });
  
  // Статистика событий
  bot.action('events_stats', async (ctx) => {
    console.log('ADMIN: Callback events_stats');
    await ctx.answerCbQuery();
    await showEventsStats(ctx);
  });
  
  // Выбор категории события
  bot.action(/^event_category_(.+)$/, async (ctx) => {
    console.log('ADMIN: Callback event_category:', ctx.match[1]);
    const category = ctx.match[1];
    await handleCategorySelection(ctx, category);
  });
  
  // Завершение события с выбором исхода
  bot.action(/^finish_outcome_(.+)$/, async (ctx) => {
    console.log('ADMIN: Callback finish_outcome:', ctx.match[1]);
    const outcomeId = ctx.match[1];
    await ctx.answerCbQuery();
    await completeEventFinishing(ctx, outcomeId);
  });
  
  // Отмена действий событий
  bot.action('events_cancel', async (ctx) => {
    console.log('ADMIN: Callback events_cancel');
    await ctx.answerCbQuery('Отменено');
    
    if (ctx.session) {
      delete ctx.session.creatingEvent;
      delete ctx.session.finishingEvent;
    }
    
    await showEventsMenu(ctx);
  });
  
  // Главное меню
  bot.action('main_menu', async (ctx) => {
    console.log('ADMIN: Callback main_menu');
    await ctx.answerCbQuery();
    
    await ctx.reply(
      '🏠 Главное меню администратора',
      Markup.keyboard([
        ['📊 Статистика', '👥 Пользователи'],
        ['🎮 Игры', '🔮 События'],
        ['💰 Финансы', '⚙️ Настройки']
      ]).resize()
    );
  });

  // === ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ДЛЯ СОБЫТИЙ ===
  
  // Обработка текстовых сообщений
  bot.on('text', async (ctx, next) => {
    console.log('ADMIN: Получено текстовое сообщение:', ctx.message.text);
    
    // Проверяем, если это процесс создания события
    if (ctx.session && ctx.session.creatingEvent) {
      console.log('ADMIN: Обрабатываем создание события');
      await handleEventCreation(ctx);
      return;
    }
    
    // Проверяем, если это процесс завершения события
    if (ctx.session && ctx.session.finishingEvent) {
      console.log('ADMIN: Обрабатываем завершение события');
      await handleEventFinishing(ctx);
      return;
    }
    
    // Передаем управление следующему обработчику
    return next();
  });

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

  return bot;
}

module.exports = {
  registerCommands
};
