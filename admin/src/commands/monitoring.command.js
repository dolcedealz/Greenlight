// admin/src/commands/monitoring.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
const apiUrl = process.env.API_URL || 'https://api.greenlight-casino.eu/api';
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
 * Экранирует специальные символы для Telegram Markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  let result = text.toString();
  
  if (!result.trim()) {
    return 'Unknown';
  }
  
  result = result
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
  
  return result;
}

/**
 * Показать главное меню мониторинга
 */
async function showMonitoringMenu(ctx) {
  console.log('ADMIN: Показ меню мониторинга балансов');
  
  const message = '📊 *Мониторинг балансов*\n\nВыберите действие:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔍 Проверить балансы', 'monitoring_check'),
      Markup.button.callback('📈 Статистика', 'monitoring_stats')
    ],
    [
      Markup.button.callback('🔔 Уведомления', 'monitoring_notifications'),
      Markup.button.callback('⚙️ Настройки', 'monitoring_settings')
    ],
    [
      Markup.button.callback('💰 CryptoBot баланс', 'monitoring_cryptobot'),
      Markup.button.callback('🏦 Системный баланс', 'monitoring_system')
    ],
    [
      Markup.button.callback('▶️ Запустить мониторинг', 'monitoring_start'),
      Markup.button.callback('⏹️ Остановить мониторинг', 'monitoring_stop')
    ],
    [
      Markup.button.callback('◀️ Назад', 'main_menu')
    ]
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
    console.error('ADMIN: Ошибка показа меню мониторинга:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Выполнить проверку балансов
 */
async function checkBalances(ctx) {
  console.log('ADMIN: Запуск проверки балансов');
  
  try {
    await ctx.answerCbQuery('Проверяем балансы...');
    
    const response = await apiClient.post('/admin/monitoring/check-balances');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка проверки балансов');
    }
    
    const result = response.data.data;
    
    // Получаем эмодзи статуса
    const getStatusEmoji = (status) => {
      switch (status) {
        case 'NORMAL': return '✅';
        case 'WARNING': return '⚠️';
        case 'CRITICAL': return '🚨';
        default: return '❓';
      }
    };
    
    let message = `🔍 *Результат проверки балансов*\n\n`;
    message += `${getStatusEmoji(result.status)} Статус: *${result.status}*\n\n`;
    message += `💰 CryptoBot: ${result.cryptoBotBalance.toFixed(2)} USDT\n`;
    message += `🏦 Система: ${result.systemBalance.toFixed(2)} USDT\n`;
    message += `📊 Расхождение: ${result.difference.toFixed(4)} USDT\n`;
    message += `📈 Процент: ${result.discrepancyPercent}%\n\n`;
    message += `🕐 Время проверки: ${new Date(result.timestamp).toLocaleString('ru-RU')}`;
    
    if (result.details.possibleCauses.length > 0) {
      message += `\n\n🔍 Возможные причины:\n`;
      result.details.possibleCauses.forEach(cause => {
        message += `• ${cause}\n`;
      });
    }
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Повторить проверку', 'monitoring_check'),
        Markup.button.callback('📊 Статистика', 'monitoring_stats')
      ],
      [
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка проверки балансов:', error);
    
    const errorMessage = `❌ *Ошибка проверки балансов*\n\n${escapeMarkdown(error.message)}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'monitoring_check')],
      [Markup.button.callback('◀️ Назад', 'monitoring_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать статистику мониторинга
 */
async function showMonitoringStats(ctx) {
  console.log('ADMIN: Запрос статистики мониторинга');
  
  try {
    const response = await apiClient.get('/admin/monitoring/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = `📊 *Статистика мониторинга*\n\n`;
    message += `🔄 Статус: ${stats.isActive ? '✅ Активен' : '❌ Остановлен'}\n`;
    message += `🕐 Последняя проверка: ${stats.lastCheckTime ? new Date(stats.lastCheckTime).toLocaleString('ru-RU') : 'Не выполнялась'}\n\n`;
    
    message += `**Уведомления:**\n`;
    message += `📋 Всего: ${stats.totalNotifications}\n`;
    message += `📅 За 24 часа: ${stats.notificationsLast24h}\n`;
    message += `📊 За 7 дней: ${stats.notificationsLast7d}\n\n`;
    
    message += `**Алерты за 24 часа:**\n`;
    message += `🚨 Критические: ${stats.criticalAlertsLast24h}\n`;
    message += `⚠️ Предупреждения: ${stats.warningAlertsLast24h}\n\n`;
    
    message += `**Настройки:**\n`;
    message += `⚠️ Порог предупреждения: ${stats.thresholds.alert} USDT\n`;
    message += `🚨 Критический порог: ${stats.thresholds.critical} USDT`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔔 Уведомления', 'monitoring_notifications'),
        Markup.button.callback('⚙️ Настройки', 'monitoring_settings')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_stats'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения статистики мониторинга:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Показать уведомления мониторинга
 */
async function showMonitoringNotifications(ctx) {
  console.log('ADMIN: Запрос уведомлений мониторинга');
  
  try {
    const response = await apiClient.get('/admin/monitoring/notifications?limit=10');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения уведомлений');
    }
    
    const notifications = response.data.data.notifications;
    
    let message = `🔔 *Уведомления мониторинга*\n\n`;
    
    if (notifications.length === 0) {
      message += 'Уведомлений пока нет.';
    } else {
      notifications.slice(0, 5).forEach((notification, index) => {
        const typeEmoji = {
          'critical': '🚨',
          'warning': '⚠️',
          'error': '❌',
          'daily_report': '📊',
          'info': 'ℹ️'
        };
        
        message += `${index + 1}. ${typeEmoji[notification.type] || 'ℹ️'} *${notification.type.toUpperCase()}*\n`;
        message += `   🕐 ${new Date(notification.timestamp).toLocaleString('ru-RU')}\n`;
        
        // Показываем краткую версию сообщения
        const shortMessage = notification.message.length > 100 
          ? notification.message.substring(0, 100) + '...'
          : notification.message;
        message += `   📝 ${escapeMarkdown(shortMessage)}\n\n`;
      });
      
      if (notifications.length > 5) {
        message += `... и еще ${notifications.length - 5} уведомлений`;
      }
    }
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_notifications'),
        Markup.button.callback('📊 Статистика', 'monitoring_stats')
      ],
      [
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения уведомлений:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Получить баланс CryptoBot
 */
async function getCryptoBotBalance(ctx) {
  console.log('ADMIN: Запрос баланса CryptoBot');
  
  try {
    await ctx.answerCbQuery('Получаем баланс CryptoBot...');
    
    const response = await apiClient.get('/admin/monitoring/cryptobot-balance');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения баланса');
    }
    
    const data = response.data.data;
    
    const message = 
      `💰 *Баланс CryptoBot*\n\n` +
      `💵 Доступно: ${data.balance.toFixed(2)} USDT\n` +
      `🕐 Время запроса: ${new Date(data.timestamp).toLocaleString('ru-RU')}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_cryptobot'),
        Markup.button.callback('🏦 Системный баланс', 'monitoring_system')
      ],
      [
        Markup.button.callback('🔍 Проверить оба', 'monitoring_check'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения баланса CryptoBot:', error);
    
    const errorMessage = `❌ *Ошибка получения баланса CryptoBot*\n\n${escapeMarkdown(error.message)}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'monitoring_cryptobot')],
      [Markup.button.callback('◀️ Назад', 'monitoring_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Получить системный баланс
 */
async function getSystemBalance(ctx) {
  console.log('ADMIN: Запрос системного баланса');
  
  try {
    await ctx.answerCbQuery('Получаем системный баланс...');
    
    const response = await apiClient.get('/admin/monitoring/system-balance');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения баланса');
    }
    
    const data = response.data.data;
    
    const message = 
      `🏦 *Системный операционный баланс*\n\n` +
      `💵 Баланс: ${data.balance.toFixed(2)} USDT\n` +
      `🕐 Время запроса: ${new Date(data.timestamp).toLocaleString('ru-RU')}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Обновить', 'monitoring_system'),
        Markup.button.callback('💰 CryptoBot баланс', 'monitoring_cryptobot')
      ],
      [
        Markup.button.callback('🔍 Проверить оба', 'monitoring_check'),
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения системного баланса:', error);
    
    const errorMessage = `❌ *Ошибка получения системного баланса*\n\n${escapeMarkdown(error.message)}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'monitoring_system')],
      [Markup.button.callback('◀️ Назад', 'monitoring_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Запустить автоматический мониторинг
 */
async function startMonitoring(ctx) {
  console.log('ADMIN: Запуск автоматического мониторинга');
  
  try {
    const response = await apiClient.post('/admin/monitoring/start');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка запуска мониторинга');
    }
    
    await ctx.answerCbQuery('✅ Автоматический мониторинг запущен');
    
    const message = 
      `▶️ *Автоматический мониторинг запущен*\n\n` +
      `✅ Мониторинг будет выполняться каждые 30 минут\n` +
      `📊 Ежедневные отчеты в 09:00\n` +
      `🔔 Уведомления при расхождениях\n\n` +
      `Для остановки используйте кнопку "Остановить мониторинг"`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⏹️ Остановить', 'monitoring_stop'),
        Markup.button.callback('📊 Статистика', 'monitoring_stats')
      ],
      [
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка запуска мониторинга:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Остановить автоматический мониторинг
 */
async function stopMonitoring(ctx) {
  console.log('ADMIN: Остановка автоматического мониторинга');
  
  try {
    const response = await apiClient.post('/admin/monitoring/stop');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка остановки мониторинга');
    }
    
    await ctx.answerCbQuery('⏹️ Автоматический мониторинг остановлен');
    
    const message = 
      `⏹️ *Автоматический мониторинг остановлен*\n\n` +
      `❌ Автоматические проверки приостановлены\n` +
      `📋 Ручные проверки по-прежнему доступны\n\n` +
      `Для возобновления используйте кнопку "Запустить мониторинг"`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('▶️ Запустить', 'monitoring_start'),
        Markup.button.callback('🔍 Ручная проверка', 'monitoring_check')
      ],
      [
        Markup.button.callback('◀️ Назад', 'monitoring_menu')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка остановки мониторинга:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

module.exports = {
  showMonitoringMenu,
  checkBalances,
  showMonitoringStats,
  showMonitoringNotifications,
  getCryptoBotBalance,
  getSystemBalance,
  startMonitoring,
  stopMonitoring
};