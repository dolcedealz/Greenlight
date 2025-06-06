// admin/src/commands/monitoring.command.js
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
  timeout: 30000
});

/**
 * Показать главное меню мониторинга
 */
async function showMonitoringMenu(ctx) {
  console.log('ADMIN: Показ меню мониторинга');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 Системные метрики', 'monitoring_metrics')],
    [Markup.button.callback('⚡ Производительность', 'monitoring_performance')],
    [Markup.button.callback('👥 Онлайн пользователи', 'monitoring_online')],
    [Markup.button.callback('💰 Финансовый мониторинг', 'monitoring_financial')],
    [Markup.button.callback('🚨 Активные алерты', 'monitoring_alerts')],
    [Markup.button.callback('📈 Графики и тренды', 'monitoring_charts')],
    [Markup.button.callback('◀️ Главное меню', 'main_menu')]
  ]);

  const message = '📊 *Мониторинг системы*\n\nВыберите раздел для просмотра:';
  
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
    console.error('ADMIN: Ошибка показа меню мониторинга:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать системные метрики
 */
async function showSystemMetrics(ctx) {
  console.log('ADMIN: Запрос системных метрик');
  
  try {
    const response = await apiClient.get('/admin/monitoring/system-metrics');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения метрик');
    }
    
    const metrics = response.data.data.metrics;
    
    let message = '📊 *Системные метрики*\n\n';
    
    // Использование сервера
    message += `**💻 Сервер:**\n`;
    message += `🔋 CPU: ${metrics.server.cpuUsage}%\n`;
    message += `🧠 RAM: ${metrics.server.memoryUsage}% (${metrics.server.memoryUsed}/${metrics.server.memoryTotal} GB)\n`;
    message += `💾 Диск: ${metrics.server.diskUsage}% (${metrics.server.diskUsed}/${metrics.server.diskTotal} GB)\n`;
    message += `⏰ Uptime: ${formatUptime(metrics.server.uptime)}\n\n`;
    
    // База данных
    message += `**🗄️ База данных:**\n`;
    message += `🔗 Подключений: ${metrics.database.activeConnections}/${metrics.database.maxConnections}\n`;
    message += `⚡ Время ответа: ${metrics.database.responseTime}ms\n`;
    message += `📊 Размер БД: ${metrics.database.size} MB\n`;
    message += `📈 Операций/сек: ${metrics.database.operationsPerSecond}\n\n`;
    
    // API
    message += `**🌐 API:**\n`;
    message += `📡 Запросов/мин: ${metrics.api.requestsPerMinute}\n`;
    message += `⏱️ Среднее время ответа: ${metrics.api.averageResponseTime}ms\n`;
    message += `❌ Ошибки: ${metrics.api.errorRate}%\n`;
    message += `📈 Успешных запросов: ${metrics.api.successRate}%\n\n`;
    
    // Бот
    message += `**🤖 Телеграм бот:**\n`;
    message += `👥 Активных сессий: ${metrics.bot.activeSessions || 0}\n`;
    message += `📨 Сообщений/час: ${metrics.bot.messagesPerHour || 0}\n`;
    message += `⚡ Время ответа: ${metrics.bot.responseTime || 0}ms\n`;
    
    const healthStatus = getHealthStatus(metrics);
    message += `\n🏥 **Общее состояние:** ${healthStatus.emoji} ${healthStatus.text}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📈 Подробная статистика', 'metrics_detailed'),
        Markup.button.callback('⚠️ Проблемы', 'metrics_issues')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_metrics'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
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
    console.error('ADMIN: Ошибка получения системных метрик:', error);
    const errorMessage = `❌ Ошибка получения метрик: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать производительность
 */
async function showPerformanceMetrics(ctx) {
  console.log('ADMIN: Запрос метрик производительности');
  
  try {
    const response = await apiClient.get('/admin/monitoring/performance');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения данных');
    }
    
    const perf = response.data.data.performance;
    
    let message = '⚡ *Производительность системы*\n\n';
    
    // Скорость обработки запросов
    message += `**🚀 Скорость обработки:**\n`;
    message += `⚡ Авторизация: ${perf.auth.averageTime}ms\n`;
    message += `🎮 Игровые запросы: ${perf.games.averageTime}ms\n`;
    message += `💰 Финансовые операции: ${perf.financial.averageTime}ms\n`;
    message += `👥 Пользовательские данные: ${perf.users.averageTime}ms\n\n`;
    
    // Пропускная способность
    message += `**📊 Пропускная способность:**\n`;
    message += `📈 RPS (запросов/сек): ${perf.throughput.requestsPerSecond}\n`;
    message += `👥 Одновременных пользователей: ${perf.throughput.concurrentUsers}\n`;
    message += `🎯 Пиковая нагрузка: ${perf.throughput.peakLoad}\n`;
    message += `📉 Использование ресурсов: ${perf.throughput.resourceUtilization}%\n\n`;
    
    // Статистика за периоды
    message += `**📅 За последний час:**\n`;
    message += `✅ Успешных операций: ${perf.hourly.successful}\n`;
    message += `❌ Ошибок: ${perf.hourly.errors}\n`;
    message += `⏱️ Среднее время: ${perf.hourly.averageTime}ms\n\n`;
    
    message += `**📅 За сегодня:**\n`;
    message += `📊 Всего запросов: ${perf.daily.totalRequests}\n`;
    message += `📈 Пиковая нагрузка: ${perf.daily.peakTime}\n`;
    message += `🎯 Время безотказной работы: ${perf.daily.uptime}%`;
    
    // Определяем статус производительности
    const perfStatus = getPerformanceStatus(perf);
    message += `\n\n⚡ **Статус производительности:** ${perfStatus.emoji} ${perfStatus.text}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📈 Графики нагрузки', 'perf_charts'),
        Markup.button.callback('🔧 Оптимизация', 'perf_optimize')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_performance'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
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
    console.error('ADMIN: Ошибка получения метрик производительности:', error);
    const errorMessage = `❌ Ошибка получения данных: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать онлайн пользователей
 */
async function showOnlineUsers(ctx) {
  console.log('ADMIN: Запрос онлайн пользователей');
  
  try {
    const response = await apiClient.get('/admin/monitoring/online-users');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения данных');
    }
    
    const data = response.data.data;
    const online = data.online;
    
    let message = `👥 *Онлайн пользователи* (${online.total})\n\n`;
    
    // Общая статистика
    message += `**📊 Общая статистика:**\n`;
    message += `🟢 Всего онлайн: ${online.total}\n`;
    message += `🎮 В играх: ${online.inGames}\n`;
    message += `💰 В финансовых операциях: ${online.inTransactions}\n`;
    message += `👀 Просматривают: ${online.browsing}\n\n`;
    
    // По играм
    if (online.byGame && Object.keys(online.byGame).length > 0) {
      message += `**🎮 По играм:**\n`;
      Object.entries(online.byGame).forEach(([game, count]) => {
        const gameEmoji = {
          'coin': '🪙',
          'crash': '🚀',
          'slots': '🎰',
          'mines': '💣'
        }[game] || '🎮';
        
        message += `${gameEmoji} ${game}: ${count} игроков\n`;
      });
      message += '\n';
    }
    
    // Пиковые значения
    message += `**📈 Пиковые значения:**\n`;
    message += `🔝 Пик за сегодня: ${online.peakToday} (${online.peakTime})\n`;
    message += `📅 Пик за неделю: ${online.peakWeek}\n`;
    message += `🏆 Рекорд: ${online.allTimeRecord}\n\n`;
    
    // География (если доступно)
    if (online.byRegion && Object.keys(online.byRegion).length > 0) {
      message += `**🌍 По регионам:**\n`;
      Object.entries(online.byRegion).slice(0, 5).forEach(([region, count]) => {
        message += `🌐 ${region}: ${count}\n`;
      });
      message += '\n';
    }
    
    // Активные сессии
    message += `**⏰ Длительность сессий:**\n`;
    message += `🆕 Новые (< 5 мин): ${online.sessionDuration.new}\n`;
    message += `⏱️ Короткие (5-30 мин): ${online.sessionDuration.short}\n`;
    message += `⏰ Средние (30-120 мин): ${online.sessionDuration.medium}\n`;
    message += `🕐 Длинные (> 2 часа): ${online.sessionDuration.long}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('👤 Детали пользователей', 'online_details'),
        Markup.button.callback('📊 Аналитика активности', 'online_analytics')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_online'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
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
    console.error('ADMIN: Ошибка получения онлайн пользователей:', error);
    const errorMessage = `❌ Ошибка получения данных: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать финансовый мониторинг
 */
async function showFinancialMonitoring(ctx) {
  console.log('ADMIN: Запрос финансового мониторинга');
  
  try {
    const response = await apiClient.get('/admin/monitoring/financial');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения данных');
    }
    
    const financial = response.data.data.financial;
    
    let message = '💰 *Финансовый мониторинг*\n\n';
    
    // Текущие операции
    message += `**⚡ Активные операции:**\n`;
    message += `💳 Депозиты в обработке: ${financial.active.deposits}\n`;
    message += `💸 Выводы в обработке: ${financial.active.withdrawals}\n`;
    message += `🎮 Игровые ставки: ${financial.active.bets}\n`;
    message += `🏦 Сумма в обработке: ${financial.active.totalAmount.toFixed(2)} USDT\n\n`;
    
    // Показатели дня
    message += `**📅 За сегодня:**\n`;
    message += `📈 Доходы: ${financial.today.income.toFixed(2)} USDT\n`;
    message += `📉 Расходы: ${financial.today.expenses.toFixed(2)} USDT\n`;
    message += `💰 Чистая прибыль: ${financial.today.netProfit.toFixed(2)} USDT\n`;
    message += `🎯 ROI: ${financial.today.roi.toFixed(1)}%\n\n`;
    
    // Алерты
    if (financial.alerts && financial.alerts.length > 0) {
      message += `**🚨 Финансовые алерты:**\n`;
      financial.alerts.slice(0, 3).forEach(alert => {
        const alertEmoji = {
          'low_balance': '⚠️',
          'high_withdrawal': '💸',
          'unusual_activity': '🔍',
          'profit_drop': '📉'
        }[alert.type] || '⚠️';
        
        message += `${alertEmoji} ${alert.message}\n`;
      });
      message += '\n';
    }
    
    // Показатели ликвидности
    message += `**💧 Ликвидность:**\n`;
    message += `🏦 Общий баланс: ${financial.liquidity.totalBalance.toFixed(2)} USDT\n`;
    message += `💰 Доступно: ${financial.liquidity.available.toFixed(2)} USDT\n`;
    message += `🔒 Заблокировано: ${financial.liquidity.locked.toFixed(2)} USDT\n`;
    message += `📊 Коэффициент ликвидности: ${financial.liquidity.ratio.toFixed(2)}\n\n`;
    
    // Прогнозы
    message += `**🔮 Прогнозы:**\n`;
    message += `📈 Ожидаемая прибыль (час): ${financial.forecast.hourly.toFixed(2)} USDT\n`;
    message += `📊 Ожидаемая прибыль (день): ${financial.forecast.daily.toFixed(2)} USDT`;
    
    // Определяем статус финансов
    const finStatus = getFinancialStatus(financial);
    message += `\n\n💰 **Финансовый статус:** ${finStatus.emoji} ${finStatus.text}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Детальный анализ', 'financial_detailed'),
        Markup.button.callback('⚠️ Управление рисками', 'financial_risks')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_financial'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
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
    console.error('ADMIN: Ошибка получения финансового мониторинга:', error);
    const errorMessage = `❌ Ошибка получения данных: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать активные алерты
 */
async function showActiveAlerts(ctx) {
  console.log('ADMIN: Запрос активных алертов мониторинга');
  
  try {
    const response = await apiClient.get('/admin/monitoring/alerts');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения алертов');
    }
    
    const alerts = response.data.data.alerts;
    
    if (alerts.length === 0) {
      const message = '🚨 *Активные алерты*\n\n✅ Активных алертов нет.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⚙️ Настройки алертов', 'alerts_settings')],
        [Markup.button.callback('◀️ Назад', 'monitoring_menu')]
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
    
    let message = `🚨 *Активные алерты* (${alerts.length})\n\n`;
    
    const buttons = [];
    
    alerts.slice(0, 8).forEach((alert, index) => {
      const priorityEmoji = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
      }[alert.priority] || '⚪';
      
      const categoryEmoji = {
        'system': '💻',
        'performance': '⚡',
        'financial': '💰',
        'security': '🛡️',
        'user': '👤'
      }[alert.category] || '📢';
      
      message += `${index + 1}. ${priorityEmoji} ${categoryEmoji} *${alert.title}*\n`;
      message += `   📝 ${alert.description}\n`;
      message += `   ⏰ ${new Date(alert.triggeredAt).toLocaleString('ru-RU')}\n`;
      
      if (alert.value) {
        message += `   📊 Значение: ${alert.value} ${alert.unit || ''}\n`;
      }
      
      message += '\n';
      
      // Добавляем кнопки действий для критических алертов
      if (alert.priority === 'critical') {
        buttons.push([Markup.button.callback(
          `🚨 Обработать "${alert.title.substring(0, 20)}..."`, 
          `handle_alert_${alert._id}`
        )]);
      }
    });
    
    if (alerts.length > 8) {
      message += `\n... и еще ${alerts.length - 8} алертов`;
    }
    
    // Добавляем общие кнопки
    buttons.push([
      Markup.button.callback('✅ Закрыть все', 'alerts_close_all'),
      Markup.button.callback('⚙️ Настройки', 'alerts_settings')
    ]);
    
    buttons.push([
      Markup.button.callback('🔄 Обновить', 'monitoring_alerts'),
      Markup.button.callback('◀️ Назад', 'monitoring_menu')
    ]);
    
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
    console.error('ADMIN: Ошибка получения активных алертов:', error);
    const errorMessage = `❌ Ошибка получения алертов: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

// Вспомогательные функции
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}д ${hours}ч ${minutes}м`;
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else {
    return `${minutes}м`;
  }
}

function getHealthStatus(metrics) {
  const cpu = metrics.server.cpuUsage;
  const memory = metrics.server.memoryUsage;
  const disk = metrics.server.diskUsage;
  const dbResponse = metrics.database.responseTime;
  
  if (cpu > 90 || memory > 90 || disk > 95 || dbResponse > 1000) {
    return { emoji: '🔴', text: 'Критическое' };
  } else if (cpu > 70 || memory > 80 || disk > 85 || dbResponse > 500) {
    return { emoji: '🟠', text: 'Требует внимания' };
  } else if (cpu > 50 || memory > 60 || disk > 70 || dbResponse > 200) {
    return { emoji: '🟡', text: 'Нормальное' };
  } else {
    return { emoji: '🟢', text: 'Отличное' };
  }
}

function getPerformanceStatus(perf) {
  const avgTime = perf.auth.averageTime + perf.games.averageTime + perf.financial.averageTime;
  const errorRate = perf.hourly.errors / (perf.hourly.successful + perf.hourly.errors) * 100;
  
  if (avgTime > 2000 || errorRate > 5) {
    return { emoji: '🔴', text: 'Низкая' };
  } else if (avgTime > 1000 || errorRate > 2) {
    return { emoji: '🟠', text: 'Средняя' };
  } else if (avgTime > 500 || errorRate > 1) {
    return { emoji: '🟡', text: 'Хорошая' };
  } else {
    return { emoji: '🟢', text: 'Отличная' };
  }
}

function getFinancialStatus(financial) {
  const ratio = financial.liquidity.ratio;
  const profit = financial.today.netProfit;
  
  if (ratio < 0.1 || profit < -1000) {
    return { emoji: '🔴', text: 'Критический' };
  } else if (ratio < 0.3 || profit < -100) {
    return { emoji: '🟠', text: 'Требует внимания' };
  } else if (ratio < 0.5 || profit < 100) {
    return { emoji: '🟡', text: 'Стабильный' };
  } else {
    return { emoji: '🟢', text: 'Отличный' };
  }
}

module.exports = {
  showMonitoringMenu,
  showSystemMetrics,
  showPerformanceMetrics,
  showOnlineUsers,
  showFinancialMonitoring,
  showActiveAlerts
};