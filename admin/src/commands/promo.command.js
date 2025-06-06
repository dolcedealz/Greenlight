// admin/src/commands/promo.command.js
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
 * Показать главное меню промокодов
 */
async function showPromoMenu(ctx) {
  console.log('ADMIN: Показ меню промокодов');
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Создать промокод', 'promo_create')],
    [Markup.button.callback('📋 Список промокодов', 'promo_list')],
    [Markup.button.callback('📊 Статистика промокодов', 'promo_stats')],
    [Markup.button.callback('🎁 Бонусная система', 'bonus_system')],
    [Markup.button.callback('🏆 VIP программа', 'vip_program')],
    [Markup.button.callback('◀️ Главное меню', 'main_menu')]
  ]);

  const message = '🎁 *Система промокодов и бонусов*\n\nВыберите действие:';
  
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
    console.error('ADMIN: Ошибка показа меню промокодов:', error);
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * Начать создание промокода
 */
async function startPromoCreation(ctx) {
  console.log('ADMIN: Начало создания промокода');
  
  ctx.session = ctx.session || {};
  ctx.session.creatingPromo = {
    step: 'code'
  };
  
  const message = '➕ *Создание промокода*\n\n' +
    'Шаг 1/6: Введите код промокода:\n\n' +
    '• Только латинские буквы и цифры\n' +
    '• От 3 до 20 символов\n' +
    '• Без пробелов\n\n' +
    'Пример: WELCOME2024, BONUS100, NEWUSER';
  
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', 'promo_cancel')
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
 * Обработать создание промокода
 */
async function handlePromoCreation(ctx) {
  if (!ctx.session || !ctx.session.creatingPromo) {
    return;
  }
  
  const promoData = ctx.session.creatingPromo;
  const text = ctx.message.text.trim();
  
  console.log(`ADMIN: Шаг создания промокода: ${promoData.step}, текст: ${text}`);
  
  switch (promoData.step) {
    case 'code':
      // Валидация кода
      if (!/^[A-Z0-9]{3,20}$/i.test(text)) {
        await ctx.reply('❌ Код должен содержать только латинские буквы и цифры (3-20 символов):');
        return;
      }
      
      promoData.code = text.toUpperCase();
      promoData.step = 'type';
      
      await ctx.reply(
        '🎁 Шаг 2/6: Выберите тип промокода:',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('💰 Бонус на баланс', 'promo_type_balance'),
            Markup.button.callback('🎮 Бесплатные игры', 'promo_type_freespins')
          ],
          [
            Markup.button.callback('📈 Процент от депозита', 'promo_type_deposit'),
            Markup.button.callback('🏆 VIP статус', 'promo_type_vip')
          ],
          [Markup.button.callback('❌ Отмена', 'promo_cancel')]
        ])
      );
      break;
      
    case 'value':
      const value = parseFloat(text);
      
      if (isNaN(value) || value <= 0) {
        await ctx.reply('❌ Введите корректное положительное число:');
        return;
      }
      
      // Проверяем лимиты для разных типов
      const maxValues = {
        'balance': 10000,
        'freespins': 1000,
        'deposit': 500,
        'vip': 365
      };
      
      if (value > maxValues[promoData.type]) {
        await ctx.reply(`❌ Максимальное значение для данного типа: ${maxValues[promoData.type]}`);
        return;
      }
      
      promoData.value = value;
      promoData.step = 'usageLimit';
      
      await ctx.reply(
        `💎 Значение: ${value} ${getValueUnit(promoData.type)}\n\n` +
        'Шаг 4/6: Введите лимит использования:\n\n' +
        '• 0 - без лимита\n' +
        '• Число - максимальное количество активаций\n\n' +
        'Пример: 100 (для 100 использований)',
        Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'promo_cancel')
        ]])
      );
      break;
      
    case 'usageLimit':
      const limit = parseInt(text);
      
      if (isNaN(limit) || limit < 0) {
        await ctx.reply('❌ Введите корректное число (0 или больше):');
        return;
      }
      
      promoData.usageLimit = limit;
      promoData.step = 'duration';
      
      await ctx.reply(
        `📊 Лимит использования: ${limit === 0 ? 'Без лимита' : limit}\n\n` +
        'Шаг 5/6: Введите срок действия в днях:\n\n' +
        '• 0 - бессрочный\n' +
        '• Число - количество дней с момента создания\n\n' +
        'Пример: 30 (действует 30 дней)',
        Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'promo_cancel')
        ]])
      );
      break;
      
    case 'duration':
      const duration = parseInt(text);
      
      if (isNaN(duration) || duration < 0) {
        await ctx.reply('❌ Введите корректное число (0 или больше):');
        return;
      }
      
      promoData.duration = duration;
      promoData.step = 'description';
      
      await ctx.reply(
        `⏰ Срок действия: ${duration === 0 ? 'Бессрочный' : duration + ' дней'}\n\n` +
        'Шаг 6/6: Введите описание промокода:\n\n' +
        'Краткое описание для пользователей (до 200 символов)',
        Markup.inlineKeyboard([[
          Markup.button.callback('❌ Отмена', 'promo_cancel')
        ]])
      );
      break;
      
    case 'description':
      if (text.length > 200) {
        await ctx.reply('❌ Описание должно быть не длиннее 200 символов:');
        return;
      }
      
      promoData.description = text;
      
      // Создаем промокод
      await createPromoCode(ctx, promoData);
      break;
  }
}

/**
 * Обработать выбор типа промокода
 */
async function handlePromoTypeSelection(ctx, type) {
  console.log(`ADMIN: Выбор типа промокода: ${type}`);
  
  if (!ctx.session || !ctx.session.creatingPromo) {
    return ctx.answerCbQuery('❌ Сессия создания промокода истекла');
  }
  
  ctx.session.creatingPromo.type = type;
  ctx.session.creatingPromo.step = 'value';
  
  const typeNames = {
    'balance': 'Бонус на баланс',
    'freespins': 'Бесплатные игры',
    'deposit': 'Процент от депозита',
    'vip': 'VIP статус'
  };
  
  const valuePrompts = {
    'balance': 'Введите сумму бонуса в USDT (до 10000):',
    'freespins': 'Введите количество бесплатных игр (до 1000):',
    'deposit': 'Введите процент от депозита (до 500%):',
    'vip': 'Введите количество дней VIP статуса (до 365):'
  };
  
  await ctx.editMessageText(
    `🎁 Тип: ${typeNames[type]}\n\n` +
    `Шаг 3/6: ${valuePrompts[type]}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[
        Markup.button.callback('❌ Отмена', 'promo_cancel')
      ]])
    }
  );
  
  await ctx.answerCbQuery();
}

/**
 * Создать промокод
 */
async function createPromoCode(ctx, promoData) {
  console.log('ADMIN: Создание промокода с данными:', promoData);
  
  try {
    const createData = {
      code: promoData.code,
      type: promoData.type,
      value: promoData.value,
      usageLimit: promoData.usageLimit,
      duration: promoData.duration,
      description: promoData.description,
      isActive: true,
      createdBy: ctx.from.id
    };
    
    console.log('ADMIN: Отправляем данные для создания промокода:', JSON.stringify(createData, null, 2));
    
    const response = await apiClient.post('/admin/promo/create', createData);
    
    if (response.data.success) {
      const promo = response.data.data.promo;
      
      await ctx.reply(
        '✅ *Промокод создан успешно!*\n\n' +
        `🎫 Код: \`${promo.code}\`\n` +
        `🎁 Тип: ${getTypeDisplayName(promo.type)}\n` +
        `💎 Значение: ${promo.value} ${getValueUnit(promo.type)}\n` +
        `📊 Лимит: ${promo.usageLimit === 0 ? 'Без лимита' : promo.usageLimit}\n` +
        `⏰ Срок: ${promo.duration === 0 ? 'Бессрочный' : promo.duration + ' дней'}\n` +
        `📝 Описание: ${promo.description}\n` +
        `📅 Создан: ${new Date(promo.createdAt).toLocaleString('ru-RU')}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('📋 К списку промокодов', 'promo_list')
          ]])
        }
      );
    } else {
      throw new Error(response.data.message);
    }
    
    // Очищаем сессию
    delete ctx.session.creatingPromo;
    
  } catch (error) {
    console.error('ADMIN: Ошибка создания промокода:', error);
    await ctx.reply(
      `❌ Ошибка создания промокода: ${error.response?.data?.message || error.message}`,
      Markup.inlineKeyboard([[
        Markup.button.callback('🔄 Попробовать снова', 'promo_create')
      ]])
    );
    delete ctx.session.creatingPromo;
  }
}

/**
 * Показать список промокодов
 */
async function showPromoList(ctx, page = 1) {
  console.log('ADMIN: Запрос списка промокодов, страница:', page);
  
  try {
    const response = await apiClient.get('/admin/promo/list', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения промокодов');
    }
    
    const data = response.data.data;
    const promos = data.promos;
    const pagination = data.pagination;
    
    if (promos.length === 0) {
      const message = '📋 *Список промокодов*\n\nПромокоды не найдены.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать промокод', 'promo_create')],
        [Markup.button.callback('◀️ Назад', 'promo_menu')]
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
    
    let message = `📋 *Список промокодов* (стр. ${pagination.current}/${pagination.pages})\n\n`;
    
    promos.forEach((promo, index) => {
      const statusEmoji = promo.isActive ? '✅' : '❌';
      const typeEmoji = {
        'balance': '💰',
        'freespins': '🎮',
        'deposit': '📈',
        'vip': '🏆'
      }[promo.type] || '🎁';
      
      message += `${index + 1}. ${statusEmoji} ${typeEmoji} \`${promo.code}\`\n`;
      message += `   💎 ${promo.value} ${getValueUnit(promo.type)}\n`;
      message += `   📊 Использований: ${promo.usedCount}/${promo.usageLimit === 0 ? '∞' : promo.usageLimit}\n`;
      message += `   📅 ${new Date(promo.createdAt).toLocaleDateString('ru-RU')}\n\n`;
    });
    
    // Создаем клавиатуру с кнопками навигации и действиями
    const buttons = [];
    
    // Кнопки навигации
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback('⬅️ Пред.', `promo_list_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('След. ➡️', `promo_list_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // Основные действия
    buttons.push([
      Markup.button.callback('➕ Создать', 'promo_create'),
      Markup.button.callback('📊 Статистика', 'promo_stats')
    ]);
    
    buttons.push([Markup.button.callback('🔄 Обновить', 'promo_list')]);
    buttons.push([Markup.button.callback('◀️ Назад', 'promo_menu')]);
    
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
    console.error('ADMIN: Ошибка получения списка промокодов:', error);
    const errorMessage = `❌ Ошибка получения промокодов: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Показать статистику промокодов
 */
async function showPromoStats(ctx) {
  console.log('ADMIN: Запрос статистики промокодов');
  
  try {
    const response = await apiClient.get('/admin/promo/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = '📊 *Статистика промокодов*\n\n';
    
    message += `**Общая информация:**\n`;
    message += `🎫 Всего промокодов: ${stats.totalPromos || 0}\n`;
    message += `✅ Активных: ${stats.activePromos || 0}\n`;
    message += `❌ Неактивных: ${stats.inactivePromos || 0}\n`;
    message += `🔢 Всего активаций: ${stats.totalActivations || 0}\n\n`;
    
    message += `**По типам:**\n`;
    if (stats.byType) {
      Object.entries(stats.byType).forEach(([type, count]) => {
        const typeEmoji = {
          'balance': '💰',
          'freespins': '🎮',
          'deposit': '📈',
          'vip': '🏆'
        }[type] || '🎁';
        
        message += `${typeEmoji} ${getTypeDisplayName(type)}: ${count}\n`;
      });
    }
    message += '\n';
    
    message += `**За сегодня:**\n`;
    message += `🆕 Созданных: ${stats.todayCreated || 0}\n`;
    message += `🎯 Активаций: ${stats.todayActivations || 0}\n\n`;
    
    message += `**Топ промокоды:**\n`;
    if (stats.topPromos && stats.topPromos.length > 0) {
      stats.topPromos.slice(0, 5).forEach((promo, index) => {
        message += `${index + 1}. \`${promo.code}\` - ${promo.usedCount} активаций\n`;
      });
    } else {
      message += `Нет данных\n`;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'promo_stats')],
      [Markup.button.callback('◀️ Назад', 'promo_menu')]
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
    console.error('ADMIN: Ошибка получения статистики промокодов:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

// Вспомогательные функции
function getTypeDisplayName(type) {
  const names = {
    'balance': 'Бонус на баланс',
    'freespins': 'Бесплатные игры',
    'deposit': 'Процент от депозита',
    'vip': 'VIP статус'
  };
  return names[type] || type;
}

function getValueUnit(type) {
  const units = {
    'balance': 'USDT',
    'freespins': 'игр',
    'deposit': '%',
    'vip': 'дней'
  };
  return units[type] || '';
}

module.exports = {
  showPromoMenu,
  startPromoCreation,
  handlePromoCreation,
  handlePromoTypeSelection,
  showPromoList,
  showPromoStats
};