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
              { text: '📢 Напоминания', callback_data: 'giveaways_reminders' }
            ],
            [
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
        
        message += `${statusEmoji} *${escapeMarkdown(giveaway.title)}*\n`;
        message += `┣ 🎁 Приз: ${escapeMarkdown(giveaway.prize?.name || 'Не указан')}\n`;
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
          message += `┣ ${escapeMarkdown(winner.user.firstName)} - ${escapeMarkdown(winner.giveaway.title)}\n`;
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
          message += `${typeEmoji} *${escapeMarkdown(prize.name)}*\n`;
          message += `┣ 💎 Стоимость: ${prize.value} USDT\n`;
          message += `┣ 📝 Описание: ${escapeMarkdown(prize.description)}\n`;
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
        console.log('ADMIN: Получены данные предпросмотра:', JSON.stringify(preview, null, 2));
        
        // Сохраняем данные в сессии
        session.giftData = preview;
        session.step = 'preview';

        await showGiftPreview(ctx, preview);
      } else {
        console.error('ADMIN: API вернул ошибку:', response.data);
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
        `🎁 Название: ${escapeMarkdown(prize.name)}\n` +
        `💰 Ценность: ${prize.value} USDT\n` +
        `🗂 Коллекция: ${escapeMarkdown(prize.giftData?.collection || 'Не указана')}\n` +
        `💎 Редкость: ${escapeMarkdown(prize.giftData?.rarity || 'Не указана')}`,
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
 * Экранирует специальные символы для Telegram Markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  // Преобразуем в строку
  let result = text.toString();
  
  // Экранируем специальные символы Markdown
  return result
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Показать предпросмотр подарка
 */
async function showGiftPreview(ctx, giftData) {
  try {
    console.log('ADMIN: Показываем предпросмотр подарка:', JSON.stringify(giftData, null, 2));
    
    let message = '🎁 *Предпросмотр подарка*\n\n';
    message += `📛 *Название:* ${escapeMarkdown(giftData.name || 'Не указано')}\n`;
    
    if (giftData.description) {
      // Ограничиваем длину описания для Telegram
      const desc = giftData.description.length > 200 ? 
                   giftData.description.substring(0, 200) + '...' : 
                   giftData.description;
      message += `📝 *Описание:* ${escapeMarkdown(desc)}\n`;
    }
    
    if (giftData.collection) {
      message += `🗂 *Коллекция:* ${escapeMarkdown(giftData.collection)}\n`;
    }
    
    if (giftData.rarity) {
      message += `💎 *Редкость:* ${escapeMarkdown(giftData.rarity)}\n`;
    }
    
    if (giftData.totalSupply) {
      message += `🔢 *Всего выпущено:* ${giftData.totalSupply.toLocaleString()}\n`;
    }
    
    if (giftData.currentSupply) {
      message += `📊 *Текущее количество:* ${giftData.currentSupply.toLocaleString()}\n`;
    }
    
    if (giftData.attributes && giftData.attributes.length > 0) {
      message += `\n🎨 *Атрибуты:*\n`;
      // Ограничиваем количество атрибутов
      const limitedAttrs = giftData.attributes.slice(0, 5);
      limitedAttrs.forEach(attr => {
        if (attr.trait_type && attr.value) {
          message += `• ${escapeMarkdown(attr.trait_type)}: ${escapeMarkdown(attr.value)}\n`;
        }
      });
      if (giftData.attributes.length > 5) {
        message += `• И еще ${giftData.attributes.length - 5} атрибутов...\n`;
      }
    }
    
    message += `\n💰 *Ценность:* нужно указать вручную`;
    
    const keyboard = [
      [{ text: '✅ Использовать эти данные', callback_data: 'gift_preview_accept' }],
      [{ text: '❌ Отмена', callback_data: 'gift_preview_cancel' }]
    ];

    // Проверяем изображение
    console.log('ADMIN: URL изображения:', giftData.imageUrl);
    console.log('ADMIN: Изображение валидно:', giftData.imageValid);

    if (giftData.imageUrl && giftData.imageValid) {
      try {
        // Отправляем с изображением
        console.log('ADMIN: Отправляем с изображением');
        await ctx.replyWithPhoto(giftData.imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (photoError) {
        console.error('ADMIN: Ошибка отправки фото, отправляем текст:', photoError);
        // Если ошибка с фото, отправляем текст
        await ctx.reply(message + '\n\n⚠️ Изображение недоступно', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    } else {
      // Отправляем только текст
      console.log('ADMIN: Отправляем только текст');
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

  } catch (error) {
    console.error('ADMIN: Ошибка показа предпросмотра:', error);
    await ctx.reply(
      '❌ Ошибка отображения предпросмотра\n\n' +
      `Детали: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад', callback_data: 'giveaways_add_prize' }]
          ]
        }
      }
    );
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
        `🎁 *Создание приза: ${escapeMarkdown(text)}*\n\n` +
        'Введите описание приза:',
        { parse_mode: 'Markdown' }
      );
      
    } else if (session.step === 'description') {
      session.description = text;
      session.step = 'value';
      
      await ctx.reply(
        `🎁 *Создание приза: ${escapeMarkdown(session.name)}*\n\n` +
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
        `🎁 *Создание приза: ${escapeMarkdown(session.name)}*\n\n` +
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
        `🎁 Название: ${escapeMarkdown(session.name)}\n` +
        `📝 Описание: ${escapeMarkdown(session.description)}\n` +
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
        
        message += `${statusEmoji} *${escapeMarkdown(giveaway.title)}*\n`;
        message += `┣ 📅 ${typeText}\n`;
        message += `┣ 🎁 ${escapeMarkdown(giveaway.prize?.name || 'Приз не указан')}\n`;
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
      
      let message = `${statusEmoji} *${escapeMarkdown(giveaway.title)}*\n\n`;
      message += `📅 *Тип:* ${typeText}\n`;
      message += `🎁 *Приз:* ${escapeMarkdown(giveaway.prize?.name || 'Не указан')}\n`;
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
          message += `${index + 1}. ${escapeMarkdown(winner.user?.firstName || 'Пользователь')}\n`;
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
      
      keyboard.push([
        { text: '📢 Напомнить о розыгрыше', callback_data: `remind_giveaway_${giveawayId}` }
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
          message += `${index + 1}. ${escapeMarkdown(winner.user?.firstName || 'Пользователь')}\n`;
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
        `🎯 *Создание розыгрыша: ${escapeMarkdown(text)}*\n\n` +
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
      let message = `🎯 *Создание розыгрыша: ${escapeMarkdown(session.title)}*\n\n` +
                   'Выберите приз для розыгрыша:\n\n';
      
      const keyboard = [];
      for (let i = 0; i < session.availablePrizes.length; i++) {
        const prize = session.availablePrizes[i];
        message += `${i + 1}. ${escapeMarkdown(prize.name)} (${prize.value} USDT)\n`;
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

/**
 * Редактирование времени розыгрыша
 */
async function editGiveawayTime(ctx, giveawayId) {
  try {
    // Получаем данные розыгрыша
    const response = await apiClient.get(`/admin/giveaways`);
    
    if (response.data.success) {
      const giveaway = response.data.data.giveaways.find(g => g._id === giveawayId);
      
      if (!giveaway) {
        await ctx.reply('❌ Розыгрыш не найден');
        return;
      }

      if (giveaway.status === 'completed') {
        await ctx.reply('❌ Нельзя редактировать завершенные розыгрыши');
        return;
      }

      const currentDrawDate = new Date(giveaway.drawDate);
      const formattedDate = currentDrawDate.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      ctx.session.editingGiveawayTime = {
        giveawayId: giveawayId,
        step: 'waiting_date'
      };

      await ctx.reply(
        `⏰ *Редактирование времени розыгрыша*\n\n` +
        `🎁 Розыгрыш: ${escapeMarkdown(giveaway.title)}\n` +
        `📅 Текущее время: ${formattedDate} МСК\n\n` +
        `Введите новую дату и время в формате:\n` +
        `\`ДД.ММ.ГГГГ ЧЧ:ММ\`\n\n` +
        `Например: \`15.06.2025 20:00\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отмена', callback_data: `giveaway_details_${giveawayId}` }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('ADMIN: Ошибка редактирования времени:', error);
    await ctx.reply('❌ Ошибка при редактировании времени');
  }
}

/**
 * Полное редактирование розыгрыша
 */
async function editGiveaway(ctx, giveawayId) {
  try {
    // Получаем данные розыгрыша
    const response = await apiClient.get(`/admin/giveaways`);
    
    if (response.data.success) {
      const giveaway = response.data.data.giveaways.find(g => g._id === giveawayId);
      
      if (!giveaway) {
        await ctx.reply('❌ Розыгрыш не найден');
        return;
      }

      if (giveaway.status === 'completed') {
        await ctx.reply('❌ Нельзя редактировать завершенные розыгрыши');
        return;
      }

      const keyboard = [
        [
          { text: '🏆 Количество победителей', callback_data: `edit_winners_${giveawayId}` },
          { text: '💰 Мин. депозит', callback_data: `edit_deposit_${giveawayId}` }
        ],
        [
          { text: '📝 Название', callback_data: `edit_title_${giveawayId}` },
          { text: '⏰ Время', callback_data: `edit_time_${giveawayId}` }
        ],
        [
          { text: '🎁 Изменить приз', callback_data: `edit_prize_${giveawayId}` }
        ],
        [
          { text: '🔙 Назад', callback_data: `giveaway_details_${giveawayId}` }
        ]
      ];

      await ctx.editMessageText(
        `📝 *Редактирование розыгрыша*\n\n` +
        `🎁 ${escapeMarkdown(giveaway.title)}\n\n` +
        `Выберите что хотите изменить:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
    }
  } catch (error) {
    console.error('ADMIN: Ошибка редактирования розыгрыша:', error);
    await ctx.reply('❌ Ошибка при загрузке редактирования');
  }
}

/**
 * Просмотр участников розыгрыша
 */
async function viewParticipants(ctx, giveawayId, page = 1) {
  try {
    const response = await apiClient.get(`/admin/giveaways/${giveawayId}/participants?page=${page}&limit=10`);
    
    if (response.data.success) {
      const { participants, pagination } = response.data.data;
      
      let message = `👥 *Участники розыгрыша*\n\n`;
      
      if (participants.length === 0) {
        message += `📭 Пока нет участников`;
      } else {
        message += `👥 Всего участников: ${pagination.total}\n\n`;
        
        participants.forEach((participant, index) => {
          const position = (page - 1) * 10 + index + 1;
          const userName = participant.user?.firstName || participant.user?.username || 'Неизвестный';
          const depositAmount = participant.depositAmount || 0;
          const statusEmoji = participant.isWinner ? '🏆' : '👤';
          
          message += `${statusEmoji} \`№${participant.participationNumber}\` ${escapeMarkdown(userName)}\n`;
          message += `   💰 Депозит: ${depositAmount} USDT\n`;
          message += `   📅 ${new Date(participant.createdAt).toLocaleString('ru-RU')}\n\n`;
        });
      }
      
      const keyboard = [];
      
      // Пагинация
      if (pagination.pages > 1) {
        const navRow = [];
        if (page > 1) {
          navRow.push({ text: '⬅️ Пред', callback_data: `participants_${giveawayId}_${page - 1}` });
        }
        navRow.push({ text: `${page}/${pagination.pages}`, callback_data: 'noop' });
        if (page < pagination.pages) {
          navRow.push({ text: 'След ➡️', callback_data: `participants_${giveawayId}_${page + 1}` });
        }
        keyboard.push(navRow);
      }
      
      keyboard.push([{ text: '🔙 К розыгрышу', callback_data: `giveaway_details_${giveawayId}` }]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (error) {
    console.error('ADMIN: Ошибка просмотра участников:', error);
    await ctx.reply('❌ Ошибка загрузки участников');
  }
}

/**
 * Начать редактирование конкретного поля
 */
async function startEditField(ctx, giveawayId, field) {
  try {
    // Получаем данные розыгрыша
    const response = await apiClient.get(`/admin/giveaways`);
    
    if (response.data.success) {
      const giveaway = response.data.data.giveaways.find(g => g._id === giveawayId);
      
      if (!giveaway) {
        await ctx.reply('❌ Розыгрыш не найден');
        return;
      }

      if (giveaway.status === 'completed') {
        await ctx.reply('❌ Нельзя редактировать завершенные розыгрыши');
        return;
      }

      ctx.session.editingGiveawayField = {
        giveawayId: giveawayId,
        field: field,
        step: 'waiting_value'
      };

      let message = '';
      let currentValue = '';

      switch (field) {
        case 'winnersCount':
          currentValue = giveaway.winnersCount;
          message = `🏆 *Редактирование количества победителей*\n\n` +
                   `🎁 Розыгрыш: ${escapeMarkdown(giveaway.title)}\n` +
                   `📊 Текущее значение: ${currentValue}\n\n` +
                   `Введите новое количество победителей (число от 1 до 10):`;
          break;
        
        case 'minDepositAmount':
          currentValue = giveaway.minDepositAmount || 1;
          message = `💰 *Редактирование минимального депозита*\n\n` +
                   `🎁 Розыгрыш: ${escapeMarkdown(giveaway.title)}\n` +
                   `💳 Текущее значение: ${currentValue} USDT\n\n` +
                   `Введите новую минимальную сумму депозита (например: 5):`;
          break;
        
        case 'title':
          currentValue = giveaway.title;
          message = `📝 *Редактирование названия*\n\n` +
                   `📊 Текущее название: ${escapeMarkdown(currentValue)}\n\n` +
                   `Введите новое название розыгрыша:`;
          break;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отмена', callback_data: `edit_giveaway_${giveawayId}` }]
          ]
        }
      });
    }
  } catch (error) {
    console.error('ADMIN: Ошибка начала редактирования поля:', error);
    await ctx.reply('❌ Ошибка при редактировании');
  }
}

/**
 * Обработка ввода нового времени
 */
async function handleTimeEdit(ctx) {
  try {
    const text = ctx.message.text.trim();
    const { giveawayId } = ctx.session.editingGiveawayTime;

    // Парсинг даты в формате ДД.ММ.ГГГГ ЧЧ:ММ
    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/;
    const match = text.match(dateRegex);

    if (!match) {
      await ctx.reply(
        '❌ Неверный формат даты!\n\n' +
        'Используйте формат: `ДД.ММ.ГГГГ ЧЧ:ММ`\n' +
        'Например: `15.06.2025 20:00`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const [, day, month, year, hour, minute] = match;
    
    // Создаем дату в московском времени
    const newDrawDate = new Date();
    newDrawDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    newDrawDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    // Проверяем что дата в будущем
    if (newDrawDate <= new Date()) {
      await ctx.reply('❌ Дата розыгрыша должна быть в будущем!');
      return;
    }

    // Обновляем розыгрыш
    const updateData = {
      drawDate: newDrawDate.toISOString(),
      // Также обновляем endDate (за час до розыгрыша)
      endDate: new Date(newDrawDate.getTime() - 60 * 60 * 1000).toISOString()
    };

    const response = await apiClient.put(`/admin/giveaways/${giveawayId}`, updateData);

    if (response.data.success) {
      delete ctx.session.editingGiveawayTime;
      
      const formattedDate = newDrawDate.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow'
      });
      
      await ctx.reply(
        `✅ *Время розыгрыша обновлено!*\n\n` +
        `⏰ Новое время: ${formattedDate} МСК`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 К розыгрышу', callback_data: `giveaway_details_${giveawayId}` }]
            ]
          }
        }
      );
    } else {
      await ctx.reply(`❌ Ошибка обновления: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка обработки редактирования времени:', error);
    await ctx.reply('❌ Ошибка при обновлении времени');
    delete ctx.session.editingGiveawayTime;
  }
}

/**
 * Обработка ввода нового значения поля
 */
async function handleFieldEdit(ctx) {
  try {
    const text = ctx.message.text.trim();
    const { giveawayId, field } = ctx.session.editingGiveawayField;

    let newValue;
    let updateData = {};

    switch (field) {
      case 'winnersCount':
        newValue = parseInt(text);
        if (isNaN(newValue) || newValue < 1 || newValue > 10) {
          await ctx.reply('❌ Введите число от 1 до 10!');
          return;
        }
        updateData.winnersCount = newValue;
        break;
      
      case 'minDepositAmount':
        newValue = parseFloat(text);
        if (isNaN(newValue) || newValue < 0) {
          await ctx.reply('❌ Введите корректную сумму (например: 5 или 10.5)!');
          return;
        }
        updateData.minDepositAmount = newValue;
        break;
      
      case 'title':
        if (text.length < 3 || text.length > 100) {
          await ctx.reply('❌ Название должно быть от 3 до 100 символов!');
          return;
        }
        updateData.title = text;
        newValue = text;
        break;
    }

    // Обновляем розыгрыш
    const response = await apiClient.put(`/admin/giveaways/${giveawayId}`, updateData);

    if (response.data.success) {
      delete ctx.session.editingGiveawayField;
      
      const fieldNames = {
        winnersCount: 'Количество победителей',
        minDepositAmount: 'Минимальный депозит',
        title: 'Название'
      };
      
      const valueText = field === 'minDepositAmount' ? `${newValue} USDT` : newValue;
      
      await ctx.reply(
        `✅ *${fieldNames[field]} обновлено!*\n\n` +
        `📊 Новое значение: ${valueText}`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 К розыгрышу', callback_data: `giveaway_details_${giveawayId}` }]
            ]
          }
        }
      );
    } else {
      await ctx.reply(`❌ Ошибка обновления: ${response.data.message}`);
    }
  } catch (error) {
    console.error('ADMIN: Ошибка обработки редактирования поля:', error);
    await ctx.reply('❌ Ошибка при обновлении');
    delete ctx.session.editingGiveawayField;
  }
}

/**
 * Отправка ручного напоминания о розыгрыше
 */
async function sendGiveawayReminder(ctx, giveawayId) {
  try {
    // Получаем данные розыгрыша
    const response = await apiClient.get(`/admin/giveaways`);
    
    if (response.data.success) {
      const giveaway = response.data.data.giveaways.find(g => g._id === giveawayId);
      
      if (!giveaway) {
        await ctx.reply('❌ Розыгрыш не найден');
        return;
      }

      if (giveaway.status !== 'active') {
        await ctx.reply('❌ Можно напоминать только об активных розыгрышах');
        return;
      }

      const keyboard = [
        [
          { text: '🤖 В боте пользователям', callback_data: `remind_bot_${giveawayId}` },
          { text: '📢 В канале', callback_data: `remind_channel_${giveawayId}` }
        ],
        [
          { text: '🌐 В боте И канале', callback_data: `remind_both_${giveawayId}` }
        ],
        [
          { text: '🔙 Назад', callback_data: `giveaway_details_${giveawayId}` }
        ]
      ];

      const drawTime = new Date(giveaway.drawDate).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow'
      });

      await ctx.editMessageText(
        `📢 *Напоминание о розыгрыше*\n\n` +
        `🎁 ${escapeMarkdown(giveaway.title)}\n` +
        `🏆 Приз: ${escapeMarkdown(giveaway.prize?.name || 'Не указан')}\n` +
        `⏰ Розыгрыш: ${drawTime} МСК\n` +
        `👥 Участников: ${giveaway.participationCount}\n\n` +
        `Куда отправить напоминание?`,
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
    }
  } catch (error) {
    console.error('ADMIN: Ошибка показа напоминания:', error);
    await ctx.reply('❌ Ошибка при загрузке напоминания');
  }
}

/**
 * Настройки автоматических напоминаний
 */
async function showReminderSettings(ctx) {
  try {
    const keyboard = [
      [
        { text: '⚙️ Настройки авто-напоминаний', callback_data: 'reminder_auto_settings' }
      ],
      [
        { text: '📊 Статистика напоминаний', callback_data: 'reminder_stats' }
      ],
      [
        { text: '🔄 Перезапустить задачи', callback_data: 'reminder_restart_jobs' }
      ],
      [
        { text: '🔙 К розыгрышам', callback_data: 'giveaways_menu' }
      ]
    ];

    await ctx.editMessageText(
      `⚙️ *Управление напоминаниями*\n\n` +
      `📋 Доступные функции:\n\n` +
      `🤖 **Автоматические напоминания:**\n` +
      `┣ За 2 часа до окончания\n` +
      `┣ Отправляются в бот пользователям\n` +
      `┗ Запускаются каждый час\n\n` +
      `📢 **Ручные напоминания:**\n` +
      `┣ В любое время по запросу\n` +
      `┣ Выбор: бот, канал или оба\n` +
      `┗ Доступны в деталях розыгрыша`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }
    );
  } catch (error) {
    console.error('ADMIN: Ошибка показа настроек напоминаний:', error);
    await ctx.reply('❌ Ошибка загрузки настроек');
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
  handleGiveawayCreation,
  editGiveawayTime,
  editGiveaway,
  viewParticipants,
  startEditField,
  handleTimeEdit,
  handleFieldEdit,
  sendGiveawayReminder,
  showReminderSettings
};