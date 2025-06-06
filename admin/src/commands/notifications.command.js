// admin/src/commands/notifications.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Создаем axios instance с предустановленными заголовками
const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 60000 // Увеличенный таймаут для массовых операций
});

/**
 * Показать главное меню массовых уведомлений
 */
async function showNotificationsMenu(ctx) {
  console.log('ADMIN: Показ меню массовых уведомлений');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📢 Создать рассылку', 'notifications_create')],
    [Markup.button.callback('📋 История рассылок', 'notifications_history')],
    [Markup.button.callback('📊 Статистика уведомлений', 'notifications_stats')],
    [Markup.button.callback('👥 Управление подписками', 'notifications_subscriptions')],
    [Markup.button.callback('📝 Шаблоны сообщений', 'notifications_templates')],
    [Markup.button.callback('⚙️ Настройки рассылок', 'notifications_settings')],
    [Markup.button.callback('◀️ Главное меню', 'main_menu')]
  ]);

  const message = '📢 *Массовые уведомления*\n\nВыберите действие:';
  
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
    console.error('ADMIN: Ошибка показа меню уведомлений:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Начать создание рассылки
 */
async function startNotificationCreation(ctx) {
  console.log('ADMIN: Начало создания рассылки');
  
  ctx.session = ctx.session || {};
  ctx.session.creatingNotification = {
    step: 'type'
  };
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('👥 Всем пользователям', 'notif_type_all'),
      Markup.button.callback('🎮 Активным игрокам', 'notif_type_active')
    ],
    [
      Markup.button.callback('💰 VIP пользователям', 'notif_type_vip'),
      Markup.button.callback('😴 Неактивным', 'notif_type_inactive')
    ],
    [
      Markup.button.callback('🎯 По сегментам', 'notif_type_segmented'),
      Markup.button.callback('🆔 По ID списку', 'notif_type_custom')
    ],
    [
      Markup.button.callback('❌ Отмена', 'notifications_cancel')
    ]
  ]);

  const message = '📢 *Создание новой рассылки*\n\nШаг 1/5: Выберите целевую аудиторию:';
  
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
    console.error('ADMIN: Ошибка показа создания рассылки:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Обработка выбора типа аудитории
 */
async function handleAudienceSelection(ctx, audienceType) {
  console.log('ADMIN: Выбор аудитории:', audienceType);
  
  if (!ctx.session || !ctx.session.creatingNotification) {
    return ctx.answerCbQuery('❌ Сессия создания рассылки истекла');
  }
  
  ctx.session.creatingNotification.audienceType = audienceType;
  ctx.session.creatingNotification.step = 'message';
  
  let message = '📝 *Создание рассылки*\n\n';
  message += `Шаг 2/5: Введите текст сообщения для рассылки\n\n`;
  message += `👥 Аудитория: ${getAudienceTypeDisplayName(audienceType)}\n\n`;
  message += `💡 *Подсказки:*\n`;
  message += `• Используйте *жирный текст* и _курсив_\n`;
  message += `• Добавляйте эмодзи для привлечения внимания\n`;
  message += `• Максимум 4096 символов\n`;
  message += `• Избегайте спам-слов`;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📝 Использовать шаблон', 'notif_use_template')],
    [Markup.button.callback('❌ Отмена', 'notifications_cancel')]
  ]);
  
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
  
  await ctx.answerCbQuery();
}

/**
 * Обработка текста сообщения рассылки
 */
async function handleNotificationCreation(ctx) {
  if (!ctx.session || !ctx.session.creatingNotification) {
    return;
  }
  
  const notificationData = ctx.session.creatingNotification;
  const text = ctx.message.text;
  
  console.log(`ADMIN: Шаг создания рассылки: ${notificationData.step}, текст: ${text.substring(0, 50)}...`);
  
  switch (notificationData.step) {
    case 'message':
      if (text.length > 4096) {
        await ctx.reply('❌ Сообщение слишком длинное. Максимум 4096 символов.');
        return;
      }
      
      notificationData.message = text;
      notificationData.step = 'priority';
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🔴 Высокий', 'notif_priority_high'),
          Markup.button.callback('🟡 Средний', 'notif_priority_medium')
        ],
        [
          Markup.button.callback('🟢 Низкий', 'notif_priority_low'),
          Markup.button.callback('📢 Обычный', 'notif_priority_normal')
        ],
        [
          Markup.button.callback('❌ Отмена', 'notifications_cancel')
        ]
      ]);
      
      await ctx.reply(
        '📊 Шаг 3/5: Выберите приоритет рассылки:',
        keyboard
      );
      break;
      
    case 'schedule':
      // Обработка расписания (если выбрано отложенное отправление)
      notificationData.scheduleTime = text;
      await showNotificationPreview(ctx, notificationData);
      break;
  }
}

/**
 * Обработка выбора приоритета
 */
async function handlePrioritySelection(ctx, priority) {
  console.log('ADMIN: Выбор приоритета:', priority);
  
  if (!ctx.session || !ctx.session.creatingNotification) {
    return ctx.answerCbQuery('❌ Сессия создания рассылки истекла');
  }
  
  ctx.session.creatingNotification.priority = priority;
  ctx.session.creatingNotification.step = 'timing';
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Отправить сейчас', 'notif_timing_now')],
    [Markup.button.callback('⏰ Запланировать', 'notif_timing_scheduled')],
    [Markup.button.callback('🎯 A/B тестирование', 'notif_timing_ab_test')],
    [Markup.button.callback('❌ Отмена', 'notifications_cancel')]
  ]);
  
  let message = '⏰ *Создание рассылки*\n\n';
  message += `Шаг 4/5: Выберите время отправки:\n\n`;
  message += `📊 Приоритет: ${getPriorityDisplayName(priority)}`;
  
  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
  
  await ctx.answerCbQuery();
}

/**
 * Обработка выбора времени отправки
 */
async function handleTimingSelection(ctx, timing) {
  console.log('ADMIN: Выбор времени:', timing);
  
  if (!ctx.session || !ctx.session.creatingNotification) {
    return ctx.answerCbQuery('❌ Сессия создания рассылки истекла');
  }
  
  ctx.session.creatingNotification.timing = timing;
  
  if (timing === 'scheduled') {
    ctx.session.creatingNotification.step = 'schedule';
    
    await ctx.editMessageText(
      '⏰ Шаг 4.1/5: Введите дату и время отправки:\n\n' +
      'Формат: ДД.ММ.ГГГГ ЧЧ:ММ\n' +
      'Пример: 25.12.2024 15:30',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'notifications_cancel')]
        ])
      }
    );
  } else {
    await showNotificationPreview(ctx, ctx.session.creatingNotification);
  }
  
  await ctx.answerCbQuery();
}

/**
 * Показать предварительный просмотр рассылки
 */
async function showNotificationPreview(ctx, notificationData) {
  console.log('ADMIN: Показ превью рассылки');
  
  try {
    // Получаем статистику аудитории
    const audienceResponse = await apiClient.post('/admin/notifications/audience-stats', {
      audienceType: notificationData.audienceType
    });
    
    const audienceCount = audienceResponse.data.success ? 
      audienceResponse.data.data.count : 0;
    
    let message = '👀 *Предварительный просмотр рассылки*\n\n';
    message += `👥 **Аудитория:** ${getAudienceTypeDisplayName(notificationData.audienceType)}\n`;
    message += `📊 **Получателей:** ${audienceCount} пользователей\n`;
    message += `📊 **Приоритет:** ${getPriorityDisplayName(notificationData.priority)}\n`;
    message += `⏰ **Отправка:** ${getTimingDisplayName(notificationData.timing, notificationData.scheduleTime)}\n\n`;
    
    message += `📝 **Текст сообщения:**\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `${notificationData.message}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Примерная стоимость отправки
    const estimatedCost = Math.ceil(audienceCount * 0.001); // Примерная стоимость
    message += `💰 **Примерная стоимость:** $${estimatedCost.toFixed(2)} USD\n`;
    message += `⏱️ **Время доставки:** ~${Math.ceil(audienceCount / 100)} минут`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Отправить рассылку', 'notif_confirm_send'),
        Markup.button.callback('💾 Сохранить как черновик', 'notif_save_draft')
      ],
      [
        Markup.button.callback('✏️ Редактировать', 'notif_edit'),
        Markup.button.callback('🧪 Тестовая отправка', 'notif_test_send')
      ],
      [
        Markup.button.callback('❌ Отмена', 'notifications_cancel')
      ]
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
    console.error('ADMIN: Ошибка показа превью:', error);
    await ctx.reply('❌ Ошибка создания превью. Попробуйте еще раз.');
  }
}

/**
 * Подтверждение и отправка рассылки
 */
async function confirmNotificationSend(ctx) {
  console.log('ADMIN: Подтверждение отправки рассылки');
  
  if (!ctx.session || !ctx.session.creatingNotification) {
    return ctx.answerCbQuery('❌ Сессия создания рассылки истекла');
  }
  
  try {
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(
      '📤 *Отправка рассылки...*\n\n⏳ Это может занять несколько минут.\nНе закрывайте бота.',
      { parse_mode: 'Markdown' }
    );
    
    const notificationData = ctx.session.creatingNotification;
    
    const response = await apiClient.post('/admin/notifications/send', {
      audienceType: notificationData.audienceType,
      message: notificationData.message,
      priority: notificationData.priority,
      timing: notificationData.timing,
      scheduleTime: notificationData.scheduleTime,
      adminId: ctx.from.id
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка отправки рассылки');
    }
    
    const result = response.data.data.notification;
    
    let message = '✅ *Рассылка запущена успешно!*\n\n';
    message += `📊 **Статистика отправки:**\n`;
    message += `📤 Отправлено: ${result.sent || 0}\n`;
    message += `❌ Ошибок: ${result.failed || 0}\n`;
    message += `⏳ В очереди: ${result.queued || 0}\n`;
    message += `🆔 ID рассылки: \`${result._id}\`\n\n`;
    
    if (notificationData.timing === 'scheduled') {
      message += `⏰ Запланировано на: ${notificationData.scheduleTime}\n`;
    } else {
      message += `⚡ Время отправки: ${result.duration || 0}ms\n`;
    }
    
    message += `\n📊 Подробная статистика доступна в разделе "История рассылок"`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 История рассылок', 'notifications_history')],
      [Markup.button.callback('📢 Создать еще одну', 'notifications_create')],
      [Markup.button.callback('◀️ Главное меню', 'notifications_menu')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
    // Очищаем сессию
    delete ctx.session.creatingNotification;
    
  } catch (error) {
    console.error('ADMIN: Ошибка отправки рассылки:', error);
    
    let errorMessage = '❌ *Ошибка отправки рассылки*\n\n';
    errorMessage += `📝 ${error.message}\n\n`;
    errorMessage += 'Проверьте настройки и попробуйте еще раз.';
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'notif_confirm_send')],
      [Markup.button.callback('💾 Сохранить черновик', 'notif_save_draft')],
      [Markup.button.callback('◀️ Назад', 'notifications_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать историю рассылок
 */
async function showNotificationsHistory(ctx, page = 1) {
  console.log('ADMIN: Запрос истории рассылок, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/notifications/history', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения истории');
    }
    
    const data = response.data.data;
    const notifications = data.notifications;
    const pagination = data.pagination;
    
    if (notifications.length === 0) {
      const message = '📋 *История рассылок*\n\nРассылки не найдены.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Создать первую рассылку', 'notifications_create')],
        [Markup.button.callback('◀️ Назад', 'notifications_menu')]
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
      return;
    }
    
    let message = `📋 *История рассылок* (стр. ${pagination.current}/${pagination.pages})\n\n`;
    
    const buttons = [];
    
    notifications.forEach((notification, index) => {
      const statusEmoji = {
        'sent': '✅',
        'sending': '⏳',
        'scheduled': '⏰',
        'failed': '❌',
        'draft': '📝'
      }[notification.status] || '❓';
      
      const priorityEmoji = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢',
        'normal': '📢'
      }[notification.priority] || '📢';
      
      message += `${(pagination.current - 1) * 10 + index + 1}. ${statusEmoji} ${priorityEmoji} *${notification.title || 'Без названия'}*\n`;
      message += `   👥 Аудитория: ${getAudienceTypeDisplayName(notification.audienceType)}\n`;
      message += `   📊 Отправлено: ${notification.sent || 0}/${notification.totalRecipients || 0}\n`;
      message += `   📅 ${new Date(notification.createdAt).toLocaleString('ru-RU')}\n`;
      message += `   🆔 \`${notification._id}\`\n\n`;
      
      // Добавляем кнопки действий
      buttons.push([
        Markup.button.callback(`📊 Статистика ${index + 1}`, `notif_stats_${notification._id}`),
        Markup.button.callback(`🔄 Повторить ${index + 1}`, `notif_repeat_${notification._id}`)
      ]);
    });
    
    // Навигация по страницам
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅️ Пред.', `notifications_history_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡️', `notifications_history_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Основные кнопки
    buttons.push([
      Markup.button.callback('📢 Создать новую', 'notifications_create'),
      Markup.button.callback('🔄 Обновить', 'notifications_history')
    ]);
    
    buttons.push([Markup.button.callback('◀️ Назад', 'notifications_menu')]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
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
    console.error('ADMIN: Ошибка получения истории рассылок:', error);
    const errorMessage = `❌ Ошибка получения истории: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику уведомлений
 */
async function showNotificationsStats(ctx) {
  console.log('ADMIN: Запрос статистики уведомлений');
  
  try {
    const response = await apiClient.get('/admin/notifications/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data.stats;
    
    let message = '📊 *Статистика уведомлений*\n\n';
    
    message += `**📈 Общая статистика:**\n`;
    message += `📤 Всего рассылок: ${stats.total}\n`;
    message += `✅ Успешных: ${stats.successful}\n`;
    message += `❌ Неудачных: ${stats.failed}\n`;
    message += `⏰ Запланированных: ${stats.scheduled}\n`;
    message += `📝 Черновиков: ${stats.drafts}\n\n`;
    
    message += `**👥 Охват аудитории:**\n`;
    message += `📨 Всего отправлено: ${stats.totalSent.toLocaleString()}\n`;
    message += `📖 Прочитано: ${stats.totalRead.toLocaleString()} (${stats.readRate.toFixed(1)}%)\n`;
    message += `👆 Нажато на кнопки: ${stats.totalClicks.toLocaleString()} (${stats.clickRate.toFixed(1)}%)\n`;
    message += `🚫 Отписались: ${stats.totalUnsubscribed.toLocaleString()}\n\n`;
    
    message += `**🎯 По типам аудитории:**\n`;
    Object.entries(stats.byAudience).forEach(([type, data]) => {
      message += `${getAudienceTypeEmoji(type)} ${getAudienceTypeDisplayName(type)}: ${data.count} (${data.successRate.toFixed(1)}%)\n`;
    });
    message += '\n';
    
    message += `**📅 За последние 30 дней:**\n`;
    message += `📤 Отправлено: ${stats.last30Days.sent}\n`;
    message += `📈 Средний CTR: ${stats.last30Days.averageCTR.toFixed(2)}%\n`;
    message += `🔝 Лучший день: ${stats.last30Days.bestDay.date} (${stats.last30Days.bestDay.sent} отправлений)\n\n`;
    
    message += `**⚡ Производительность:**\n`;
    message += `🚀 Скорость отправки: ${stats.performance.averageSpeed} сообщений/мин\n`;
    message += `⏱️ Среднее время доставки: ${stats.performance.averageDeliveryTime}с\n`;
    message += `💾 Использование очереди: ${stats.performance.queueUsage}%`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Подробная аналитика', 'notifications_analytics'),
        Markup.button.callback('📈 Тренды', 'notifications_trends')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'notifications_stats'),
        Markup.button.callback('◀️ Назад', 'notifications_menu')
      ]
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
    console.error('ADMIN: Ошибка получения статистики уведомлений:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

// Вспомогательные функции
function getAudienceTypeDisplayName(type) {
  const names = {
    'all': 'Все пользователи',
    'active': 'Активные игроки',
    'vip': 'VIP пользователи',
    'inactive': 'Неактивные пользователи',
    'segmented': 'По сегментам',
    'custom': 'Пользовательский список'
  };
  return names[type] || type;
}

function getAudienceTypeEmoji(type) {
  const emojis = {
    'all': '👥',
    'active': '🎮',
    'vip': '💰',
    'inactive': '😴',
    'segmented': '🎯',
    'custom': '🆔'
  };
  return emojis[type] || '📢';
}

function getPriorityDisplayName(priority) {
  const names = {
    'high': '🔴 Высокий',
    'medium': '🟡 Средний',
    'low': '🟢 Низкий',
    'normal': '📢 Обычный'
  };
  return names[priority] || priority;
}

function getTimingDisplayName(timing, scheduleTime) {
  if (timing === 'now') {
    return '🚀 Сейчас';
  } else if (timing === 'scheduled') {
    return `⏰ ${scheduleTime}`;
  } else if (timing === 'ab_test') {
    return '🧪 A/B тест';
  }
  return timing;
}

module.exports = {
  showNotificationsMenu,
  startNotificationCreation,
  handleAudienceSelection,
  handleNotificationCreation,
  handlePrioritySelection,
  handleTimingSelection,
  showNotificationPreview,
  confirmNotificationSend,
  showNotificationsHistory,
  showNotificationsStats
};