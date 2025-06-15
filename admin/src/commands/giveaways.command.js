// admin/src/commands/giveaways.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// API настройки
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
 * Показать главное меню розыгрышей
 */
async function showGiveawaysMenu(ctx) {
  try {
    await ctx.reply(
      '🎁 *Управление розыгрышами*\n\n' +
      'Выберите действие:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎯 Управление розыгрышами', callback_data: 'giveaways_manage' },
              { text: '📊 Текущие розыгрыши', callback_data: 'giveaways_current' }
            ],
            [
              { text: '🎁 Управление призами', callback_data: 'giveaways_prizes' },
              { text: '➕ Создать розыгрыш', callback_data: 'giveaways_create' }
            ],
            [
              { text: '📈 Статистика', callback_data: 'giveaways_stats' },
              { text: '🏆 История', callback_data: 'giveaways_history' }
            ],
            [
              { text: '🏠 Главное меню', callback_data: 'main_menu' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка показа меню розыгрышей:', error);
    await ctx.reply('❌ Ошибка загрузки меню розыгрышей');
  }
}

/**
 * Показать текущие розыгрыши
 */
async function showCurrentGiveaways(ctx) {
  try {
    // Get all giveaways and filter for current ones (active + pending)
    const response = await apiClient.get('/admin/giveaways');
    
    if (response.data.success) {
      const allGiveaways = response.data.data.giveaways;
      const giveaways = allGiveaways.filter(g => g.status === 'active' || g.status === 'pending');
      
      if (giveaways.length === 0) {
        await ctx.reply(
          '📭 *Текущие розыгрыши*\n\n' +
          'Нет активных розыгрышей',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎯 Создать розыгрыш', callback_data: 'giveaways_create' }
                ],
                [
                  { text: '🔙 Назад', callback_data: 'giveaways_menu' }
                ]
              ]
            }
          }
        );
        return;
      }

      let message = '📊 *Текущие розыгрыши*\n\n';
      
      for (const giveaway of giveaways) {
        const statusEmoji = giveaway.status === 'active' ? '🟢' : giveaway.status === 'pending' ? '🟡' : '🔴';
        const typeText = giveaway.type === 'daily' ? 'Ежедневный' : 'Недельный';
        
        message += `${statusEmoji} *${giveaway.title}*\n`;
        message += `┣ 🎁 Приз: ${giveaway.prize?.name || 'Не указан'}\n`;
        message += `┣ 📅 Тип: ${typeText}\n`;
        message += `┣ 🏆 Победителей: ${giveaway.winnersCount}\n`;
        message += `┣ 👥 Участников: ${giveaway.participationCount}\n`;
        message += `┣ ⏰ Розыгрыш: ${new Date(giveaway.drawDate).toLocaleString('ru-RU')}\n`;
        message += `┗ 📊 Статус: ${giveaway.status === 'active' ? 'Активный' : giveaway.status === 'pending' ? 'Ожидает' : 'Завершен'}\n\n`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Обновить', callback_data: 'giveaways_current' },
              { text: '🎯 Создать новый', callback_data: 'giveaways_create' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'giveaways_menu' }
            ]
          ]
        }
      });

    } else {
      throw new Error(response.data.message || 'Ошибка API');
    }
  } catch (error) {
    console.error('ADMIN: Ошибка получения текущих розыгрышей:', error);
    await ctx.reply(
      '❌ Ошибка загрузки розыгрышей',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
          ]
        }
      }
    );
  }
}

/**
 * Показать статистику розыгрышей
 */
async function showGiveawaysStats(ctx) {
  try {
    const response = await apiClient.get('/admin/giveaways/stats');
    
    if (response.data.success) {
      const stats = response.data.data;
      
      let message = '📈 *Статистика розыгрышей*\n\n';
      
      message += `📊 *Общая статистика:*\n`;
      message += `┣ 🎁 Всего розыгрышей: ${stats.overview.totalGiveaways}\n`;
      message += `┣ 🟢 Активных: ${stats.overview.activeGiveaways}\n`;
      message += `┣ ✅ Завершенных: ${stats.overview.completedGiveaways}\n`;
      message += `┣ 👥 Всего участий: ${stats.overview.totalParticipations}\n`;
      message += `┗ 🏆 Призов: ${stats.overview.totalPrizes}\n\n`;
      
      if (stats.giveawaysByType && stats.giveawaysByType.length > 0) {
        message += `📅 *По типам:*\n`;
        for (const type of stats.giveawaysByType) {
          const typeName = type._id === 'daily' ? 'Ежедневные' : 'Недельные';
          message += `┣ ${typeName}: ${type.count}\n`;
        }
        message += '\n';
      }
      
      if (stats.recentWinners && stats.recentWinners.length > 0) {
        message += `🏆 *Последние победители:*\n`;
        for (const winner of stats.recentWinners.slice(0, 5)) {
          message += `┣ ${winner.user.firstName} - ${winner.giveaway.title}\n`;
        }
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Обновить', callback_data: 'giveaways_stats' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'giveaways_menu' }
            ]
          ]
        }
      });

    } else {
      throw new Error(response.data.message || 'Ошибка API');
    }
  } catch (error) {
    console.error('ADMIN: Ошибка получения статистики розыгрышей:', error);
    await ctx.reply(
      '❌ Ошибка загрузки статистики',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
          ]
        }
      }
    );
  }
}

/**
 * Показать управление призами
 */
async function showPrizesManagement(ctx) {
  try {
    const response = await apiClient.get('/admin/giveaways/prizes');
    
    if (response.data.success) {
      const prizes = response.data.data.prizes;
      
      let message = '🎁 *Управление призами*\n\n';
      
      if (prizes.length === 0) {
        message += 'Призы не найдены\n\n';
      } else {
        for (const prize of prizes) {
          const typeEmoji = prize.type === 'telegram_gift' ? '🎁' : prize.type === 'promo_code' ? '🎫' : '💰';
          message += `${typeEmoji} *${prize.name}*\n`;
          message += `┣ 💎 Стоимость: ${prize.value} USDT\n`;
          message += `┣ 📝 Описание: ${prize.description}\n`;
          message += `┗ 🔧 Тип: ${prize.type === 'telegram_gift' ? 'Telegram Gift' : prize.type === 'promo_code' ? 'Промокод' : 'Бонус'}\n\n`;
        }
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Добавить приз', callback_data: 'giveaways_add_prize' }
            ],
            [
              { text: '🔄 Обновить', callback_data: 'giveaways_prizes' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'giveaways_menu' }
            ]
          ]
        }
      });

    } else {
      throw new Error(response.data.message || 'Ошибка API');
    }
  } catch (error) {
    console.error('ADMIN: Ошибка получения призов:', error);
    await ctx.reply(
      '❌ Ошибка загрузки призов',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
          ]
        }
      }
    );
  }
}

/**
 * Выбор способа создания приза
 */
async function startPrizeCreation(ctx) {
  try {
    await ctx.reply(
      '🎁 *Создание нового приза*\n\n' +
      'Выберите способ создания:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔗 Из ссылки Telegram Gift', callback_data: 'create_prize_from_url' }],
            [{ text: '✏️ Создать вручную', callback_data: 'create_prize_manual' }],
            [{ text: '🔙 Назад', callback_data: 'giveaways_prizes' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка начала создания приза:', error);
    await ctx.reply('❌ Ошибка при создании приза');
  }
}

/**
 * Начать создание приза из URL
 */
async function startPrizeCreationFromUrl(ctx) {
  try {
    if (!ctx.session) ctx.session = {};
    ctx.session.creatingPrizeFromUrl = {
      step: 'url'
    };

    await ctx.reply(
      '🔗 *Создание приза из Telegram Gift*\n\n' +
      'Отправьте ссылку на подарок в формате:\n' +
      '`https://t.me/nft/ToyBear-37305`\n\n' +
      'Система автоматически извлечет название, описание и изображение.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка начала создания приза из URL:', error);
    await ctx.reply('❌ Ошибка при создании приза');
  }
}

/**
 * Начать создание приза вручную
 */
async function startPrizeCreationManual(ctx) {
  try {
    // Устанавливаем сессию создания приза
    if (!ctx.session) ctx.session = {};
    ctx.session.creatingPrize = {
      step: 'name'
    };

    await ctx.reply(
      '✏️ *Создание приза вручную*\n\n' +
      'Введите название приза:',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка начала создания приза:', error);
    await ctx.reply('❌ Ошибка при создании приза');
  }
}

/**
 * Обработать ввод данных для создания приза из URL
 */
async function handleGiftUrlInput(ctx) {
  const text = ctx.message.text.trim();
  const session = ctx.session.creatingPrizeFromUrl;
  
  try {
    if (session.step === 'url') {
      // Валидация URL
      if (!text.match(/^https:\/\/t\.me\/nft\/[\w-]+$/i)) {
        await ctx.reply(
          '❌ Некорректная ссылка!\n\n' +
          'Используйте формат: `https://t.me/nft/ToyBear-37305`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await ctx.reply('🔄 Парсим информацию о подарке...');

      // Парсим подарок
      const response = await apiClient.post('/admin/giveaways/gifts/parse', {
        giftUrl: text
      });

      if (response.data.success) {
        const preview = response.data.data.preview;
        
        // Сохраняем данные в сессии
        session.giftData = preview;
        session.step = 'preview';

        await showGiftPreview(ctx, preview);
      } else {
        throw new Error(response.data.message || 'Ошибка парсинга');
      }

    } else if (session.step === 'value') {
      // Обработка ввода ценности
      const value = parseFloat(text);
      
      if (isNaN(value) || value <= 0) {
        await ctx.reply('❌ Введите корректную ценность (число больше 0)');
        return;
      }
      
      session.value = value;
      
      // Создаем приз
      await createPrizeFromGift(ctx, session);
    }

  } catch (error) {
    console.error('ADMIN: Ошибка обработки ввода подарка:', error);
    await ctx.reply(
      `❌ Ошибка: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_add_prize' }]
          ]
        }
      }
    );
    delete ctx.session.creatingPrizeFromUrl;
  }
}

/**
 * Создать приз из данных подарка
 */
async function createPrizeFromGift(ctx, session) {
  try {
    await ctx.reply('🔄 Создаем приз...');

    const response = await apiClient.post('/admin/giveaways/gifts/create', {
      name: session.giftData.name,
      description: session.giftData.description,
      value: session.value,
      giftData: session.giftData
    });

    if (response.data.success) {
      const prize = response.data.data;
      
      await ctx.reply(
        `✅ *Приз успешно создан!*\n\n` +
        `🎁 Название: ${prize.name}\n` +
        `💰 Ценность: ${prize.value} USDT\n` +
        `🗂 Коллекция: ${prize.giftData?.collection || 'Не указана'}\n` +
        `💎 Редкость: ${prize.giftData?.rarity || 'Не указана'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 К призам', callback_data: 'giveaways_prizes' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    } else {
      throw new Error(response.data.message || 'Ошибка создания приза');
    }

    delete ctx.session.creatingPrizeFromUrl;
  } catch (error) {
    console.error('ADMIN: Ошибка создания приза:', error);
    await ctx.reply(
      `❌ Ошибка создания приза: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_prizes' }]
          ]
        }
      }
    );
    delete ctx.session.creatingPrizeFromUrl;
  }
}

/**
 * Показать предпросмотр подарка
 */
async function showGiftPreview(ctx, giftData) {
  try {
    let message = '🎁 *Предпросмотр подарка*\n\n';
    message += `📛 **Название:** ${giftData.name}\n`;
    
    if (giftData.description) {
      message += `📝 **Описание:** ${giftData.description}\n`;
    }
    
    if (giftData.collection) {
      message += `🗂 **Коллекция:** ${giftData.collection}\n`;
    }
    
    if (giftData.rarity) {
      message += `💎 **Редкость:** ${giftData.rarity}\n`;
    }
    
    if (giftData.totalSupply) {
      message += `🔢 **Всего выпущено:** ${giftData.totalSupply.toLocaleString()}\n`;
    }
    
    if (giftData.currentSupply) {
      message += `📊 **Текущее количество:** ${giftData.currentSupply.toLocaleString()}\n`;
    }
    
    if (giftData.attributes && giftData.attributes.length > 0) {
      message += `\n🎨 **Атрибуты:**\n`;
      giftData.attributes.forEach(attr => {
        message += `┣ ${attr.trait_type}: ${attr.value}\n`;
      });
    }
    
    message += `\n💰 **Ценность:** нужно указать вручную`;
    
    const keyboard = [
      [{ text: '✅ Использовать эти данные', callback_data: 'gift_preview_accept' }],
      [{ text: '✏️ Редактировать название', callback_data: 'gift_edit_name' }],
      [{ text: '📝 Редактировать описание', callback_data: 'gift_edit_description' }],
      [{ text: '❌ Отмена', callback_data: 'gift_preview_cancel' }]
    ];

    if (giftData.imageUrl && giftData.imageValid) {
      // Отправляем с изображением
      await ctx.replyWithPhoto(giftData.imageUrl, {
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      // Отправляем только текст
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

  } catch (error) {
    console.error('ADMIN: Ошибка показа предпросмотра:', error);
    await ctx.reply('❌ Ошибка отображения предпросмотра');
  }
}

/**
 * Обработать создание приза
 */
async function handlePrizeCreation(ctx) {
  const text = ctx.message.text.trim();
  const session = ctx.session.creatingPrize;

  try {
    if (session.step === 'name') {
      session.name = text;
      session.step = 'description';
      
      await ctx.reply(
        `🎁 *Создание приза: ${text}*\n\n` +
        'Введите описание приза:',
        { parse_mode: 'Markdown' }
      );
      
    } else if (session.step === 'description') {
      session.description = text;
      session.step = 'value';
      
      await ctx.reply(
        `🎁 *Создание приза: ${session.name}*\n\n` +
        'Введите стоимость приза в USDT:',
        { parse_mode: 'Markdown' }
      );
      
    } else if (session.step === 'value') {
      const value = parseFloat(text);
      
      if (isNaN(value) || value <= 0) {
        await ctx.reply('❌ Введите корректную стоимость (число больше 0)');
        return;
      }
      
      session.value = value;
      session.step = 'type';
      
      await ctx.reply(
        `🎁 *Создание приза: ${session.name}*\n\n` +
        'Выберите тип приза:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 Telegram Gift', callback_data: 'prize_type_telegram_gift' }],
              [{ text: '🎫 Промокод', callback_data: 'prize_type_promo_code' }],
              [{ text: '💰 Бонус', callback_data: 'prize_type_bonus' }],
              [{ text: '❌ Отмена', callback_data: 'giveaways_prizes' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('ADMIN: Ошибка обработки создания приза:', error);
    await ctx.reply('❌ Ошибка при создании приза');
    delete ctx.session.creatingPrize;
  }
}

/**
 * Завершить создание приза
 */
async function finalizePrizeCreation(ctx, type) {
  const session = ctx.session.creatingPrize;
  
  try {
    const prizeData = {
      name: session.name,
      description: session.description,
      value: session.value,
      type: type
    };

    const response = await apiClient.post('/admin/giveaways/prizes', prizeData);
    
    if (response.data.success) {
      await ctx.reply(
        `✅ *Приз успешно создан!*\n\n` +
        `🎁 Название: ${session.name}\n` +
        `📝 Описание: ${session.description}\n` +
        `💎 Стоимость: ${session.value} USDT\n` +
        `🔧 Тип: ${type === 'telegram_gift' ? 'Telegram Gift' : type === 'promo_code' ? 'Промокод' : 'Бонус'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 К призам', callback_data: 'giveaways_prizes' }],
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    } else {
      throw new Error(response.data.message || 'Ошибка создания приза');
    }

    delete ctx.session.creatingPrize;
  } catch (error) {
    console.error('ADMIN: Ошибка завершения создания приза:', error);
    await ctx.reply(
      `❌ Ошибка создания приза: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_prizes' }]
          ]
        }
      }
    );
    delete ctx.session.creatingPrize;
  }
}

/**
 * Показать управление розыгрышами
 */
async function showGiveawayManagement(ctx) {
  try {
    const response = await apiClient.get('/admin/giveaways');
    
    if (response.data.success) {
      const giveaways = response.data.data.giveaways;
      
      if (giveaways.length === 0) {
        await ctx.reply(
          '📭 *Управление розыгрышами*\n\n' +
          'Розыгрыши не найдены',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Создать розыгрыш', callback_data: 'giveaways_create' }],
                [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
              ]
            }
          }
        );
        return;
      }

      let message = '🎯 *Управление розыгрышами*\n\n';
      const keyboard = [];
      
      for (const giveaway of giveaways.slice(0, 8)) { // Показываем до 8 розыгрышей
        const statusEmoji = giveaway.status === 'active' ? '🟢' : 
                           giveaway.status === 'pending' ? '🟡' : 
                           giveaway.status === 'completed' ? '✅' : '❌';
        const typeText = giveaway.type === 'daily' ? 'Ежедневный' : 'Недельный';
        
        message += `${statusEmoji} *${giveaway.title}*\n`;
        message += `┣ 📅 ${typeText}\n`;
        message += `┣ 🎁 ${giveaway.prize?.name || 'Приз не указан'}\n`;
        message += `┣ 👥 Участников: ${giveaway.participationCount}\n`;
        message += `┗ 📊 ${giveaway.status === 'active' ? 'Активный' : 
                                giveaway.status === 'pending' ? 'Ожидает' : 
                                giveaway.status === 'completed' ? 'Завершен' : 'Отменен'}\n\n`;
        
        keyboard.push([{ 
          text: `${statusEmoji} ${giveaway.title.slice(0, 25)}`, 
          callback_data: `manage_giveaway_${giveaway._id}` 
        }]);
      }
      
      keyboard.push([{ text: '🎯 Создать новый', callback_data: 'giveaways_create' }]);
      keyboard.push([{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } else {
      throw new Error(response.data.message || 'Ошибка API');
    }
  } catch (error) {
    console.error('ADMIN: Ошибка управления розыгрышами:', error);
    await ctx.reply(
      '❌ Ошибка загрузки розыгрышей',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
          ]
        }
      }
    );
  }
}

/**
 * Показать детали конкретного розыгрыша
 */
async function showGiveawayDetails(ctx, giveawayId) {
  try {
    const response = await apiClient.get(`/admin/giveaways`);
    
    if (response.data.success) {
      const giveaway = response.data.data.giveaways.find(g => g._id === giveawayId);
      
      if (!giveaway) {
        await ctx.reply('❌ Розыгрыш не найден');
        return;
      }

      const statusEmoji = giveaway.status === 'active' ? '🟢' : 
                         giveaway.status === 'pending' ? '🟡' : 
                         giveaway.status === 'completed' ? '✅' : '❌';
      
      const typeText = giveaway.type === 'daily' ? 'Ежедневный' : 'Недельный';
      
      let message = `${statusEmoji} *${giveaway.title}*\n\n`;
      message += `📅 *Тип:* ${typeText}\n`;
      message += `🎁 *Приз:* ${giveaway.prize?.name || 'Не указан'}\n`;
      message += `💰 *Стоимость:* ${giveaway.prize?.value || 0} USDT\n`;
      message += `🏆 *Победителей:* ${giveaway.winnersCount}\n`;
      message += `👥 *Участников:* ${giveaway.participationCount}\n\n`;
      
      message += `📊 *Статус:* ${giveaway.status === 'active' ? 'Активный' : 
                                   giveaway.status === 'pending' ? 'Ожидает' : 
                                   giveaway.status === 'completed' ? 'Завершен' : 'Отменен'}\n\n`;
      
      message += `⏰ *Расписание:*\n`;
      message += `┣ 🚀 Начало: ${new Date(giveaway.startDate).toLocaleString('ru-RU')}\n`;
      message += `┣ ⏳ Конец: ${new Date(giveaway.endDate).toLocaleString('ru-RU')}\n`;
      message += `┗ 🎯 Розыгрыш: ${new Date(giveaway.drawDate).toLocaleString('ru-RU')}\n\n`;
      
      if (giveaway.winners && giveaway.winners.length > 0) {
        message += `🏆 *Победители:*\n`;
        giveaway.winners.forEach((winner, index) => {
          message += `${index + 1}. ${winner.user?.firstName || 'Пользователь'}\n`;
        });
      }

      const keyboard = [];
      
      // Кнопки управления в зависимости от статуса
      if (giveaway.status === 'pending') {
        keyboard.push([
          { text: '✅ Активировать', callback_data: `activate_giveaway_${giveawayId}` },
          { text: '❌ Отменить', callback_data: `cancel_giveaway_${giveawayId}` }
        ]);
      } else if (giveaway.status === 'active') {
        keyboard.push([
          { text: '🎯 Провести розыгрыш', callback_data: `conduct_giveaway_${giveawayId}` },
          { text: '❌ Отменить', callback_data: `cancel_giveaway_${giveawayId}` }
        ]);
      }
      
      keyboard.push([
        { text: '⏰ Изменить время', callback_data: `edit_time_${giveawayId}` },
        { text: '📝 Редактировать', callback_data: `edit_giveaway_${giveawayId}` }
      ]);
      
      keyboard.push([
        { text: '👥 Участники', callback_data: `view_participants_${giveawayId}` }
      ]);
      
      keyboard.push([{ text: '🔙 К розыгрышам', callback_data: 'giveaways_manage' }]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } else {
      throw new Error(response.data.message || 'Ошибка API');
    }
  } catch (error) {
    console.error('ADMIN: Ошибка получения деталей розыгрыша:', error);
    await ctx.reply('❌ Ошибка загрузки розыгрыша');
  }
}

/**
 * Активировать розыгрыш
 */
async function activateGiveaway(ctx, giveawayId) {
  try {
    const response = await apiClient.post(`/admin/giveaways/${giveawayId}/activate`);
    
    if (response.data.success) {
      await ctx.answerCbQuery('✅ Розыгрыш активирован!');
      await showGiveawayDetails(ctx, giveawayId);
    } else {
      await ctx.answerCbQuery('❌ Ошибка активации');
      await ctx.reply(`❌ Ошибка: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка активации розыгрыша:', error);
    await ctx.answerCbQuery('❌ Ошибка активации');
    await ctx.reply('❌ Ошибка активации розыгрыша');
  }
}

/**
 * Отменить розыгрыш
 */
async function cancelGiveaway(ctx, giveawayId) {
  try {
    const response = await apiClient.post(`/admin/giveaways/${giveawayId}/cancel`);
    
    if (response.data.success) {
      await ctx.answerCbQuery('❌ Розыгрыш отменен');
      await showGiveawayDetails(ctx, giveawayId);
    } else {
      await ctx.answerCbQuery('❌ Ошибка отмены');
      await ctx.reply(`❌ Ошибка: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка отмены розыгрыша:', error);
    await ctx.answerCbQuery('❌ Ошибка отмены');
    await ctx.reply('❌ Ошибка отмены розыгрыша');
  }
}

/**
 * Провести розыгрыш
 */
async function conductGiveaway(ctx, giveawayId) {
  try {
    await ctx.answerCbQuery('🎯 Проводим розыгрыш...');
    
    const response = await apiClient.post(`/admin/giveaways/${giveawayId}/conduct`);
    
    if (response.data.success) {
      const winners = response.data.data.winners || [];
      let message = '🎉 *Розыгрыш проведен!*\n\n';
      
      if (winners.length > 0) {
        message += '🏆 *Победители:*\n';
        winners.forEach((winner, index) => {
          message += `${index + 1}. ${winner.user?.firstName || 'Пользователь'}\n`;
        });
      } else {
        message += '😞 Участников не было';
      }
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
      await showGiveawayDetails(ctx, giveawayId);
    } else {
      await ctx.reply(`❌ Ошибка: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка проведения розыгрыша:', error);
    await ctx.reply('❌ Ошибка проведения розыгрыша');
  }
}

/**
 * Начать создание розыгрыша
 */
async function startGiveawayCreation(ctx) {
  try {
    // Получаем доступные призы
    const response = await apiClient.get('/admin/giveaways/prizes');
    
    if (!response.data.success || response.data.data.prizes.length === 0) {
      await ctx.reply(
        '❌ *Невозможно создать розыгрыш*\n\n' +
        'Сначала создайте хотя бы один приз',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎁 Создать приз', callback_data: 'giveaways_add_prize' }],
              [{ text: '🔙 Назад', callback_data: 'giveaways_menu' }]
            ]
          }
        }
      );
      return;
    }

    // Устанавливаем сессию создания розыгрыша
    if (!ctx.session) ctx.session = {};
    ctx.session.creatingGiveaway = {
      step: 'title',
      availablePrizes: response.data.data.prizes
    };

    await ctx.reply(
      '🎯 *Создание нового розыгрыша*\n\n' +
      'Введите название розыгрыша:',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка начала создания розыгрыша:', error);
    await ctx.reply('❌ Ошибка при создании розыгрыша');
  }
}

/**
 * Обработать создание розыгрыша
 */
async function handleGiveawayCreation(ctx) {
  const text = ctx.message.text.trim();
  const session = ctx.session.creatingGiveaway;

  try {
    if (session.step === 'title') {
      session.title = text;
      session.step = 'type';
      
      await ctx.reply(
        `🎯 *Создание розыгрыша: ${text}*\n\n` +
        'Выберите тип розыгрыша:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Ежедневный', callback_data: 'giveaway_type_daily' }],
              [{ text: '📆 Недельный', callback_data: 'giveaway_type_weekly' }],
              [{ text: '❌ Отмена', callback_data: 'giveaways_menu' }]
            ]
          }
        }
      );
      
    } else if (session.step === 'winnersCount') {
      const winnersCount = parseInt(text);
      
      if (isNaN(winnersCount) || winnersCount <= 0 || winnersCount > 10) {
        await ctx.reply('❌ Введите корректное количество победителей (от 1 до 10)');
        return;
      }
      
      session.winnersCount = winnersCount;
      
      // Показываем доступные призы для выбора
      let message = `🎯 *Создание розыгрыша: ${session.title}*\n\n` +
                   'Выберите приз для розыгрыша:\n\n';
      
      const keyboard = [];
      for (let i = 0; i < session.availablePrizes.length; i++) {
        const prize = session.availablePrizes[i];
        message += `${i + 1}. ${prize.name} (${prize.value} USDT)\n`;
        keyboard.push([{ 
          text: `${i + 1}. ${prize.name}`, 
          callback_data: `select_prize_${prize._id}` 
        }]);
      }
      
      keyboard.push([{ text: '❌ Отмена', callback_data: 'giveaways_menu' }]);
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (error) {
    console.error('ADMIN: Ошибка обработки создания розыгрыша:', error);
    await ctx.reply('❌ Ошибка при создании розыгрыша');
    delete ctx.session.creatingGiveaway;
  }
}

module.exports = {
  showGiveawaysMenu,
  showCurrentGiveaways,
  showGiveawaysStats,
  showPrizesManagement,
  showGiveawayManagement,
  showGiveawayDetails,
  activateGiveaway,
  cancelGiveaway,
  conductGiveaway,
  startPrizeCreation,
  startPrizeCreationFromUrl,
  startPrizeCreationManual,
  handleGiftUrlInput,
  showGiftPreview,
  createPrizeFromGift,
  handlePrizeCreation,
  finalizePrizeCreation,
  startGiveawayCreation,
  handleGiveawayCreation
};