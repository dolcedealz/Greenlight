// admin/src/commands/users.command.js
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
      const userNum = (pagination.current - 1) * 10 + index + 1;
      const statusEmoji = user.isBlocked ? '🚫' : '✅';
      const username = user.username ? `@${user.username}` : 'Нет username';
      
      message += `${userNum}. ${statusEmoji} *${user.firstName} ${user.lastName || ''}*\n`;
      message += `   ${username}\n`;
      message += `   💰 Баланс: ${user.balance.toFixed(2)} USDT\n`;
      message += `   📊 Прибыль: ${((user.totalWon || 0) - (user.totalWagered || 0)).toFixed(2)} USDT\n`;
      message += `   🎮 Игр: ${user.totalGames || 0}\n`;
      message += `   📅 Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}\n\n`;
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
      const statusEmoji = user.isBlocked ? '🚫' : '✅';
      const username = user.username ? `@${user.username}` : 'Нет username';
      
      message += `${index + 1}. ${statusEmoji} *${user.firstName} ${user.lastName || ''}*\n`;
      message += `   ${username} | ID: \`${user.telegramId}\`\n`;
      message += `   💰 ${user.balance.toFixed(2)} USDT | `;
      message += `🎮 ${user.totalGames || 0} игр\n\n`;
      
      // Добавляем кнопку для просмотра деталей пользователя
      buttons.push([Markup.button.callback(
        `👤 ${user.firstName} ${user.lastName || ''}`, 
        `user_details_${user._id}`
      )]);
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
    
    let message = `👤 *Профиль пользователя*\n\n`;
    message += `**Основная информация:**\n`;
    message += `ФИО: ${user.firstName} ${user.lastName || ''}\n`;
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

module.exports = {
  showUsersMenu,
  showUsersList,
  startUserSearch,
  handleUserSearch,
  showUserDetails,
  showUsersStats,
  toggleUserBlock,
  startBalanceAdjustment,
  handleBalanceAdjustment
};