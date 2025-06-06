// admin/src/commands/transactions.command.js
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
 * Показать ожидающие одобрения выводы
 */
async function showPendingWithdrawals(ctx) {
  console.log('ADMIN: Запрос ожидающих одобрения выводов');
  
  try {
    const response = await apiClient.get('/admin/withdrawals/pending');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения выводов');
    }
    
    const withdrawals = response.data.data;
    
    if (withdrawals.length === 0) {
      const message = '⏳ *Ожидающие одобрения*\n\nНет выводов, ожидающих одобрения.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('🔄 Обновить', 'transactions_pending'),
        Markup.button.callback('◀️ Назад', 'transactions_menu')
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
    
    let message = `⏳ *Ожидающие одобрения* (${withdrawals.length})\n\n`;
    
    const buttons = [];
    
    withdrawals.slice(0, 5).forEach((withdrawal, index) => {
      const user = withdrawal.user;
      const username = user.username ? `@${user.username}` : 'Нет username';
      const suspiciousFlag = withdrawal.metadata?.suspicious ? '⚠️ ' : '';
      
      message += `${index + 1}. ${suspiciousFlag}*${withdrawal.amount.toFixed(2)} USDT*\n`;
      message += `   👤 ${user.firstName} ${user.lastName || ''} (${username})\n`;
      message += `   📱 ID: \`${user.telegramId}\`\n`;
      message += `   🏦 Получатель: \`${withdrawal.recipient}\`\n`;
      message += `   💰 Баланс пользователя: ${user.balance.toFixed(2)} USDT\n`;
      message += `   📅 Создан: ${new Date(withdrawal.createdAt).toLocaleString('ru-RU')}\n`;
      
      if (withdrawal.comment) {
        message += `   💬 Комментарий: ${withdrawal.comment}\n`;
      }
      
      if (withdrawal.metadata?.suspicious) {
        message += `   ⚠️ Подозрительный: ${withdrawal.metadata.suspicionReason}\n`;
      }
      
      message += '\n';
      
      // Добавляем кнопки одобрения/отклонения
      buttons.push([
        Markup.button.callback('✅ Одобрить', `approve_withdrawal_${withdrawal._id}`),
        Markup.button.callback('❌ Отклонить', `reject_withdrawal_${withdrawal._id}`)
      ]);
    });
    
    if (withdrawals.length > 5) {
      message += `\n... и еще ${withdrawals.length - 5} выводов`;
    }
    
    // Добавляем общие кнопки
    buttons.push([
      Markup.button.callback('📋 Все выводы', 'transactions_history'),
      Markup.button.callback('📊 Статистика', 'transactions_stats')
    ]);
    
    buttons.push([
      Markup.button.callback('🔄 Обновить', 'transactions_pending'),
      Markup.button.callback('◀️ Назад', 'transactions_menu')
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
    console.error('ADMIN: Ошибка получения ожидающих выводов:', error);
    const errorMessage = `❌ Ошибка получения выводов: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Одобрить вывод
 */
async function approveWithdrawal(ctx, withdrawalId) {
  console.log('ADMIN: Одобрение вывода:', withdrawalId);
  
  try {
    const response = await apiClient.post(`/admin/withdrawals/${withdrawalId}/approve`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка одобрения вывода');
    }
    
    const withdrawal = response.data.data;
    
    await ctx.answerCbQuery('✅ Вывод одобрен');
    
    // Отправляем подтверждение
    await ctx.reply(
      `✅ *Вывод одобрен и обработан*\n\n` +
      `💰 Сумма: ${withdrawal.amount.toFixed(2)} USDT\n` +
      `👤 Пользователь: ${withdrawal.user.firstName} ${withdrawal.user.lastName || ''}\n` +
      `🏦 Получатель: \`${withdrawal.recipient}\`\n` +
      `📅 Время: ${new Date().toLocaleString('ru-RU')}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('⏳ К ожидающим', 'transactions_pending')
        ]])
      }
    );
    
  } catch (error) {
    console.error('ADMIN: Ошибка одобрения вывода:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Отклонить вывод
 */
async function rejectWithdrawal(ctx, withdrawalId) {
  console.log('ADMIN: Отклонение вывода:', withdrawalId);
  
  ctx.session = ctx.session || {};
  ctx.session.rejectingWithdrawal = {
    withdrawalId: withdrawalId,
    step: 'reason'
  };
  
  const message = '❌ *Отклонение вывода*\n\nВведите причину отклонения:';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('🔙 Отмена', 'transactions_pending')
  ]]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Обработать отклонение вывода
 */
async function handleWithdrawalRejection(ctx) {
  if (!ctx.session || !ctx.session.rejectingWithdrawal) {
    return;
  }
  
  const session = ctx.session.rejectingWithdrawal;
  const reason = ctx.message.text.trim();
  
  if (reason.length < 5) {
    await ctx.reply('❌ Причина должна содержать минимум 5 символов:');
    return;
  }
  
  try {
    const response = await apiClient.post(`/admin/withdrawals/${session.withdrawalId}/reject`, {
      reason: reason
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка отклонения вывода');
    }
    
    const withdrawal = response.data.data;
    
    await ctx.reply(
      `❌ *Вывод отклонен*\n\n` +
      `💰 Сумма: ${withdrawal.amount.toFixed(2)} USDT\n` +
      `👤 Пользователь: ${withdrawal.user.firstName} ${withdrawal.user.lastName || ''}\n` +
      `📋 Причина: ${reason}\n` +
      `📅 Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
      `💰 Средства возвращены на баланс пользователя`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('⏳ К ожидающим', 'transactions_pending')
        ]])
      }
    );
    
    delete ctx.session.rejectingWithdrawal;
    
  } catch (error) {
    console.error('ADMIN: Ошибка отклонения вывода:', error);
    await ctx.reply(`❌ Ошибка отклонения вывода: ${error.message}`);
  }
}

/**
 * Показать историю транзакций
 */
async function showTransactionsHistory(ctx, page = 1) {
  console.log('ADMIN: Запрос истории транзакций, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/withdrawals', {
      params: { 
        limit: 10,
        skip: (page - 1) * 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения истории');
    }
    
    const data = response.data.data;
    const withdrawals = data.withdrawals;
    const total = data.total;
    const totalPages = data.totalPages;
    
    if (withdrawals.length === 0) {
      const message = '📋 *История транзакций*\n\nТранзакции не найдены.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('◀️ Назад', 'transactions_menu')
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
    
    let message = `📋 *История транзакций* (стр. ${page}/${totalPages})\n\n`;
    
    withdrawals.forEach((withdrawal, index) => {
      const user = withdrawal.user;
      const username = user?.username ? `@${user.username}` : 'Нет username';
      
      const statusEmojis = {
        'pending': '⏳',
        'approved': '✅',
        'processing': '🔄',
        'completed': '✅',
        'rejected': '❌',
        'failed': '💥'
      };
      
      const statusEmoji = statusEmojis[withdrawal.status] || '❓';
      
      message += `${(page - 1) * 10 + index + 1}. ${statusEmoji} *${withdrawal.amount.toFixed(2)} USDT*\n`;
      message += `   👤 ${user?.firstName || 'Неизвестно'} ${user?.lastName || ''}\n`;
      message += `   🏦 ${withdrawal.recipient}\n`;
      message += `   📊 Статус: ${withdrawal.status}\n`;
      message += `   📅 ${new Date(withdrawal.createdAt).toLocaleDateString('ru-RU')}\n`;
      
      if (withdrawal.rejectionReason) {
        message += `   ❌ Причина: ${withdrawal.rejectionReason}\n`;
      }
      
      message += '\n';
    });
    
    // Создаем клавиатуру с навигацией
    const buttons = [];
    
    // Кнопки навигации
    if (page > 1 || page < totalPages) {
      const navButtons = [];
      if (page > 1) {
        navButtons.push(Markup.button.callback('⬅️ Пред.', `transactions_history_${page - 1}`));
      }
      if (page < totalPages) {
        navButtons.push(Markup.button.callback('След. ➡️', `transactions_history_${page + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Фильтры
    buttons.push([
      Markup.button.callback('⏳ Ожидающие', 'filter_pending'),
      Markup.button.callback('✅ Завершенные', 'filter_completed'),
      Markup.button.callback('❌ Отклоненные', 'filter_rejected')
    ]);
    
    buttons.push([
      Markup.button.callback('🔄 Обновить', 'transactions_history'),
      Markup.button.callback('◀️ Назад', 'transactions_menu')
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
    console.error('ADMIN: Ошибка получения истории транзакций:', error);
    const errorMessage = `❌ Ошибка получения истории: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику транзакций
 */
async function showTransactionsStats(ctx) {
  console.log('ADMIN: Запрос статистики транзакций');
  
  try {
    const response = await apiClient.get('/admin/withdrawals/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = '📊 *Статистика транзакций*\n\n';
    
    message += `**Общая статистика:**\n`;
    message += `💰 Всего выводов: ${stats.totalWithdrawals || 0}\n`;
    message += `💵 Общая сумма: ${(stats.totalAmount || 0).toFixed(2)} USDT\n`;
    message += `📈 Средний вывод: ${(stats.averageAmount || 0).toFixed(2)} USDT\n\n`;
    
    message += `**По статусам:**\n`;
    message += `⏳ Ожидающие: ${stats.pending || 0} (${(stats.pendingAmount || 0).toFixed(2)} USDT)\n`;
    message += `✅ Завершенные: ${stats.completed || 0} (${(stats.completedAmount || 0).toFixed(2)} USDT)\n`;
    message += `❌ Отклоненные: ${stats.rejected || 0} (${(stats.rejectedAmount || 0).toFixed(2)} USDT)\n`;
    message += `💥 Неудачные: ${stats.failed || 0} (${(stats.failedAmount || 0).toFixed(2)} USDT)\n\n`;
    
    message += `**За сегодня:**\n`;
    message += `📊 Выводов: ${stats.todayWithdrawals || 0}\n`;
    message += `💰 Сумма: ${(stats.todayAmount || 0).toFixed(2)} USDT\n\n`;
    
    message += `**За неделю:**\n`;
    message += `📈 Выводов: ${stats.weekWithdrawals || 0}\n`;
    message += `💵 Сумма: ${(stats.weekAmount || 0).toFixed(2)} USDT\n\n`;
    
    message += `**Требующие одобрения:**\n`;
    message += `⚠️ В очереди: ${stats.requiresApproval || 0}\n`;
    message += `🚨 Подозрительных: ${stats.suspicious || 0}`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'transactions_stats')],
      [Markup.button.callback('◀️ Назад', 'transactions_menu')]
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
    console.error('ADMIN: Ошибка получения статистики транзакций:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать информацию о депозитах
 */
async function showDepositsInfo(ctx) {
  console.log('ADMIN: Запрос информации о депозитах');
  
  try {
    // Получаем статистику депозитов
    const response = await apiClient.get('/admin/finance/state');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения информации');
    }
    
    const stats = response.data.data;
    
    let message = '🏦 *Информация о депозитах*\n\n';
    
    message += `**Общая статистика:**\n`;
    message += `💰 Всего депозитов: ${stats.totalDeposits || 0}\n`;
    message += `💵 Общая сумма: ${(stats.totalDepositAmount || 0).toFixed(2)} USDT\n`;
    message += `📈 Средний депозит: ${(stats.averageDeposit || 0).toFixed(2)} USDT\n\n`;
    
    message += `**За сегодня:**\n`;
    message += `📊 Депозитов: ${stats.todayDeposits || 0}\n`;
    message += `💰 Сумма: ${(stats.todayDepositAmount || 0).toFixed(2)} USDT\n\n`;
    
    message += `**За неделю:**\n`;
    message += `📈 Депозитов: ${stats.weekDeposits || 0}\n`;
    message += `💵 Сумма: ${(stats.weekDepositAmount || 0).toFixed(2)} USDT\n\n`;
    
    message += `**Статистика пользователей:**\n`;
    message += `👥 Всего пользователей с депозитами: ${stats.usersWithDeposits || 0}\n`;
    message += `📊 Процент от общего числа: ${((stats.usersWithDeposits || 0) / (stats.totalUsers || 1) * 100).toFixed(1)}%\n`;
    message += `🔄 Активных депозиторов: ${stats.activeDepositors || 0}`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 История депозитов', 'deposits_history')],
      [Markup.button.callback('👥 Топ депозиторы', 'deposits_top')],
      [Markup.button.callback('🔄 Обновить', 'transactions_deposits')],
      [Markup.button.callback('◀️ Назад', 'transactions_menu')]
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
    console.error('ADMIN: Ошибка получения информации о депозитах:', error);
    const errorMessage = `❌ Ошибка получения информации: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

module.exports = {
  showPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  handleWithdrawalRejection,
  showTransactionsHistory,
  showTransactionsStats,
  showDepositsInfo
};