// admin/src/commands/backup.command.js
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
  timeout: 120000 // Увеличенный таймаут для операций бэкапа
});

/**
 * Показать главное меню системы бэкапов
 */
async function showBackupMenu(ctx) {
  console.log('ADMIN: Показ меню системы бэкапов');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💾 Создать бэкап', 'backup_create')],
    [Markup.button.callback('📋 Список бэкапов', 'backup_list')],
    [Markup.button.callback('🔄 Восстановить из бэкапа', 'backup_restore')],
    [Markup.button.callback('📊 Статистика бэкапов', 'backup_stats')],
    [Markup.button.callback('⚙️ Настройки автобэкапа', 'backup_settings')],
    [Markup.button.callback('🗑️ Очистка старых бэкапов', 'backup_cleanup')],
    [Markup.button.callback('◀️ Главное меню', 'main_menu')]
  ]);

  const message = '💾 *Система резервного копирования*\n\nВыберите действие:';
  
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
    console.error('ADMIN: Ошибка показа меню бэкапов:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Создать новый бэкап
 */
async function createBackup(ctx) {
  console.log('ADMIN: Запрос создания бэкапа');
  
  // Показываем меню выбора типа бэкапа
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏦 Полный бэкап', 'backup_create_full')],
    [Markup.button.callback('👥 Только пользователи', 'backup_create_users')],
    [Markup.button.callback('💰 Только финансы', 'backup_create_financial')],
    [Markup.button.callback('🎮 Только игры', 'backup_create_games')],
    [Markup.button.callback('⚙️ Только настройки', 'backup_create_settings')],
    [Markup.button.callback('❌ Отмена', 'backup_menu')]
  ]);

  const message = '💾 *Создание бэкапа*\n\nВыберите тип бэкапа для создания:';
  
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
    console.error('ADMIN: Ошибка показа меню создания бэкапа:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Выполнить создание бэкапа конкретного типа
 */
async function performBackup(ctx, backupType) {
  console.log('ADMIN: Выполнение бэкапа типа:', backupType);
  
  try {
    await ctx.answerCbQuery();
    
    // Отправляем уведомление о начале процесса
    await ctx.editMessageText(
      '💾 *Создание бэкапа...*\n\n⏳ Процесс может занять несколько минут.\nПожалуйста, подождите...',
      { parse_mode: 'Markdown' }
    );
    
    const response = await apiClient.post('/admin/backup/create', {
      type: backupType,
      adminId: ctx.from.id
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка создания бэкапа');
    }
    
    const backup = response.data.data.backup;
    
    let message = '✅ *Бэкап создан успешно!*\n\n';
    message += `📝 Тип: ${getBackupTypeDisplayName(backup.type)}\n`;
    message += `📊 Размер: ${(backup.size / 1024 / 1024).toFixed(2)} MB\n`;
    message += `📋 Записей: ${backup.recordsCount || 'N/A'}\n`;
    message += `📅 Создан: ${new Date(backup.createdAt).toLocaleString('ru-RU')}\n`;
    message += `🆔 ID: \`${backup._id}\`\n\n`;
    
    if (backup.downloadUrl) {
      message += `📥 [Скачать бэкап](${backup.downloadUrl})\n`;
    }
    
    message += `⏰ Время создания: ${backup.duration}ms`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Список бэкапов', 'backup_list')],
      [Markup.button.callback('💾 Создать еще', 'backup_create')],
      [Markup.button.callback('◀️ Назад', 'backup_menu')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка создания бэкапа:', error);
    
    let errorMessage = '❌ *Ошибка создания бэкапа*\n\n';
    errorMessage += `📝 ${error.message}\n\n`;
    errorMessage += 'Попробуйте еще раз или обратитесь к системному администратору.';
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'backup_create')],
      [Markup.button.callback('◀️ Назад', 'backup_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать список бэкапов
 */
async function showBackupList(ctx, page = 1) {
  console.log('ADMIN: Запрос списка бэкапов, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/backup/list', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения списка');
    }
    
    const data = response.data.data;
    const backups = data.backups;
    const pagination = data.pagination;
    
    if (backups.length === 0) {
      const message = '📋 *Список бэкапов*\n\nБэкапы не найдены.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💾 Создать первый бэкап', 'backup_create')],
        [Markup.button.callback('◀️ Назад', 'backup_menu')]
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
    
    let message = `📋 *Список бэкапов* (стр. ${pagination.current}/${pagination.pages})\n\n`;
    
    const buttons = [];
    
    backups.forEach((backup, index) => {
      const statusEmoji = backup.status === 'completed' ? '✅' : 
                         backup.status === 'failed' ? '❌' : '⏳';
      
      message += `${(pagination.current - 1) * 10 + index + 1}. ${statusEmoji} *${getBackupTypeDisplayName(backup.type)}*\n`;
      message += `   📊 Размер: ${(backup.size / 1024 / 1024).toFixed(2)} MB\n`;
      message += `   📅 ${new Date(backup.createdAt).toLocaleString('ru-RU')}\n`;
      message += `   🆔 \`${backup._id}\`\n\n`;
      
      // Добавляем кнопки действий для каждого бэкапа
      if (backup.status === 'completed') {
        buttons.push([
          Markup.button.callback(`📥 Скачать ${index + 1}`, `backup_download_${backup._id}`),
          Markup.button.callback(`🔄 Восстановить ${index + 1}`, `backup_restore_${backup._id}`)
        ]);
      }
    });
    
    // Навигация по страницам
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅️ Пред.', `backup_list_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡️', `backup_list_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Основные кнопки
    buttons.push([
      Markup.button.callback('💾 Создать новый', 'backup_create'),
      Markup.button.callback('🔄 Обновить', 'backup_list')
    ]);
    
    buttons.push([Markup.button.callback('◀️ Назад', 'backup_menu')]);
    
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
    console.error('ADMIN: Ошибка получения списка бэкапов:', error);
    const errorMessage = `❌ Ошибка получения списка: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику бэкапов
 */
async function showBackupStats(ctx) {
  console.log('ADMIN: Запрос статистики бэкапов');
  
  try {
    const response = await apiClient.get('/admin/backup/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data.stats;
    
    let message = '📊 *Статистика бэкапов*\n\n';
    
    message += `**📈 Общая статистика:**\n`;
    message += `📦 Всего бэкапов: ${stats.total}\n`;
    message += `✅ Успешных: ${stats.successful}\n`;
    message += `❌ Неудачных: ${stats.failed}\n`;
    message += `⏳ В процессе: ${stats.inProgress}\n\n`;
    
    message += `**💾 По типам:**\n`;
    Object.entries(stats.byType).forEach(([type, count]) => {
      message += `${getBackupTypeEmoji(type)} ${getBackupTypeDisplayName(type)}: ${count}\n`;
    });
    message += '\n';
    
    message += `**📊 Размеры:**\n`;
    message += `📦 Общий размер: ${(stats.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    message += `📈 Средний размер: ${(stats.averageSize / 1024 / 1024).toFixed(2)} MB\n`;
    message += `🔝 Крупнейший: ${(stats.largestSize / 1024 / 1024).toFixed(2)} MB\n\n`;
    
    message += `**⏰ Временные показатели:**\n`;
    message += `🕐 Последний бэкап: ${stats.lastBackup ? new Date(stats.lastBackup).toLocaleString('ru-RU') : 'Нет'}\n`;
    message += `📅 Старейший бэкап: ${stats.oldestBackup ? new Date(stats.oldestBackup).toLocaleString('ru-RU') : 'Нет'}\n`;
    message += `⚡ Среднее время создания: ${stats.averageCreationTime}ms\n\n`;
    
    // Автоматические бэкапы
    if (stats.autoBackup) {
      message += `**🤖 Автобэкапы:**\n`;
      message += `🔄 Статус: ${stats.autoBackup.enabled ? '✅ Включены' : '❌ Выключены'}\n`;
      message += `⏰ Интервал: ${stats.autoBackup.interval}\n`;
      message += `📅 Следующий: ${stats.autoBackup.nextRun ? new Date(stats.autoBackup.nextRun).toLocaleString('ru-RU') : 'Не запланирован'}\n`;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 Список бэкапов', 'backup_list'),
        Markup.button.callback('⚙️ Настройки', 'backup_settings')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'backup_stats'),
        Markup.button.callback('◀️ Назад', 'backup_menu')
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
    console.error('ADMIN: Ошибка получения статистики бэкапов:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать настройки автоматических бэкапов
 */
async function showBackupSettings(ctx) {
  console.log('ADMIN: Запрос настроек автобэкапа');
  
  try {
    const response = await apiClient.get('/admin/backup/settings');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения настроек');
    }
    
    const settings = response.data.data.settings;
    
    let message = '⚙️ *Настройки автоматических бэкапов*\n\n';
    
    message += `**🔄 Автоматические бэкапы:**\n`;
    message += `📊 Статус: ${settings.autoBackup.enabled ? '✅ Включены' : '❌ Выключены'}\n`;
    message += `⏰ Интервал: ${settings.autoBackup.interval}\n`;
    message += `🕐 Время запуска: ${settings.autoBackup.time}\n`;
    message += `📦 Тип бэкапа: ${getBackupTypeDisplayName(settings.autoBackup.type)}\n\n`;
    
    message += `**🗑️ Очистка старых бэкапов:**\n`;
    message += `📅 Хранить дни: ${settings.retention.days}\n`;
    message += `📦 Максимум бэкапов: ${settings.retention.maxCount}\n`;
    message += `💾 Максимальный размер: ${settings.retention.maxSize} GB\n\n`;
    
    message += `**📧 Уведомления:**\n`;
    message += `✅ При успехе: ${settings.notifications.onSuccess ? '✅' : '❌'}\n`;
    message += `❌ При ошибке: ${settings.notifications.onError ? '✅' : '❌'}\n`;
    message += `📊 Еженедельный отчет: ${settings.notifications.weeklyReport ? '✅' : '❌'}\n\n`;
    
    message += `**🔒 Безопасность:**\n`;
    message += `🔐 Шифрование: ${settings.security.encryption ? '✅ Включено' : '❌ Выключено'}\n`;
    message += `📝 Проверка целостности: ${settings.security.checksums ? '✅ Включена' : '❌ Выключена'}\n`;
    message += `☁️ Облачное хранение: ${settings.security.cloudStorage ? '✅ Включено' : '❌ Выключено'}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(settings.autoBackup.enabled ? '⏸️ Выключить автобэкап' : '▶️ Включить автобэкап', 'backup_toggle_auto'),
        Markup.button.callback('⏰ Изменить расписание', 'backup_edit_schedule')
      ],
      [
        Markup.button.callback('🗑️ Настройки очистки', 'backup_edit_retention'),
        Markup.button.callback('📧 Настройки уведомлений', 'backup_edit_notifications')
      ],
      [
        Markup.button.callback('🔄 Сбросить настройки', 'backup_reset_settings'),
        Markup.button.callback('💾 Сохранить конфигурацию', 'backup_export_config')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'backup_settings'),
        Markup.button.callback('◀️ Назад', 'backup_menu')
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
    console.error('ADMIN: Ошибка получения настроек автобэкапа:', error);
    const errorMessage = `❌ Ошибка получения настроек: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Выполнить очистку старых бэкапов
 */
async function performBackupCleanup(ctx) {
  console.log('ADMIN: Выполнение очистки старых бэкапов');
  
  try {
    await ctx.answerCbQuery();
    
    await ctx.editMessageText(
      '🗑️ *Очистка старых бэкапов...*\n\n⏳ Анализ и удаление устаревших файлов...',
      { parse_mode: 'Markdown' }
    );
    
    const response = await apiClient.post('/admin/backup/cleanup', {
      adminId: ctx.from.id
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка очистки');
    }
    
    const result = response.data.data.cleanup;
    
    let message = '✅ *Очистка завершена успешно!*\n\n';
    message += `🗑️ Удалено бэкапов: ${result.deletedCount}\n`;
    message += `💾 Освобождено места: ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB\n`;
    message += `📦 Осталось бэкапов: ${result.remainingCount}\n`;
    message += `⏰ Время выполнения: ${result.duration}ms\n\n`;
    
    if (result.deletedBackups && result.deletedBackups.length > 0) {
      message += `**Удаленные бэкапы:**\n`;
      result.deletedBackups.slice(0, 5).forEach(backup => {
        message += `• ${getBackupTypeDisplayName(backup.type)} от ${new Date(backup.createdAt).toLocaleDateString('ru-RU')}\n`;
      });
      
      if (result.deletedBackups.length > 5) {
        message += `... и еще ${result.deletedBackups.length - 5} бэкапов\n`;
      }
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Список бэкапов', 'backup_list')],
      [Markup.button.callback('📊 Статистика', 'backup_stats')],
      [Markup.button.callback('◀️ Назад', 'backup_menu')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка очистки бэкапов:', error);
    
    let errorMessage = '❌ *Ошибка очистки бэкапов*\n\n';
    errorMessage += `📝 ${error.message}\n\n`;
    errorMessage += 'Проверьте права доступа и доступное место на диске.';
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Попробовать снова', 'backup_cleanup')],
      [Markup.button.callback('◀️ Назад', 'backup_menu')]
    ]);
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

// Вспомогательные функции
function getBackupTypeDisplayName(type) {
  const names = {
    'full': 'Полный бэкап',
    'users': 'Пользователи',
    'financial': 'Финансы',
    'games': 'Игры',
    'settings': 'Настройки',
    'incremental': 'Инкрементальный',
    'differential': 'Дифференциальный'
  };
  return names[type] || type;
}

function getBackupTypeEmoji(type) {
  const emojis = {
    'full': '🏦',
    'users': '👥',
    'financial': '💰',
    'games': '🎮',
    'settings': '⚙️',
    'incremental': '📈',
    'differential': '🔄'
  };
  return emojis[type] || '💾';
}

module.exports = {
  showBackupMenu,
  createBackup,
  performBackup,
  showBackupList,
  showBackupStats,
  showBackupSettings,
  performBackupCleanup
};