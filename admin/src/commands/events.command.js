// admin/src/commands/events.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// API URL и токен
const apiUrl = process.env.API_URL || 'https://api.greenlight-casino.eu/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Логируем URL для отладки
console.log('EVENTS COMMAND: API URL:', apiUrl);

// Создаем axios instance
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
  console.log(`📤 EVENTS API Request: ${request.method.toUpperCase()} ${request.url}`);
  return request;
}, error => {
  console.error('❌ Events Request Error:', error);
  return Promise.reject(error);
});

apiClient.interceptors.response.use(response => {
  console.log(`✅ EVENTS API Response: ${response.status} ${response.config.url}`);
  return response;
}, error => {
  console.error(`❌ EVENTS API Error: ${error.response?.status} ${error.config?.url}`);
  console.error('   Error Data:', error.response?.data);
  return Promise.reject(error);
});

/**
 * Команды для управления событиями
 */
const eventsCommands = {
  /**
   * Показать главное меню событий
   */
  async showEventsMenu(ctx) {
    console.log('ADMIN: Показ меню событий');
    
    const message = '🔮 *Управление событиями*\n\nВыберите действие:';
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Список событий', 'events_list')],
      [Markup.button.callback('➕ Создать событие', 'events_create')],
      [Markup.button.callback('✅ Завершить событие', 'events_finish')],
      [Markup.button.callback('⭐ Главное событие', 'events_featured')],
      [Markup.button.callback('📊 Статистика событий', 'events_stats')],
      [Markup.button.callback('🔙 Назад', 'main_menu')]
    ]);

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
  },

  /**
   * Показать список событий
   */
  async showEventsList(ctx) {
    try {
      const response = await apiClient.get('/events/admin/all');
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Ошибка получения событий');
      }
      
      const events = response.data.data.events;
      
      if (events.length === 0) {
        return ctx.editMessageText(
          '📋 *Список событий*\n\n' +
          'События не найдены.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
              Markup.button.callback('◀️ Назад', 'events_menu')
            ]])
          }
        );
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
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('EVENTS: Ошибка получения списка событий:', error);
      await ctx.answerCbQuery('❌ Ошибка получения событий');
    }
  },

  /**
   * Начать создание события
   */
  async startEventCreation(ctx) {
    ctx.session = ctx.session || {};
    ctx.session.creatingEvent = {
      step: 'title'
    };
    
    await ctx.editMessageText(
      '➕ *Создание нового события*\n\n' +
      'Шаг 1/6: Введите название события:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'events_menu')
        ]])
      }
    );
  },

  /**
   * Обработка создания события
   */
  async handleEventCreation(ctx) {
    if (!ctx.session || !ctx.session.creatingEvent) {
      return;
    }
    
    const eventData = ctx.session.creatingEvent;
    const text = ctx.message.text;
    
    switch (eventData.step) {
      case 'title':
        eventData.title = text;
        eventData.step = 'description';
        await ctx.reply(
          '📝 Шаг 2/6: Введите описание события:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_menu')
          ]])
        );
        break;
        
      case 'description':
        eventData.description = text;
        eventData.step = 'outcome1';
        await ctx.reply(
          '🎯 Шаг 3/6: Введите название первого исхода:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_menu')
          ]])
        );
        break;
        
      case 'outcome1':
        eventData.outcome1 = text;
        eventData.step = 'outcome2';
        await ctx.reply(
          '🎯 Шаг 4/6: Введите название второго исхода:',
          Markup.inlineKeyboard([[
            Markup.button.callback('❌ Отмена', 'events_menu')
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
              Markup.button.callback('❌ Отмена', 'events_menu')
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
        await this.createEvent(ctx, eventData);
        break;
    }
  },

  /**
   * Обработка выбора категории
   */
  async handleCategorySelection(ctx, category) {
    if (!ctx.session || !ctx.session.creatingEvent) {
      return ctx.answerCbQuery('❌ Сессия создания события истекла');
    }
    
    ctx.session.creatingEvent.category = category;
    ctx.session.creatingEvent.step = 'duration';
    
    await ctx.editMessageText(
      '⏰ Шаг 6/6: Введите продолжительность события в часах (1-720):',
      {
        ...Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'events_menu')
        ]])
      }
    );
    
    await ctx.answerCbQuery();
  },

  /**
   * Создать событие
   */
  async createEvent(ctx, eventData) {
    try {
      const now = new Date();
      // Добавляем 1 минуту к текущему времени, чтобы избежать ошибки "время в прошлом"
      const startTime = new Date(now.getTime() + 60 * 1000);
      const endTime = new Date(startTime.getTime() + eventData.durationHours * 60 * 60 * 1000);
      const bettingEndsAt = new Date(endTime.getTime() - 30 * 60 * 1000); // За 30 минут до окончания
      
      const createData = {
        title: eventData.title,
        description: eventData.description,
        outcomes: [
          { name: eventData.outcome1 },
          { name: eventData.outcome2 }
        ],
        category: eventData.category,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        bettingEndsAt: bettingEndsAt.toISOString(),
        featured: true, // Делаем новое событие главным
        initialOdds: 2.0,
        minBet: 1,
        maxBet: 1000
      };
      
      console.log('EVENTS: Отправляем данные для создания события:', JSON.stringify(createData, null, 2));
      
      const response = await apiClient.post('/events/admin/create', createData);
      
      if (response.data.success) {
        const event = response.data.data.event;
        
        await ctx.reply(
          '✅ *Событие создано успешно!*\n\n' +
          `📝 Название: ${event.title}\n` +
          `📋 Описание: ${event.description}\n` +
          `🎯 Исходы: ${event.outcomes[0].name} / ${event.outcomes[1].name}\n` +
          `📂 Категория: ${event.category}\n` +
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
      console.error('EVENTS: Ошибка создания события:', error);
      await ctx.reply(
        `❌ Ошибка создания события: ${error.response?.data?.message || error.message}`,
        Markup.inlineKeyboard([[
          Markup.button.callback('🔄 Попробовать снова', 'events_create')
        ]])
      );
      delete ctx.session.creatingEvent;
    }
  },

  /**
   * Завершить событие
   */
  async finishEvent(ctx) {
    ctx.session = ctx.session || {};
    ctx.session.finishingEvent = {
      step: 'eventId'
    };
    
    await ctx.editMessageText(
      '✅ *Завершение события*\n\n' +
      'Введите ID события для завершения:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'events_menu')
        ]])
      }
    );
  },

  /**
   * Обработка завершения события
   */
  async handleEventFinishing(ctx) {
    if (!ctx.session || !ctx.session.finishingEvent) {
      return;
    }
    
    const text = ctx.message.text.trim();
    
    // Игнорируем обычные кнопки меню и эмодзи-команды
    const menuCommands = ['📊 Финансы', '👥 Пользователи', '💳 Транзакции', '🎯 События', 
                         '🎁 Промокоды', '📊 Статистика', '🎮 Коэффициенты', '📊 Мониторинг',
                         '📢 Уведомления', '🛡️ Безопасность', '💾 Бэкапы', '⚙️ Настройки',
                         '🔮 События', '🏦 Транзакции'];
    
    if (menuCommands.includes(text) || text.includes('🏠') || text.includes('🔙')) {
      // Очищаем сессию и обрабатываем как обычную команду меню
      delete ctx.session.finishingEvent;
      return;
    }
    
    if (ctx.session.finishingEvent.step === 'eventId') {
      try {
        // Получаем событие
        const response = await apiClient.get(`/events/${text}`);
        
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
                Markup.button.callback('❌ Отмена', 'events_menu')
              ]
            ])
          }
        );
        
      } catch (error) {
        console.error('EVENTS: Ошибка получения события:', error);
        await ctx.reply('❌ Ошибка получения события. Проверьте ID и попробуйте снова:');
      }
    }
  },

  /**
   * Завершить событие с выбранным исходом
   */
  async completeEventFinishing(ctx, outcomeId) {
    if (!ctx.session || !ctx.session.finishingEvent || !ctx.session.finishingEvent.eventId) {
      return ctx.answerCbQuery('❌ Сессия завершения события истекла');
    }
    
    try {
      const eventId = ctx.session.finishingEvent.eventId;
      const event = ctx.session.finishingEvent.event;
      
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
      await ctx.answerCbQuery('✅ Событие завершено');
      
    } catch (error) {
      console.error('EVENTS: Ошибка завершения события:', error);
      await ctx.answerCbQuery(`❌ Ошибка: ${error.response?.data?.message || error.message}`);
    }
  },

  /**
   * Показать статистику событий
   */
  async showEventsStats(ctx) {
    try {
      const response = await apiClient.get('/events/stats/general');
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Ошибка получения статистики');
      }
      
      const stats = response.data.data;
      
      let message = '📊 *Статистика событий*\n\n';
      
      if (stats.events && stats.events.length > 0) {
        message += '🎯 События:\n';
        stats.events.forEach(stat => {
          const statusNames = {
            'upcoming': 'Предстоящие',
            'active': 'Активные',
            'betting_closed': 'Ставки закрыты',
            'finished': 'Завершенные',
            'cancelled': 'Отмененные'
          };
          
          message += `├ ${statusNames[stat._id] || stat._id}: ${stat.count} (${stat.totalPool.toFixed(2)} USDT)\n`;
        });
        message += '\n';
      }
      
      if (stats.bets && stats.bets.length > 0) {
        message += '💰 Ставки:\n';
        stats.bets.forEach(stat => {
          const statusNames = {
            'active': 'Активные',
            'won': 'Выигрышные',
            'lost': 'Проигрышные',
            'cancelled': 'Отмененные',
            'refunded': 'Возвращенные'
          };
          
          message += `├ ${statusNames[stat._id] || stat._id}: ${stat.count} (${stat.totalAmount.toFixed(2)} USDT)\n`;
        });
      }
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'events_stats')],
        [Markup.button.callback('◀️ Назад', 'events_menu')]
      ]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('EVENTS: Ошибка получения статистики:', error);
      await ctx.answerCbQuery('❌ Ошибка получения статистики');
    }
  },

  /**
   * Управление главным событием
   */
  async manageFeaturedEvent(ctx) {
    try {
      // Получаем список активных событий
      const response = await apiClient.get('/events/admin/all?status=active');
      
      if (!response.data.success) {
        return ctx.answerCbQuery('❌ Ошибка получения событий');
      }
      
      const events = response.data.data.events;
      
      if (events.length === 0) {
        return ctx.editMessageText(
          '⭐ *Управление главным событием*\n\n' +
          'Нет активных событий для назначения главным.',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[
              Markup.button.callback('🔙 Назад', 'events_menu')
            ]])
          }
        );
      }
      
      // Находим текущее главное событие
      const featuredEvent = events.find(e => e.featured);
      
      let message = '⭐ *Управление главным событием*\n\n';
      
      if (featuredEvent) {
        message += `🔖 Текущее главное событие:\n`;
        message += `📝 ${featuredEvent.title}\n`;
        message += `🆔 ID: \`${featuredEvent._id}\`\n\n`;
      } else {
        message += '❌ Главное событие не назначено\n\n';
      }
      
      message += '📋 Выберите событие для назначения главным:';
      
      const buttons = [];
      
      // Показываем первые 8 активных событий
      events.slice(0, 8).forEach((event, index) => {
        const isFeatured = event.featured ? '⭐ ' : '';
        buttons.push([Markup.button.callback(
          `${index + 1}. ${isFeatured}${event.title.substring(0, 40)}...`,
          `set_featured_${event._id}`
        )]);
      });
      
      if (featuredEvent) {
        buttons.push([Markup.button.callback('❌ Убрать главное событие', 'unset_featured')]);
      }
      
      buttons.push([Markup.button.callback('🔙 Назад', 'events_menu')]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (error) {
      console.error('EVENTS: Ошибка управления главным событием:', error);
      await ctx.answerCbQuery('❌ Ошибка получения событий');
    }
  },

  /**
   * Установить событие как главное
   */
  async setFeaturedEvent(ctx, eventId) {
    try {
      const response = await apiClient.patch(`/events/admin/${eventId}/featured`, {
        featured: true
      });
      
      if (response.data.success) {
        await ctx.answerCbQuery('✅ Главное событие установлено');
        await this.manageFeaturedEvent(ctx);
      } else {
        await ctx.answerCbQuery('❌ Ошибка установки главного события');
      }
      
    } catch (error) {
      console.error('EVENTS: Ошибка установки главного события:', error);
      await ctx.answerCbQuery('❌ Ошибка установки главного события');
    }
  },

  /**
   * Убрать главное событие
   */
  async unsetFeaturedEvent(ctx) {
    try {
      const response = await apiClient.patch('/events/admin/featured/unset');
      
      if (response.data.success) {
        await ctx.answerCbQuery('✅ Главное событие убрано');
        await this.manageFeaturedEvent(ctx);
      } else {
        await ctx.answerCbQuery('❌ Ошибка снятия главного события');
      }
      
    } catch (error) {
      console.error('EVENTS: Ошибка снятия главного события:', error);
      await ctx.answerCbQuery('❌ Ошибка снятия главного события');
    }
  }
};

module.exports = eventsCommands;
