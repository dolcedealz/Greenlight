// admin/src/commands/coefficients.command.js
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
 * Показать глобальные коэффициенты
 */
async function showGlobalCoefficients(ctx) {
  console.log('ADMIN: Запрос глобальных коэффициентов');
  
  try {
    const response = await apiClient.get('/admin/game-settings');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения настроек');
    }
    
    const settings = response.data.data;
    const globalModifiers = settings.globalModifiers || {};
    
    let message = '🌍 *Глобальные коэффициенты*\n\n';
    
    message += `**Режим модификаторов:** ${settings.modifierMode === 'global' ? '🌍 Глобальный' : '👤 Индивидуальный'}\n\n`;
    
    // Coin Flip
    if (globalModifiers.coin) {
      const coin = globalModifiers.coin;
      message += `🪙 **Coin Flip:**\n`;
      message += `   📊 Модификатор шанса: ${coin.winChanceModifier || 0}%\n`;
      message += `   ⚙️ Статус: ${coin.enabled ? '✅ Включен' : '❌ Выключен'}\n\n`;
    }
    
    // Slots
    if (globalModifiers.slots) {
      const slots = globalModifiers.slots;
      message += `🎰 **Slots:**\n`;
      message += `   📊 Модификатор RTP: ${slots.rtpModifier || 0}%\n`;
      message += `   ⚙️ Статус: ${slots.enabled ? '✅ Включен' : '❌ Выключен'}\n\n`;
    }
    
    // Mines
    if (globalModifiers.mines) {
      const mines = globalModifiers.mines;
      message += `💣 **Mines:**\n`;
      message += `   📊 Модификатор мин: ${mines.mineChanceModifier || 0}%\n`;
      message += `   ⚙️ Статус: ${mines.enabled ? '✅ Включен' : '❌ Выключен'}\n\n`;
    }
    
    // Crash
    if (globalModifiers.crash) {
      const crash = globalModifiers.crash;
      message += `🚀 **Crash:**\n`;
      message += `   📊 Модификатор краша: ${crash.crashModifier || 0}%\n`;
      message += `   ⚙️ Статус: ${crash.enabled ? '✅ Включен' : '❌ Выключен'}\n\n`;
    }
    
    message += `📅 *Последнее обновление:* ${new Date(settings.updatedAt).toLocaleString('ru-RU')}`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🪙 Coin', 'coeff_global_coin'),
        Markup.button.callback('🎰 Slots', 'coeff_global_slots')
      ],
      [
        Markup.button.callback('💣 Mines', 'coeff_global_mines'),
        Markup.button.callback('🚀 Crash', 'coeff_global_crash')
      ],
      [
        Markup.button.callback('🔄 Переключить режим', 'coeff_toggle_mode'),
        Markup.button.callback('📊 Статистика', 'coefficients_stats')
      ],
      [
        Markup.button.callback('🔄 Обновить', 'coefficients_global'),
        Markup.button.callback('◀️ Назад', 'coefficients_menu')
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
    console.error('ADMIN: Ошибка получения глобальных коэффициентов:', error);
    const errorMessage = `❌ Ошибка получения настроек: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Настроить глобальный коэффициент для игры
 */
async function setupGlobalGameCoefficient(ctx, gameType) {
  console.log('ADMIN: Настройка глобального коэффициента для игры:', gameType);
  
  const gameNames = {
    'coin': 'Coin Flip',
    'slots': 'Slots',
    'mines': 'Mines',
    'crash': 'Crash'
  };
  
  const modifierNames = {
    'coin': 'шанса выигрыша',
    'slots': 'RTP',
    'mines': 'количества мин',
    'crash': 'раннего краша'
  };
  
  ctx.session = ctx.session || {};
  ctx.session.settingCoefficient = {
    gameType: gameType,
    step: 'modifier'
  };
  
  const message = `🎯 *Настройка ${gameNames[gameType]}*\n\n` +
    `Введите модификатор ${modifierNames[gameType]} в процентах:\n\n` +
    `• Положительное число - увеличивает сложность для игрока\n` +
    `• Отрицательное число - уменьшает сложность для игрока\n` +
    `• 0 - стандартные настройки\n\n` +
    `Пример: 5 (увеличить на 5%) или -10 (уменьшить на 10%)`;
  
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', 'coefficients_global')
  ]]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Обработать настройку коэффициента
 */
async function handleCoefficientSetting(ctx) {
  if (!ctx.session || !ctx.session.settingCoefficient) {
    return;
  }
  
  const session = ctx.session.settingCoefficient;
  const text = ctx.message.text.trim();
  
  if (session.step === 'modifier') {
    const modifier = parseFloat(text);
    
    if (isNaN(modifier)) {
      await ctx.reply('❌ Введите корректное число:');
      return;
    }
    
    // Проверяем допустимые диапазоны для каждой игры
    const limits = {
      'coin': { min: -47.5, max: 52.5 },
      'slots': { min: -30, max: 20 },
      'mines': { min: -20, max: 30 },
      'crash': { min: -20, max: 50 }
    };
    
    const limit = limits[session.gameType];
    if (modifier < limit.min || modifier > limit.max) {
      await ctx.reply(`❌ Значение должно быть от ${limit.min}% до ${limit.max}%:`);
      return;
    }
    
    session.modifier = modifier;
    session.step = 'enabled';
    
    await ctx.reply(
      `🎯 Модификатор: ${modifier}%\n\nВключить модификатор?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Включить', 'coeff_enable_true'),
          Markup.button.callback('❌ Выключить', 'coeff_enable_false')
        ],
        [Markup.button.callback('🔙 Отмена', 'coefficients_global')]
      ])
    );
  }
}

/**
 * Подтвердить настройку коэффициента
 */
async function confirmCoefficientSetting(ctx, enabled) {
  if (!ctx.session || !ctx.session.settingCoefficient) {
    await ctx.answerCbQuery('❌ Сессия истекла');
    return;
  }
  
  const session = ctx.session.settingCoefficient;
  
  try {
    const response = await apiClient.post(`/admin/game-settings/${session.gameType}/modifier`, {
      modifier: session.modifier,
      enabled: enabled
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка сохранения настроек');
    }
    
    const gameNames = {
      'coin': 'Coin Flip',
      'slots': 'Slots',
      'mines': 'Mines',
      'crash': 'Crash'
    };
    
    await ctx.answerCbQuery('✅ Настройки сохранены');
    
    await ctx.reply(
      `✅ *Настройки сохранены*\n\n` +
      `🎮 Игра: ${gameNames[session.gameType]}\n` +
      `📊 Модификатор: ${session.modifier}%\n` +
      `⚙️ Статус: ${enabled ? '✅ Включен' : '❌ Выключен'}\n` +
      `📅 Время: ${new Date().toLocaleString('ru-RU')}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('🌍 К настройкам', 'coefficients_global')
        ]])
      }
    );
    
    delete ctx.session.settingCoefficient;
    
  } catch (error) {
    console.error('ADMIN: Ошибка сохранения коэффициента:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Показать пользовательские коэффициенты
 */
async function showUserCoefficients(ctx) {
  console.log('ADMIN: Показ пользовательских коэффициентов');
  
  ctx.session = ctx.session || {};
  ctx.session.searchingUserCoeff = {
    step: 'userId'
  };
  
  const message = '👤 *Пользовательские коэффициенты*\n\nВведите Telegram ID пользователя для просмотра или изменения его модификаторов:';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('❌ Отмена', 'coefficients_menu')
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
 * Обработать поиск пользователя для коэффициентов
 */
async function handleUserCoefficientSearch(ctx) {
  if (!ctx.session || !ctx.session.searchingUserCoeff) {
    return;
  }
  
  const userId = ctx.message.text.trim();
  console.log('ADMIN: Поиск пользователя для коэффициентов:', userId);
  
  try {
    // Проверяем, является ли это числом (Telegram ID)
    if (!/^\d+$/.test(userId)) {
      await ctx.reply('❌ Введите корректный Telegram ID (только цифры):');
      return;
    }
    
    // Ищем пользователя по Telegram ID
    const response = await apiClient.get('/admin/users', {
      params: { search: userId, limit: 1 }
    });
    
    if (!response.data.success || response.data.data.users.length === 0) {
      await ctx.reply('❌ Пользователь не найден. Попробуйте другой ID:');
      return;
    }
    
    const user = response.data.data.users[0];
    
    // Получаем модификаторы пользователя
    const modifiersResponse = await apiClient.get(`/admin/users/${user._id}/modifiers`);
    
    if (!modifiersResponse.data.success) {
      throw new Error('Ошибка получения модификаторов');
    }
    
    const modifiers = modifiersResponse.data.data;
    await showUserModifiersDetails(ctx, modifiers);
    
    delete ctx.session.searchingUserCoeff;
    
  } catch (error) {
    console.error('ADMIN: Ошибка поиска пользователя для коэффициентов:', error);
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Показать детали модификаторов пользователя
 */
async function showUserModifiersDetails(ctx, data) {
  const user = data;
  const gameSettings = user.gameSettings || {};
  
  let message = `👤 *Модификаторы пользователя*\n\n`;
  message += `**Пользователь:** ${user.username ? `@${user.username}` : user.userId}\n`;
  message += `**ID:** \`${user.userId}\`\n\n`;
  
  // Coin Flip
  const coin = gameSettings.coin || {};
  message += `🪙 **Coin Flip:**\n`;
  message += `   📊 Модификатор шанса: ${coin.winChanceModifier || 0}%\n\n`;
  
  // Slots
  const slots = gameSettings.slots || {};
  message += `🎰 **Slots:**\n`;
  message += `   📊 Модификатор RTP: ${slots.rtpModifier || 0}%\n\n`;
  
  // Mines
  const mines = gameSettings.mines || {};
  message += `💣 **Mines:**\n`;
  message += `   📊 Модификатор мин: ${mines.mineChanceModifier || 0}%\n\n`;
  
  // Crash
  const crash = gameSettings.crash || {};
  message += `🚀 **Crash:**\n`;
  message += `   📊 Модификатор краша: ${crash.crashModifier || 0}%\n\n`;
  
  const hasAnyModifiers = Object.values(gameSettings).some(game => 
    Object.values(game || {}).some(value => value !== 0)
  );
  
  if (!hasAnyModifiers) {
    message += `ℹ️ *У пользователя нет активных модификаторов*`;
  }
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🪙 Изменить Coin', `user_coeff_coin_${user.userId}`),
      Markup.button.callback('🎰 Изменить Slots', `user_coeff_slots_${user.userId}`)
    ],
    [
      Markup.button.callback('💣 Изменить Mines', `user_coeff_mines_${user.userId}`),
      Markup.button.callback('🚀 Изменить Crash', `user_coeff_crash_${user.userId}`)
    ],
    [
      Markup.button.callback('🔄 Сбросить все', `user_coeff_reset_${user.userId}`),
      Markup.button.callback('🔍 Другой пользователь', 'coefficients_users')
    ],
    [Markup.button.callback('◀️ Назад', 'coefficients_menu')]
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

/**
 * Показать статистику модификаторов
 */
async function showCoefficientsStats(ctx) {
  console.log('ADMIN: Запрос статистики модификаторов');
  
  try {
    const response = await apiClient.get('/admin/odds/statistics');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка получения статистики');
    }
    
    const stats = response.data.data;
    
    let message = '📊 *Статистика модификаторов*\n\n';
    
    message += `**Общая информация:**\n`;
    message += `👥 Пользователей с модификаторами: ${stats.usersWithModifiers || 0}\n`;
    message += `🎮 Всего установленных модификаторов: ${stats.totalModifiers || 0}\n`;
    message += `📈 Среднее значение модификатора: ${(stats.averageModifier || 0).toFixed(2)}%\n\n`;
    
    if (stats.gameStats) {
      message += `**По играм:**\n`;
      
      Object.entries(stats.gameStats).forEach(([gameType, gameStat]) => {
        const gameEmoji = {
          'coin': '🪙',
          'slots': '🎰',
          'mines': '💣',
          'crash': '🚀'
        }[gameType] || '🎮';
        
        message += `${gameEmoji} **${gameType}:**\n`;
        message += `   👥 Пользователей: ${gameStat.usersCount}\n`;
        message += `   📊 Средний модификатор: ${gameStat.averageModifier.toFixed(2)}%\n`;
        message += `   📈 Макс. модификатор: ${gameStat.maxModifier}%\n`;
        message += `   📉 Мин. модификатор: ${gameStat.minModifier}%\n\n`;
      });
    }
    
    message += `**Глобальные настройки:**\n`;
    message += `🌍 Режим: ${stats.globalMode ? 'Глобальный' : 'Индивидуальный'}\n`;
    message += `⚙️ Активных глобальных модификаторов: ${stats.activeGlobalModifiers || 0}`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Обновить', 'coefficients_stats')],
      [Markup.button.callback('◀️ Назад', 'coefficients_menu')]
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
    console.error('ADMIN: Ошибка получения статистики модификаторов:', error);
    const errorMessage = `❌ Ошибка получения статистики: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Переключить режим модификаторов
 */
async function toggleModifierMode(ctx) {
  console.log('ADMIN: Переключение режима модификаторов');
  
  try {
    // Сначала получаем текущие настройки
    const currentResponse = await apiClient.get('/admin/game-settings');
    if (!currentResponse.data.success) {
      throw new Error('Ошибка получения текущих настроек');
    }
    
    const currentMode = currentResponse.data.data.modifierMode;
    const newMode = currentMode === 'global' ? 'individual' : 'global';
    
    const response = await apiClient.put('/admin/game-settings', {
      modifierMode: newMode
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Ошибка переключения режима');
    }
    
    await ctx.answerCbQuery(`✅ Режим переключен на ${newMode === 'global' ? 'глобальный' : 'индивидуальный'}`);
    
    // Показываем обновленные настройки
    await showGlobalCoefficients(ctx);
    
  } catch (error) {
    console.error('ADMIN: Ошибка переключения режима модификаторов:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

/**
 * Сбросить все модификаторы
 */
async function resetAllModifiers(ctx) {
  console.log('ADMIN: Сброс всех модификаторов');
  
  const message = '🔄 *Сброс всех модификаторов*\n\n⚠️ Это действие сбросит ВСЕ пользовательские модификаторы до стандартных значений.\n\nВы уверены?';
  
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да, сбросить', 'confirm_reset_all'),
      Markup.button.callback('❌ Отмена', 'coefficients_menu')
    ]
  ]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * Подтвердить сброс всех модификаторов
 */
async function confirmResetAllModifiers(ctx) {
  console.log('ADMIN: Подтверждение сброса всех модификаторов');
  
  try {
    // Здесь должен быть вызов API для сброса всех модификаторов
    // Пока что заглушка
    await ctx.answerCbQuery('🚧 Функция в разработке');
    
  } catch (error) {
    console.error('ADMIN: Ошибка сброса модификаторов:', error);
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

module.exports = {
  showGlobalCoefficients,
  setupGlobalGameCoefficient,
  handleCoefficientSetting,
  confirmCoefficientSetting,
  showUserCoefficients,
  handleUserCoefficientSearch,
  showUserModifiersDetails,
  showCoefficientsStats,
  toggleModifierMode,
  resetAllModifiers,
  confirmResetAllModifiers
};