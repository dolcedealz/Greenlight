// admin/src/commands/users.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// Получаем API URL и токен из переменных окружения
// Принудительно устанавливаем правильный URL для продакшена
const apiUrl = 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// Логируем URL для отладки
console.log('USERS COMMAND: API URL:', apiUrl);

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
  
  // Преобразуем в строку и удаляем проблемные символы
  let cleaned = text.toString()
    // Удаляем все невидимые и управляющие символы Unicode
    .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3000\uFE00-\uFE0F\uFEFF]/g, '')
    // Удаляем другие проблемные Unicode символы
    .replace(/[\u2000-\u206F]/g, '')
    // Заменяем неразрывные пробелы на обычные
    .replace(/\u00A0/g, ' ')
    // Удаляем лишние пробелы
    .replace(/\s+/g, ' ')
    .trim();
  
  // Если после очистки строка пустая, возвращаем безопасную замену
  if (!cleaned) {
    return 'Unknown';
  }
  
  // Экранируем специальные символы Markdown v2
  return cleaned.replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Показать список пользователей
 */
async function showUsersList(ctx, page = 1) {
  console.log('ADMIN: Запрос списка пользователей, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/users', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения пользователей');
    }
    
    const data = response.data.data;
    const users = data.users;
    const pagination = data.pagination;
    
    if (users.length === 0) {
      const message = '👥 *Список пользователей*\n\nПользователи не найдены.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('◀️ Назад', 'users_menu')
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
    
    let message = `👥 *Список пользователей* (стр. ${pagination.current}/${pagination.pages})\n\n`;
    
    users.forEach((user, index) => {
      try {
        const userNum = (pagination.current - 1) * 10 + index + 1;
        const statusEmoji = user.isBlocked ? '🚫' : '✅';
        
        // Безопасная обработка username
        let username = 'Нет username';
        if (user.username && typeof user.username === 'string') {
          const cleanUsername = escapeMarkdown(user.username);
          if (cleanUsername && cleanUsername !== 'Unknown') {
            username = `@${cleanUsername}`;
          }
        }
        
        // Безопасная обработка имен
        const firstName = escapeMarkdown(user.firstName || 'Пользователь');
        const lastName = escapeMarkdown(user.lastName || '');
        
        // Создаем полное имя, убеждаемся что оно не пустое
        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName || fullName === 'Unknown Unknown' || fullName === 'Unknown') {
          fullName = `Пользователь ${user.telegramId || userNum}`;
        }
        
        message += `${userNum}\\. ${statusEmoji} *${fullName}*\n`;
        message += `   ${username}\n`;
        message += `   💰 Баланс: ${(user.balance || 0).toFixed(2)} USDT\n`;
        message += `   📊 Прибыль: ${((user.totalWon || 0) - (user.totalWagered || 0)).toFixed(2)} USDT\n`;
        message += `   🎮 Игр: ${user.totalGames || 0}\n`;
        
        // Партнерский статус
        const partnerLevel = user.partnerLevel && user.partnerLevel !== 'none' ? user.partnerLevel : null;
        if (partnerLevel) {
          const partnerEmoji = {
            'partner_bronze': '🥉',
            'partner_silver': '🥈',
            'partner_gold': '🥇'
          }[partnerLevel] || '👔';
          message += `   ${partnerEmoji} Партнер: ${partnerLevel}\n`;
        }
        
        // Безопасная обработка даты
        try {
          const regDate = new Date(user.createdAt).toLocaleDateString('ru-RU');
          message += `   📅 Регистрация: ${regDate}\n\n`;
        } catch (dateError) {
          message += `   📅 Регистрация: Неизвестно\n\n`;
        }
      } catch (userError) {
        console.error('ADMIN: Ошибка обработки пользователя:', userError, user);
        message += `${(pagination.current - 1) * 10 + index + 1}\\. ❌ *Ошибка отображения пользователя*\n\n`;
      }
    });
    
    // Создаем клавиатуру с кнопками навигации и действиями
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅ Пред.', `users_list_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡', `users_list_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Основные действия
    buttons.push([
      Markup.button.callback('🔍 Поиск', 'users_search'),
      Markup.button.callback('📊 Статистика', 'users_stats')
    ]);
    
    buttons.push([Markup.button.callback('🔄 Обновить', 'users_list')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'users_menu')]);
    
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
    console.error('ADMIN: Ошибка получения списка пользователей:', error);
    const errorMessage = `❌ Ошибка получения пользователей: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Начать поиск пользователя
 */
async function startUserSearch(ctx) {
  console.log('ADMIN: Начало поиска пользователя');
  
  ctx.session = ctx.session || {};
  ctx.session.searchingUser = {
    step: 'query'
  };
  
  const message = '🔍 *Поиск пользователя*\n\nВведите:\n• Telegram ID\n• Username (без @)\n• Имя или фамилию\n• Email';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', 'users_search_cancel')
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
 * Обработать поиск пользователя
 */
async function handleUserSearch(ctx) {
  if (!ctx.session || !ctx.session.searchingUser) {
    return;
  }
  
  const query = ctx.message.text.trim();
  console.log('ADMIN: Поиск пользователя по запросу:', query);
  
  try {
    const response = await apiClient.get('/admin/users', {
      params: { 
        search: query,
        limit: 20
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка поиска');
    }
    
    const users = response.data.data.users;
    
    if (users.length === 0) {
      await ctx.reply(
        '❌ Пользователи не найдены.\n\nПопробуйте другой запрос:',
        Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'users_search_cancel')
        ]])
      );
      return;
    }
    
    let message = `🔍 *Результаты поиска* (найдено: ${users.length})\n\n`;
    
    const buttons = [];
    
    users.slice(0, 10).forEach((user, index) => {
      try {
        const statusEmoji = user.isBlocked ? '🚫' : '✅';
        
        // Безопасная обработка username
        let username = 'Нет username';
        if (user.username && typeof user.username === 'string') {
          const cleanUsername = escapeMarkdown(user.username);
          if (cleanUsername && cleanUsername !== 'Unknown') {
            username = `@${cleanUsername}`;
          }
        }
        
        const firstName = escapeMarkdown(user.firstName || 'Пользователь');
        const lastName = escapeMarkdown(user.lastName || '');
        
        // Создаем безопасное имя для отображения
        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName || fullName === 'Unknown Unknown' || fullName === 'Unknown') {
          fullName = `Пользователь ${user.telegramId || index + 1}`;
        }
        
        // Безопасное имя для кнопки (без спецсимволов)
        let buttonName = `${firstName} ${lastName}`.trim().replace(/[_*\[\]()~`>#+=|{}.!\\-]/g, '');
        if (!buttonName || buttonName.length < 2) {
          buttonName = `Пользователь ${index + 1}`;
        }
        
        message += `${index + 1}. ${statusEmoji} *${fullName}*\n`;
        message += `   ${username} | ID: \`${user.telegramId || 'unknown'}\`\n`;
        message += `   💰 ${(user.balance || 0).toFixed(2)} USDT | `;
        message += `🎮 ${user.totalGames || 0} игр\n`;
        
        // Партнерский статус в поиске
        const partnerLevel = user.partnerLevel && user.partnerLevel !== 'none' ? user.partnerLevel : null;
        if (partnerLevel) {
          const partnerEmoji = {
            'partner_bronze': '🥉',
            'partner_silver': '🥈',
            'partner_gold': '🥇'
          }[partnerLevel] || '👔';
          message += `   ${partnerEmoji} ${partnerLevel}\n`;
        }
        message += `\n`;
        
        // Добавляем кнопку для просмотра деталей пользователя
        buttons.push([Markup.button.callback(
          `👤 ${buttonName}`, 
          `user_details_${user._id}`
        )]);
      } catch (userError) {
        console.error('ADMIN: Ошибка обработки пользователя в поиске:', userError, user);
        message += `${index + 1}. ❌ *Ошибка отображения пользователя*\n\n`;
      }
    });
    
    if (users.length > 10) {
      message += `\n... и еще ${users.length - 10} пользователей`;
    }
    
    buttons.push([
      Markup.button.callback('🔍 Новый поиск', 'users_search'),
      Markup.button.callback('◀️ Назад', 'users_menu')
    ]);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
    
    // Очищаем сессию поиска
    delete ctx.session.searchingUser;
    
  } catch (error) {
    console.error('ADMIN: Ошибка поиска пользователя:', error);
    await ctx.reply(`❌ Ошибка поиска: ${error.message}`);
  }
}

/**
 * Показать детали пользователя
 */
async function showUserDetails(ctx, userId) {
  console.log('ADMIN: Запрос деталей пользователя:', userId);
  
  try {
    const response = await apiClient.get(`/admin/users/${userId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Пользователь не найден');
    }
    
    const data = response.data.data;
    const user = data.user;
    const gameStats = data.gameStats || [];
    const recentTransactions = data.recentTransactions || [];
    
    const firstName = escapeMarkdown(user.firstName || '');
    const lastName = escapeMarkdown(user.lastName || '');
    
    let message = `👤 *Профиль пользователя*\n\n`;
    message += `**Основная информация:**\n`;
    message += `ФИО: ${firstName} ${lastName}\n`;
    message += `Username: ${user.username ? `@${user.username}` : 'Не указан'}\n`;
    message += `Telegram ID: \`${user.telegramId}\`\n`;
    message += `Роль: ${user.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}\n`;
    message += `Статус: ${user.isBlocked ? '🚫 Заблокирован' : '✅ Активен'}\n\n`;
    
    message += `**Финансы:**\n`;
    message += `💰 Баланс: ${user.balance.toFixed(2)} USDT\n`;
    message += `📈 Всего поставлено: ${user.totalWagered.toFixed(2)} USDT\n`;
    message += `📊 Всего выиграно: ${user.totalWon.toFixed(2)} USDT\n`;
    message += `💰 Прибыль/убыток: ${(user.totalWon - user.totalWagered).toFixed(2)} USDT\n\n`;
    
    if (gameStats.length > 0) {
      message += `**Статистика по играм:**\n`;
      gameStats.forEach(stat => {
        const gameEmoji = {
          'coin': '🪙',
          'crash': '🚀',
          'slots': '🎰',
          'mines': '💣'
        }[stat._id] || '🎮';
        
        message += `${gameEmoji} ${stat._id}: ${stat.totalGames} игр, `;
        message += `${stat.totalBet.toFixed(2)} USDT ставок\n`;
      });
      message += '\n';
    }
    
    // Партнерский статус (если есть)
    if (user.partnerLevel && user.partnerLevel !== 'none') {
      message += `**Партнерский статус:**\n`;
      const partnerEmoji = {
        'partner_bronze': '🥉',
        'partner_silver': '🥈',
        'partner_gold': '🥇'
      }[user.partnerLevel] || '👔';
      
      const partnerCommission = {
        'partner_bronze': '20%',
        'partner_silver': '30%',
        'partner_gold': '40%'
      }[user.partnerLevel] || 'неизвестно';
      
      message += `${partnerEmoji} Уровень: ${user.partnerLevel}\n`;
      message += `💰 Комиссия: ${partnerCommission}\n`;
      
      if (user.partnerMeta?.assignedAt) {
        const assignedDate = new Date(user.partnerMeta.assignedAt).toLocaleDateString('ru-RU');
        message += `📅 Назначен: ${assignedDate}\n`;
      }
      message += '\n';
    }
    
    message += `**Реферальная программа:**\n`;
    if (user.referralStats) {
      message += `🎯 Уровень: ${user.referralStats.level}\n`;
      message += `👥 Рефералов: ${user.referralStats.totalReferrals}\n`;
      message += `💰 Заработано: ${user.referralStats.totalEarned.toFixed(2)} USDT\n`;
      message += `🎯 Баланс реферальных: ${user.referralStats.referralBalance.toFixed(2)} USDT\n\n`;
    }
    
    message += `**Даты:**\n`;
    message += `📅 Регистрация: ${new Date(user.createdAt).toLocaleString('ru-RU')}\n`;
    message += `🕒 Последняя активность: ${new Date(user.lastActivity).toLocaleString('ru-RU')}`;
    
    const buttons = [
      [
        Markup.button.callback(
          user.isBlocked ? '✅ Разблокировать' : '🚫 Заблокировать', 
          `user_toggle_block_${user._id}`
        ),
        Markup.button.callback('💰 Изменить баланс', `user_balance_${user._id}`)
      ],
      [
        Markup.button.callback('🎯 Модификаторы', `user_modifiers_${user._id}`),
        Markup.button.callback('💳 Транзакции', `user_transactions_${user._id}`)
      ],
      [Markup.button.callback('🔄 Обновить', `user_details_${user._id}`)],
      [Markup.button.callback('🔍 К поиску', 'users_search')]
    ];
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    }
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения деталей пользователя:', error);
    const errorMessage = `❌ Ошибка: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать заблокированных пользователей
 */
async function showBlockedUsers(ctx, page = 1) {
  console.log('ADMIN: Запрос заблокированных пользователей, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/users/blocked', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения заблокированных пользователей');
    }
    
    const data = response.data.data;
    const users = data.users;
    const pagination = data.pagination;
    
    if (users.length === 0) {
      const message = '🚫 *Заблокированные пользователи*\\n\\nЗаблокированных пользователей нет.';
      const keyboard = Markup.inlineKeyboard([[\n        Markup.button.callback('◀️ Назад', 'users_menu')\n      ]]);
      
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
    
    let message = `🚫 *Заблокированные пользователи* (стр. ${pagination.current}/${pagination.pages})\\n\\n`;
    
    users.forEach((user, index) => {
      try {
        const userNum = (pagination.current - 1) * 10 + index + 1;
        
        // Безопасная обработка username
        let username = 'Нет username';
        if (user.username && typeof user.username === 'string') {
          const cleanUsername = escapeMarkdown(user.username);
          if (cleanUsername && cleanUsername !== 'Unknown') {
            username = `@${cleanUsername}`;
          }
        }
        
        // Безопасная обработка имен
        const firstName = escapeMarkdown(user.firstName || 'Пользователь');
        const lastName = escapeMarkdown(user.lastName || '');
        
        // Создаем полное имя
        let fullName = `${firstName} ${lastName}`.trim();
        if (!fullName || fullName === 'Unknown Unknown' || fullName === 'Unknown') {
          fullName = `Пользователь ${user.telegramId || userNum}`;
        }
        
        message += `${userNum}\\\\. 🚫 *${fullName}*\\n`;
        message += `   ${username}\\n`;
        message += `   💰 Баланс: ${(user.balance || 0).toFixed(2)} USDT\\n`;
        message += `   🎮 Игр: ${user.totalGames || 0}\\n`;
        
        // Партнерский статус
        const partnerLevel = user.partnerLevel && user.partnerLevel !== 'none' ? user.partnerLevel : null;
        if (partnerLevel) {
          const partnerEmoji = {
            'partner_bronze': '🥉',
            'partner_silver': '🥈',
            'partner_gold': '🥇'
          }[partnerLevel] || '👔';
          message += `   ${partnerEmoji} Партнер: ${partnerLevel}\\n`;
        }
        
        // Безопасная обработка даты
        try {
          const regDate = new Date(user.createdAt).toLocaleDateString('ru-RU');
          message += `   📅 Заблокирован: ${regDate}\\n\\n`;
        } catch (dateError) {
          message += `   📅 Заблокирован: Неизвестно\\n\\n`;
        }
      } catch (userError) {
        console.error('ADMIN: Ошибка обработки заблокированного пользователя:', userError, user);
        message += `${(pagination.current - 1) * 10 + index + 1}\\\\. ❌ *Ошибка отображения пользователя*\\n\\n`;
      }
    });
    
    // Создаем клавиатуру с кнопками навигации
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅ Пред.', `users_blocked_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡', `users_blocked_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    buttons.push([Markup.button.callback('🔄 Обновить', 'users_blocked')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'users_menu')]);
    
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
    console.error('ADMIN: Ошибка получения заблокированных пользователей:', error);
    const errorMessage = `❌ Ошибка получения заблокированных пользователей: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику пользователей
 */
async function showUsersStats(ctx) {
  console.log('ADMIN: Запрос статистики пользователей');
  
  try {
    // Получаем общую статистику
    const response = await apiClient.get('/admin/stats/users');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = '👥 *Статистика пользователей*\n\n';
    
    message += `**Общая информация:**\n`;
    message += `👥 Всего пользователей: ${stats.totalUsers || 0}\n`;
    message += `✅ Активных: ${stats.activeToday || 0}\n`;
    message += `🚫 Заблокированных: ${stats.blocked || 0}\n`;
    message += `👑 Администраторов: ${stats.adminUsers || 0}\n\n`;
    
    message += `**Активность:**\n`;
    message += `🆕 Новых за сутки: ${stats.newUsersToday || 0}\n`;
    message += `📅 Новых за неделю: ${stats.newUsersWeek || 0}\n`;
    message += `🎮 Играли сегодня: ${stats.playedToday || 0}\n`;
    message += `💰 Сделали депозит: ${stats.usersWithDeposits || 0}\n\n`;
    
    message += `**Финансы:**\n`;
    message += `💰 Общий баланс всех пользователей: ${(stats.totalUserBalances || 0).toFixed(2)} USDT\n`;
    message += `📊 Средний баланс: ${((stats.totalUserBalances || 0) / (stats.totalUsers || 1)).toFixed(2)} USDT\n`;
    message += `🎰 Общий объем ставок: ${(stats.totalWagered || 0).toFixed(2)} USDT\n`;
    message += `🎯 Общие выигрыши: ${(stats.totalWon || 0).toFixed(2)} USDT`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'users_stats')],
      [Markup.button.callback('◀️ Назад', 'users_menu')]
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
    console.error('ADMIN: Ошибка получения статистики пользователей:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Переключить блокировку пользователя
 */
async function toggleUserBlock(ctx, userId) {
  console.log('ADMIN: Переключение блокировки пользователя:', userId);
  
  try {
    const response = await apiClient.post(`/admin/users/${userId}/block`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка изменения статуса');
    }
    
    const result = response.data.data;
    const status = result.isBlocked ? 'заблокирован' : 'разблокирован';
    
    await ctx.answerCbQuery(`✅ Пользователь ${status}`);
    
    // Обновляем информацию о пользователе
    await showUserDetails(ctx, userId);
    
  } catch (error) {
    console.error('ADMIN: Ошибка переключения блокировки:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Начать изменение баланса пользователя
 */
async function startBalanceAdjustment(ctx, userId) {
  console.log('ADMIN: Начало изменения баланса пользователя:', userId);
  
  ctx.session = ctx.session || {};
  ctx.session.adjustingBalance = {
    userId: userId,
    step: 'amount'
  };
  
  const message = '💰 *Изменение баланса пользователя*\n\nВведите сумму изменения:\n\n• Положительное число для начисления\n• Отрицательное число для списания\n\nПример: +100 или -50';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', `user_details_${userId}`)
  ]]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Обработать изменение баланса
 */
async function handleBalanceAdjustment(ctx) {
  if (!ctx.session || !ctx.session.adjustingBalance) {
    return;
  }
  
  const session = ctx.session.adjustingBalance;
  const text = ctx.message.text.trim();
  
  if (session.step === 'amount') {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount === 0) {
      await ctx.reply('❌ Введите корректную сумму (число, не равное нулю):');
      return;
    }
    
    session.amount = amount;
    session.step = 'reason';
    
    await ctx.reply(
      `💰 Сумма: ${amount > 0 ? '+' : ''}${amount.toFixed(2)} USDT\n\nТеперь введите причину изменения:`,
      Markup.inlineKeyboard([[
        Markup.button.callback('❌ Отмена', `user_details_${session.userId}`)
      ]])
    );
    
  } else if (session.step === 'reason') {
    const reason = text;
    
    if (reason.length < 5) {
      await ctx.reply('❌ Причина должна содержать минимум 5 символов:');
      return;
    }
    
    try {
      const response = await apiClient.post(`/admin/users/${session.userId}/balance`, {
        amount: session.amount,
        reason: reason
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка изменения баланса');
      }
      
      const result = response.data.data;
      
      await ctx.reply(
        `✅ *Баланс изменен успешно!*\n\n` +
        `📊 Было: ${result.oldBalance.toFixed(2)} USDT\n` +
        `📊 Стало: ${result.newBalance.toFixed(2)} USDT\n` +
        `💰 Изменение: ${result.adjustment > 0 ? '+' : ''}${result.adjustment.toFixed(2)} USDT\n` +
        `📝 Причина: ${reason}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('👤 К профилю', `user_details_${session.userId}`)
          ]])
        }
      );
      
      delete ctx.session.adjustingBalance;
      
    } catch (error) {
      console.error('ADMIN: Ошибка изменения баланса:', error);
      await ctx.reply(`❌ Ошибка изменения баланса: ${error.message}`);
    }
  }
}

/**
 * Показать меню пользователей
 */
async function showUsersMenu(ctx) {
  console.log('ADMIN: Показ меню пользователей');
  
  const message = '👥 *Управление пользователями*\n\nВыберите действие:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Список пользователей', 'users_list'),
      Markup.button.callback('🔍 Поиск пользователя', 'users_search')
    ],
    [
      Markup.button.callback('📊 Статистика', 'users_stats'),
      Markup.button.callback('🚫 Заблокированные', 'users_blocked')
    ],
    [
      Markup.button.callback('👑 Управление партнерами', 'partners_menu')
    ],
    [
      Markup.button.callback('🔙 Назад', 'main_menu')
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
    console.error('ADMIN: Ошибка показа меню пользователей:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать меню управления партнерами
 */
async function showPartnersMenu(ctx) {
  console.log('ADMIN: Показ меню партнеров');
  
  const message = '👔 *Управление партнерами*\n\nВыберите действие:';
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Список партнеров', 'partners_list'),
      Markup.button.callback('➕ Назначить статус', 'partners_assign')
    ],
    [
      Markup.button.callback('🔍 Поиск партнера', 'partners_search'),
      Markup.button.callback('📊 Статистика', 'partners_stats')
    ],
    [
      Markup.button.callback('📜 История изменений', 'partners_logs'),
      Markup.button.callback('🎯 Уровни партнеров', 'partners_levels')
    ],
    [
      Markup.button.callback('🔙 К пользователям', 'users_menu')
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
    console.error('ADMIN: Ошибка показа меню партнеров:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Показать список партнеров
 */
async function showPartnersList(ctx, page = 1) {
  console.log('ADMIN: Запрос списка партнеров, страница:', page);
  
  try {
    // Используем новую функцию из referral service
    const response = await apiClient.get('/admin/referral/partners', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения партнеров');
    }
    
    const data = response.data.data;
    const partners = data.partners;
    const summary = data.summary;
    const pagination = data.pagination;
    
    if (partners.length === 0) {
      const message = '👔 *Список партнеров*\n\nПартнеры не найдены.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('◀️ Назад', 'partners_menu')
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
    
    let message = `👔 *Список партнеров* (стр. ${Math.floor(pagination.offset / pagination.limit) + 1})`;
    
    // Добавляем сводку по уровням
    if (summary && summary.length > 0) {
      message += '\n\n📊 *Сводка по уровням:*\n';
      summary.forEach(level => {
        const levelEmoji = {
          'partner_bronze': '🥉',
          'partner_silver': '🥈', 
          'partner_gold': '🥇'
        }[level._id] || '❓';
        
        message += `${levelEmoji} ${level._id}: ${level.count} чел.\n`;
      });
    }
    
    message += '\n\n👔 *Партнеры:*\n\n';
    
    partners.forEach((partner, index) => {
      const partnerNum = pagination.offset + index + 1;
      const levelEmoji = {
        'partner_bronze': '🥉',
        'partner_silver': '🥈',
        'partner_gold': '🥇'
      }[partner.partnerLevel] || '❓';
      
      const username = partner.username ? `@${partner.username}` : 'Нет username';
      
      message += `${partnerNum}. ${levelEmoji} *${partner.username || partner.telegramId}*\n`;
      message += `   Уровень: ${partner.partnerLevel}\n`;
      message += `   👥 Рефералов: ${partner.referralStats?.totalReferrals || 0}\n`;
      message += `   💰 Заработано: ${(partner.referralStats?.totalEarned || 0).toFixed(2)} USDT\n`;
      
      if (partner.partnerMeta?.assignedAt) {
        const assignedDate = new Date(partner.partnerMeta.assignedAt).toLocaleDateString('ru-RU');
        message += `   📅 Назначен: ${assignedDate}\n`;
      }
      
      message += '\n';
    });
    
    // Создаем клавиатуру с кнопками навигации
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.offset > 0 || pagination.hasMore) {
      const navButtons = [];
      if (pagination.offset > 0) {
        const prevPage = Math.floor((pagination.offset - pagination.limit) / pagination.limit) + 1;
        navButtons.push(Markup.button.callback('⬅ Пред.', `partners_list_${prevPage}`));
      }
      if (pagination.hasMore) {
        const nextPage = Math.floor(pagination.offset / pagination.limit) + 2;
        navButtons.push(Markup.button.callback('След. ➡', `partners_list_${nextPage}`));
      }
      buttons.push(navButtons);
    }
    
    // Основные действия
    buttons.push([
      Markup.button.callback('➕ Назначить статус', 'partners_assign'),
      Markup.button.callback('📊 Статистика', 'partners_stats')
    ]);
    
    buttons.push([Markup.button.callback('🔄 Обновить', 'partners_list')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'partners_menu')]);
    
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
    console.error('ADMIN: Ошибка получения списка партнеров:', error);
    const errorMessage = `❌ Ошибка получения партнеров: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Начать назначение партнерского статуса
 */
async function startPartnerAssignment(ctx) {
  console.log('ADMIN: Начало назначения партнерского статуса');
  
  ctx.session = ctx.session || {};
  ctx.session.assigningPartner = {
    step: 'userId'
  };
  
  const message = '➕ *Назначение партнерского статуса*\n\nВведите Telegram ID или username пользователя:';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', 'partners_menu')
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
 * Обработать назначение партнерского статуса
 */
async function handlePartnerAssignment(ctx) {
  if (!ctx.session || !ctx.session.assigningPartner) {
    return;
  }
  
  const session = ctx.session.assigningPartner;
  const text = ctx.message.text.trim();
  
  if (session.step === 'userId') {
    try {
      // Поиск пользователя
      const response = await apiClient.get('/admin/users', {
        params: { search: text, limit: 1 }
      });
      
      if (!response.data.success || response.data.data.users.length === 0) {
        await ctx.reply('❌ Пользователь не найден. Попробуйте еще раз:');
        return;
      }
      
      const user = response.data.data.users[0];
      session.user = user;
      session.step = 'level';
      
      const currentLevel = user.partnerLevel === 'none' ? 'Обычный пользователь' : user.partnerLevel;
      
      const message = `👤 *Пользователь найден:*\n\n` +
        `Имя: ${user.firstName} ${user.lastName || ''}\n` +
        `Username: ${user.username ? `@${user.username}` : 'Не указан'}\n` +
        `Telegram ID: \`${user.telegramId}\`\n` +
        `Текущий статус: ${currentLevel}\n\n` +
        `Выберите новый партнерский уровень:`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🥉 Партнер Бронза (20%)', 'assign_partner_bronze'),
          Markup.button.callback('🥈 Партнер Серебро (30%)', 'assign_partner_silver')
        ],
        [
          Markup.button.callback('🥇 Партнер Золото (40%)', 'assign_partner_gold'),
          Markup.button.callback('❌ Убрать статус', 'assign_none')
        ],
        [
          Markup.button.callback('🔙 Отмена', 'partners_menu')
        ]
      ]);
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
      
    } catch (error) {
      console.error('ADMIN: Ошибка поиска пользователя:', error);
      await ctx.reply('❌ Ошибка поиска пользователя. Попробуйте еще раз:');
    }
    
  } else if (session.step === 'reason') {
    const reason = text;
    
    if (reason.length < 3) {
      await ctx.reply('❌ Причина должна содержать минимум 3 символа:');
      return;
    }
    
    try {
      // Назначаем партнерский статус
      const response = await apiClient.post('/admin/referral/assign-partner', {
        userId: session.user._id,
        newLevel: session.selectedLevel,
        reason: reason,
        metadata: {
          ipAddress: ctx.from?.id || 'unknown',
          userAgent: 'Telegram Admin Bot'
        }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка назначения статуса');
      }
      
      const result = response.data.data;
      
      const actionText = {
        'assign': 'назначен',
        'change': 'изменен',
        'remove': 'убран'
      }[result.action] || 'обновлен';
      
      await ctx.reply(
        `✅ *Партнерский статус ${actionText}!*\n\n` +
        `👤 Пользователь: ${result.user.username}\n` +
        `📊 Было: ${result.user.previousLevel}\n` +
        `📊 Стало: ${result.user.newLevel}\n` +
        `💰 Комиссия: ${result.user.commissionPercent}%\n` +
        `👑 Админ: ${result.admin.username}\n` +
        `📝 Причина: ${reason}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('📋 К списку партнеров', 'partners_list')
          ]])
        }
      );
      
      delete ctx.session.assigningPartner;
      
    } catch (error) {
      console.error('ADMIN: Ошибка назначения партнерского статуса:', error);
      await ctx.reply(`❌ Ошибка назначения статуса: ${error.message}`);
    }
  }
}

/**
 * Обработать выбор партнерского уровня
 */
async function handlePartnerLevelSelection(ctx, level) {
  console.log(`ADMIN: Выбор партнерского уровня: ${level}`);
  
  if (!ctx.session || !ctx.session.assigningPartner) {
    return ctx.answerCbQuery('❌ Сессия назначения статуса истекла');
  }
  
  ctx.session.assigningPartner.selectedLevel = level;
  ctx.session.assigningPartner.step = 'reason';
  
  const levelNames = {
    'partner_bronze': '🥉 Партнер Бронза (20%)',
    'partner_silver': '🥈 Партнер Серебро (30%)',
    'partner_gold': '🥇 Партнер Золото (40%)',
    'none': '❌ Убрать партнерский статус'
  };
  
  const selectedLevelName = levelNames[level] || level;
  
  await ctx.editMessageText(
    `📝 *Подтверждение назначения*\n\n` +
    `👤 Пользователь: ${ctx.session.assigningPartner.user.firstName} ${ctx.session.assigningPartner.user.lastName || ''}\n` +
    `📊 Новый статус: ${selectedLevelName}\n\n` +
    `Введите причину назначения:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[
        Markup.button.callback('🔙 Отмена', 'partners_menu')
      ]])
    }
  );
  
  await ctx.answerCbQuery();
}

/**
 * Показать историю изменений партнерских статусов
 */
async function showPartnersLogs(ctx, page = 1) {
  console.log('ADMIN: Запрос истории партнеров, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/referral/partner-logs', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения истории');
    }
    
    const data = response.data.data;
    const logs = data.logs;
    const pagination = data.pagination;
    
    if (logs.length === 0) {
      const message = '📜 *История изменений*\n\nИстория пуста.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('◀️ Назад', 'partners_menu')
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
    
    let message = `📜 *История изменений* (стр. ${Math.floor(pagination.offset / pagination.limit) + 1})\n\n`;
    
    logs.forEach((log, index) => {
      const logNum = pagination.offset + index + 1;
      const actionEmoji = {
        'assign': '➕',
        'change': '🔄',
        'remove': '❌'
      }[log.action] || '❓';
      
      const userName = log.user?.username || log.user?.telegramId || 'Неизвестно';
      const adminName = log.admin?.username || log.admin?.telegramId || 'Неизвестно';
      
      message += `${logNum}. ${actionEmoji} *${log.action}*\n`;
      message += `   👤 Пользователь: ${userName}\n`;
      message += `   📊 ${log.previousLevel} → ${log.newLevel}\n`;
      message += `   👑 Админ: ${adminName}\n`;
      
      if (log.reason) {
        message += `   📝 Причина: ${log.reason}\n`;
      }
      
      const date = new Date(log.createdAt).toLocaleString('ru-RU');
      message += `   📅 ${date}\n\n`;
    });
    
    // Создаем клавиатуру с кнопками навигации
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.offset > 0 || pagination.hasMore) {
      const navButtons = [];
      if (pagination.offset > 0) {
        const prevPage = Math.floor((pagination.offset - pagination.limit) / pagination.limit) + 1;
        navButtons.push(Markup.button.callback('⬅ Пред.', `partners_logs_${prevPage}`));
      }
      if (pagination.hasMore) {
        const nextPage = Math.floor(pagination.offset / pagination.limit) + 2;
        navButtons.push(Markup.button.callback('След. ➡', `partners_logs_${nextPage}`));
      }
      buttons.push(navButtons);
    }
    
    buttons.push([Markup.button.callback('🔄 Обновить', 'partners_logs')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'partners_menu')]);
    
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
    console.error('ADMIN: Ошибка получения истории партнеров:', error);
    const errorMessage = `❌ Ошибка получения истории: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику партнерской программы
 */
async function showPartnersStats(ctx) {
  console.log('ADMIN: Запрос статистики партнеров');
  
  try {
    const response = await apiClient.get('/admin/referral/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = '📊 *Статистика партнерской программы*\n\n';
    
    // Статистика по партнерам
    if (stats.partners) {
      message += '👔 *Партнеры:*\n';
      message += `   Всего партнеров: ${stats.partners.total}\n`;
      message += `   Активный баланс: ${stats.partners.totalBalance.toFixed(2)} USDT\n\n`;
      
      if (stats.partners.byLevel && stats.partners.byLevel.length > 0) {
        message += '   По уровням:\n';
        stats.partners.byLevel.forEach(level => {
          const levelEmoji = {
            'partner_bronze': '🥉',
            'partner_silver': '🥈',
            'partner_gold': '🥇'
          }[level._id] || '❓';
          
          message += `   ${levelEmoji} ${level._id}: ${level.count} (${level.totalEarned.toFixed(2)} USDT)\n`;
        });
      }
      message += '\n';
    }
    
    // Статистика по рефералам
    if (stats.referrals) {
      message += '👥 *Рефералы:*\n';
      message += `   Всего рефералов: ${stats.referrals.total}\n`;
      message += `   Активных: ${stats.referrals.active}\n`;
      message += `   С депозитами: ${stats.referrals.withDeposits}\n`;
      message += `   Конверсия: ${stats.referrals.conversionRate}%\n\n`;
    }
    
    // Финансовая статистика
    if (stats.finance) {
      message += '💰 *Финансы:*\n';
      message += `   Общие выплаты: ${stats.finance.totalReferralPayments.toFixed(2)} USDT\n`;
      message += `   К выплате: ${stats.finance.pendingPayouts.toFixed(2)} USDT\n`;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'partners_stats')],
      [Markup.button.callback('◀️ Назад', 'partners_menu')]
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
    console.error('ADMIN: Ошибка получения статистики партнеров:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать информацию об уровнях партнеров
 */
async function showPartnerLevels(ctx) {
  console.log('ADMIN: Показ уровней партнеров');
  
  const message = `🎯 *Уровни партнеров*\n\n` +
    `**Автоматические уровни (по рефералам):**\n` +
    `🥉 Бронза: 0+ активных рефералов (5%)\n` +
    `🥈 Серебро: 6+ активных рефералов (7%)\n` +
    `🥇 Золото: 21+ активных рефералов (10%)\n` +
    `💎 Платина: 51+ активных рефералов (12%)\n` +
    `🌟 VIP: 101+ активных рефералов (15%)\n\n` +
    `**Партнерские уровни (назначаются админом):**\n` +
    `🥉 Партнер Бронза: комиссия 20%\n` +
    `🥈 Партнер Серебро: комиссия 30%\n` +
    `🥇 Партнер Золото: комиссия 40%\n\n` +
    `*Партнерские уровни имеют приоритет над автоматическими*`;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('◀️ Назад', 'partners_menu')]
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
}

module.exports = {
  showUsersMenu,
  showUsersList,
  showBlockedUsers,
  startUserSearch,
  handleUserSearch,
  showUserDetails,
  showUsersStats,
  toggleUserBlock,
  startBalanceAdjustment,
  handleBalanceAdjustment,
  // Новые функции для партнеров
  showPartnersMenu,
  showPartnersList,
  startPartnerAssignment,
  handlePartnerAssignment,
  handlePartnerLevelSelection,
  showPartnersLogs,
  showPartnersStats,
  showPartnerLevels
};