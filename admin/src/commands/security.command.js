// admin/src/commands/security.command.js
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
 * Показать главное меню безопасности
 */
async function showSecurityMenu(ctx) {
  console.log('ADMIN: Показ меню безопасности');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 Системные алерты', 'security_alerts')],
    [Markup.button.callback('📋 Журнал аудита', 'security_audit')],
    [Markup.button.callback('🚨 Подозрительная активность', 'security_suspicious')],
    [Markup.button.callback('🔒 Заблокированные IP', 'security_blocked_ips')],
    [Markup.button.callback('⚙️ Настройки безопасности', 'security_settings')],
    [Markup.button.callback('◀️ Главное меню', 'main_menu')]
  ]);

  const message = '🛡️ *Безопасность и аудит*\n\nВыберите раздел:';
  
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
    console.error('ADMIN: Ошибка показа меню безопасности:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать системные алерты
 */
async function showSecurityAlerts(ctx) {
  console.log('ADMIN: Запрос системных алертов');
  
  try {
    const response = await apiClient.get('/admin/security/alerts');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения алертов');
    }
    
    const alerts = response.data.data.alerts;
    
    if (alerts.length === 0) {
      const message = '📊 *Системные алерты*\n\n✅ Активных алертов нет.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'security_alerts')],
        [Markup.button.callback('◀️ Назад', 'security_menu')]
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
    
    let message = `🚨 *Системные алерты* (${alerts.length})\n\n`;
    
    const buttons = [];
    
    alerts.slice(0, 10).forEach((alert, index) => {
      const priorityEmoji = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🟢'
      }[alert.priority] || '⚪';
      
      const typeEmoji = {
        'security_breach': '🚨',
        'suspicious_activity': '⚠️',
        'financial_anomaly': '💰',
        'system_error': '⚙️',
        'user_violation': '👤'
      }[alert.type] || '📢';
      
      message += `${index + 1}. ${priorityEmoji} ${typeEmoji} *${alert.title}*\n`;
      message += `   📝 ${alert.description}\n`;
      message += `   📅 ${new Date(alert.createdAt).toLocaleString('ru-RU')}\n`;
      
      if (alert.affectedUser) {
        message += `   👤 Пользователь: ${alert.affectedUser.firstName} (${alert.affectedUser.telegramId})\n`;
      }
      
      if (alert.metadata && alert.metadata.amount) {
        message += `   💰 Сумма: ${alert.metadata.amount} USDT\n`;
      }
      
      message += '\n';
      
      // Добавляем кнопку для просмотра деталей
      buttons.push([Markup.button.callback(
        `🔍 ${alert.title.substring(0, 25)}...`, 
        `alert_details_${alert._id}`
      )]);
    });
    
    if (alerts.length > 10) {
      message += `\n... и еще ${alerts.length - 10} алертов`;
    }
    
    // Добавляем общие кнопки
    buttons.push([
      Markup.button.callback('✅ Закрыть все', 'alerts_close_all'),
      Markup.button.callback('🔄 Обновить', 'security_alerts')
    ]);
    
    buttons.push([Markup.button.callback('◀️ Назад', 'security_menu')]);
    
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
    console.error('ADMIN: Ошибка получения алертов:', error);
    const errorMessage = `❌ Ошибка получения алертов: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать журнал аудита
 */
async function showAuditLog(ctx, page = 1) {
  console.log('ADMIN: Запрос журнала аудита, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/security/audit', {
      params: { 
        page: page,
        limit: 15
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения журнала');
    }
    
    const data = response.data.data;
    const logs = data.logs;
    const pagination = data.pagination;
    
    if (logs.length === 0) {
      const message = '📋 *Журнал аудита*\n\nЗаписи не найдены.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('◀️ Назад', 'security_menu')
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
    
    let message = `📋 *Журнал аудита* (стр. ${pagination.current}/${pagination.pages})\n\n`;
    
    logs.forEach((log, index) => {
      const actionEmoji = {
        'user_login': '🔑',
        'user_block': '🚫',
        'balance_adjust': '💰',
        'withdrawal_approve': '✅',
        'withdrawal_reject': '❌',
        'promo_create': '🎁',
        'settings_change': '⚙️',
        'admin_action': '👑'
      }[log.action] || '📝';
      
      message += `${(pagination.current - 1) * 15 + index + 1}. ${actionEmoji} *${getActionDisplayName(log.action)}*\n`;
      message += `   👤 Админ: ${log.admin.firstName} (${log.admin.telegramId})\n`;
      
      if (log.targetUser) {
        message += `   🎯 Цель: ${log.targetUser.firstName} (${log.targetUser.telegramId})\n`;
      }
      
      if (log.details) {
        message += `   📝 Детали: ${log.details}\n`;
      }
      
      if (log.metadata) {
        if (log.metadata.amount) {
          message += `   💰 Сумма: ${log.metadata.amount} USDT\n`;
        }
        if (log.metadata.reason) {
          message += `   📋 Причина: ${log.metadata.reason}\n`;
        }
      }
      
      message += `   📅 ${new Date(log.createdAt).toLocaleString('ru-RU')}\n`;
      message += `   🌐 IP: ${log.ipAddress || 'Неизвестно'}\n\n`;
    });
    
    // Создаем клавиатуру с навигацией
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅️ Пред.', `audit_log_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡️', `audit_log_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Фильтры
    buttons.push([
      Markup.button.callback('🔑 Только логины', 'audit_filter_login'),
      Markup.button.callback('💰 Только финансы', 'audit_filter_finance')
    ]);
    
    buttons.push([
      Markup.button.callback('🔄 Обновить', 'security_audit'),
      Markup.button.callback('◀️ Назад', 'security_menu')
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
    console.error('ADMIN: Ошибка получения журнала аудита:', error);
    const errorMessage = `❌ Ошибка получения журнала: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать подозрительную активность
 */
async function showSuspiciousActivity(ctx) {
  console.log('ADMIN: Запрос подозрительной активности');
  
  try {
    const response = await apiClient.get('/admin/security/suspicious');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения данных');
    }
    
    const data = response.data.data;
    const activities = data.activities;
    
    if (activities.length === 0) {
      const message = '🚨 *Подозрительная активность*\n\n✅ Подозрительной активности не обнаружено.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'security_suspicious')],
        [Markup.button.callback('◀️ Назад', 'security_menu')]
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
    
    let message = `🚨 *Подозрительная активность* (${activities.length})\n\n`;
    
    const buttons = [];
    
    activities.slice(0, 8).forEach((activity, index) => {
      const typeEmoji = {
        'multiple_accounts': '👥',
        'unusual_winrate': '🎯',
        'large_withdrawals': '💸',
        'ip_change': '🌐',
        'betting_pattern': '📊',
        'bot_activity': '🤖'
      }[activity.type] || '⚠️';
      
      const riskLevel = activity.riskScore >= 80 ? '🔴 Высокий' : 
                       activity.riskScore >= 50 ? '🟠 Средний' : '🟡 Низкий';
      
      message += `${index + 1}. ${typeEmoji} *${getSuspiciousTypeDisplayName(activity.type)}*\n`;
      message += `   👤 ${activity.user.firstName} ${activity.user.lastName || ''}\n`;
      message += `   📱 ID: \`${activity.user.telegramId}\`\n`;
      message += `   🎯 Риск: ${riskLevel} (${activity.riskScore}%)\n`;
      message += `   📝 ${activity.description}\n`;
      message += `   📅 ${new Date(activity.detectedAt).toLocaleString('ru-RU')}\n\n`;
      
      // Добавляем кнопки действий
      buttons.push([
        Markup.button.callback(`🔍 Проверить ${activity.user.firstName}`, `investigate_user_${activity.user._id}`),
        Markup.button.callback(`🚫 Заблокировать`, `block_suspicious_${activity.user._id}`)
      ]);
    });
    
    if (activities.length > 8) {
      message += `\n... и еще ${activities.length - 8} случаев`;
    }
    
    // Добавляем общие кнопки
    buttons.push([
      Markup.button.callback('📊 Статистика', 'suspicious_stats'),
      Markup.button.callback('🔄 Обновить', 'security_suspicious')
    ]);
    
    buttons.push([Markup.button.callback('◀️ Назад', 'security_menu')]);
    
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
    console.error('ADMIN: Ошибка получения подозрительной активности:', error);
    const errorMessage = `❌ Ошибка получения данных: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать заблокированные IP
 */
async function showBlockedIPs(ctx) {
  console.log('ADMIN: Запрос заблокированных IP');
  
  try {
    const response = await apiClient.get('/admin/security/blocked-ips');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения IP');
    }
    
    const blockedIPs = response.data.data.blockedIPs;
    
    if (blockedIPs.length === 0) {
      const message = '🔒 *Заблокированные IP*\n\nЗаблокированных IP адресов нет.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить IP', 'add_blocked_ip')],
        [Markup.button.callback('◀️ Назад', 'security_menu')]
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
    
    let message = `🔒 *Заблокированные IP* (${blockedIPs.length})\n\n`;
    
    const buttons = [];
    
    blockedIPs.slice(0, 15).forEach((ip, index) => {
      message += `${index + 1}. 🌐 \`${ip.address}\`\n`;
      message += `   📝 Причина: ${ip.reason}\n`;
      message += `   📅 Заблокирован: ${new Date(ip.blockedAt).toLocaleString('ru-RU')}\n`;
      
      if (ip.expiresAt) {
        message += `   ⏰ Истекает: ${new Date(ip.expiresAt).toLocaleString('ru-RU')}\n`;
      } else {
        message += `   ⏰ Постоянная блокировка\n`;
      }
      
      message += '\n';
      
      // Добавляем кнопку для разблокировки
      buttons.push([Markup.button.callback(
        `🔓 Разблокировать ${ip.address}`, 
        `unblock_ip_${ip._id}`
      )]);
    });
    
    if (blockedIPs.length > 15) {
      message += `\n... и еще ${blockedIPs.length - 15} IP адресов`;
    }
    
    // Добавляем общие кнопки
    buttons.push([
      Markup.button.callback('➕ Добавить IP', 'add_blocked_ip'),
      Markup.button.callback('🔄 Обновить', 'security_blocked_ips')
    ]);
    
    buttons.push([Markup.button.callback('◀️ Назад', 'security_menu')]);
    
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
    console.error('ADMIN: Ошибка получения заблокированных IP:', error);
    const errorMessage = `❌ Ошибка получения IP: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать настройки безопасности
 */
async function showSecuritySettings(ctx) {
  console.log('ADMIN: Запрос настроек безопасности');
  
  try {
    const response = await apiClient.get('/admin/security/settings');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения настроек');
    }
    
    const settings = response.data.data.settings;
    
    let message = '⚙️ *Настройки безопасности*\n\n';
    
    message += `**Мониторинг активности:**\n`;
    message += `🔍 Отслеживание IP: ${settings.trackIpChanges ? '✅ Включено' : '❌ Выключено'}\n`;
    message += `🎯 Анализ ставок: ${settings.analyzeBettingPatterns ? '✅ Включено' : '❌ Выключено'}\n`;
    message += `💰 Мониторинг выводов: ${settings.monitorWithdrawals ? '✅ Включено' : '❌ Выключено'}\n\n`;
    
    message += `**Лимиты безопасности:**\n`;
    message += `💸 Лимит вывода: ${settings.withdrawalLimit} USDT\n`;
    message += `⏰ Период анализа: ${settings.analysisWindow} часов\n`;
    message += `🎯 Порог риска: ${settings.riskThreshold}%\n\n`;
    
    message += `**Автоматические действия:**\n`;
    message += `🚫 Автоблокировка: ${settings.autoBlock ? '✅ Включена' : '❌ Выключена'}\n`;
    message += `📧 Уведомления: ${settings.notifications ? '✅ Включены' : '❌ Выключены'}\n`;
    message += `🔒 Двойная проверка: ${settings.doubleCheck ? '✅ Включена' : '❌ Выключена'}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔧 Изменить лимиты', 'security_edit_limits'),
        Markup.button.callback('🔔 Настройки алертов', 'security_edit_alerts')
      ],
      [
        Markup.button.callback('🔄 Сбросить настройки', 'security_reset'),
        Markup.button.callback('💾 Экспорт настроек', 'security_export')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'security_settings'),
        Markup.button.callback('◀️ Назад', 'security_menu')
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
    console.error('ADMIN: Ошибка получения настроек безопасности:', error);
    const errorMessage = `❌ Ошибка получения настроек: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

// Вспомогательные функции
function getActionDisplayName(action) {
  const names = {
    'user_login': 'Вход пользователя',
    'user_block': 'Блокировка пользователя',
    'balance_adjust': 'Корректировка баланса',
    'withdrawal_approve': 'Одобрение вывода',
    'withdrawal_reject': 'Отклонение вывода',
    'promo_create': 'Создание промокода',
    'settings_change': 'Изменение настроек',
    'admin_action': 'Действие администратора'
  };
  return names[action] || action;
}

function getSuspiciousTypeDisplayName(type) {
  const names = {
    'multiple_accounts': 'Множественные аккаунты',
    'unusual_winrate': 'Необычный винрейт',
    'large_withdrawals': 'Крупные выводы',
    'ip_change': 'Смена IP',
    'betting_pattern': 'Подозрительные ставки',
    'bot_activity': 'Активность бота'
  };
  return names[type] || type;
}

module.exports = {
  showSecurityMenu,
  showSecurityAlerts,
  showAuditLog,
  showSuspiciousActivity,
  showBlockedIPs,
  showSecuritySettings
};