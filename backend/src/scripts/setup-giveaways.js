// backend/src/scripts/setup-giveaways.js
const mongoose = require('mongoose');
const { GiveawayPrize, Giveaway, User } = require('../models');
require('dotenv').config();

async function setupGiveaways() {
  try {
    // Подключение к базе данных
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB установлено');

    // Очистка существующих данных (опционально)
    const clearExisting = process.argv.includes('--clear');
    if (clearExisting) {
      console.log('🧹 Очистка существующих данных...');
      await GiveawayPrize.deleteMany({});
      await Giveaway.deleteMany({});
      console.log('✅ Данные очищены');
    }

    // Создание призов
    console.log('🎁 Создание призов...');
    const prizes = await createPrizes();
    console.log(`✅ Создано призов: ${prizes.length}`);

    // Создание тестовых розыгрышей
    console.log('🎯 Создание тестовых розыгрышей...');
    const giveaways = await createTestGiveaways(prizes);
    console.log(`✅ Создано розыгрышей: ${giveaways.length}`);

    console.log('\n🎉 Настройка розыгрышей завершена!');
    console.log('\n📋 Созданные призы:');
    prizes.forEach(prize => {
      console.log(`  - ${prize.name} (${prize.type})`);
    });

    console.log('\n🎯 Созданные розыгрыши:');
    giveaways.forEach(giveaway => {
      console.log(`  - ${giveaway.title} (${giveaway.type}, статус: ${giveaway.status})`);
    });

  } catch (error) {
    console.error('❌ Ошибка настройки:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

async function createPrizes() {
  // Получаем первого админа для создания призов
  const admin = await User.findOne({ role: 'admin' });
  const adminId = admin ? admin._id : null;

  const prizesData = [
    // Telegram Gifts
    {
      name: 'Золотая звезда Telegram',
      description: 'Эксклюзивный подарок в Telegram',
      type: 'telegram_gift',
      value: 500,
      giftData: {
        telegramGiftId: 'gold_star_001',
        giftStickerId: 'star_gold'
      },
      createdBy: adminId
    },
    {
      name: 'Серебряная звезда Telegram',
      description: 'Красивый подарок в Telegram',
      type: 'telegram_gift',
      value: 100,
      giftData: {
        telegramGiftId: 'silver_star_001',
        giftStickerId: 'star_silver'
      },
      createdBy: adminId
    },
    {
      name: 'Премиум стикер-пак',
      description: 'Эксклюзивные стикеры для Telegram',
      type: 'telegram_gift',
      value: 50,
      giftData: {
        telegramGiftId: 'sticker_pack_001',
        giftStickerId: 'stickers_premium'
      },
      createdBy: adminId
    },

    // Промокоды
    {
      name: 'Промокод 50 USDT',
      description: 'Бонус на игровой баланс',
      type: 'promo_code',
      value: 50,
      createdBy: adminId
    },
    {
      name: 'Промокод 25 USDT',
      description: 'Бонус на игровой баланс',
      type: 'promo_code',
      value: 25,
      createdBy: adminId
    },
    {
      name: 'Промокод 10 USDT',
      description: 'Бонус на игровой баланс',
      type: 'promo_code',
      value: 10,
      createdBy: adminId
    },

    // Бонусы баланса
    {
      name: 'Бонус 100 USDT',
      description: 'Прямое пополнение баланса',
      type: 'balance_bonus',
      value: 100,
      createdBy: adminId
    },
    {
      name: 'Бонус 20 USDT',
      description: 'Прямое пополнение баланса',
      type: 'balance_bonus',
      value: 20,
      createdBy: adminId
    }
  ];

  const prizes = [];
  for (const prizeData of prizesData) {
    const prize = new GiveawayPrize(prizeData);
    await prize.save();
    prizes.push(prize);
  }

  return prizes;
}

async function createTestGiveaways(prizes) {
  // Получаем админа для создания розыгрышей
  const admin = await User.findOne({ role: 'admin' });
  const adminId = admin ? admin._id : null;

  const now = new Date();
  const giveaways = [];

  // Создаем активный ежедневный розыгрыш на сегодня
  const dailyPrize = prizes.find(p => p.type === 'promo_code' && p.value === 25);
  if (dailyPrize) {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(19, 0, 0, 0);
    
    const todayDraw = new Date(now);
    todayDraw.setHours(20, 0, 0, 0);

    const dailyGiveaway = new Giveaway({
      title: `Ежедневный розыгрыш ${now.toLocaleDateString('ru-RU')}`,
      type: 'daily',
      prize: dailyPrize._id,
      winnersCount: 1,
      startDate: todayStart,
      endDate: todayEnd,
      drawDate: todayDraw,
      status: 'active',
      requiresDeposit: true,
      depositTimeframe: 'same_day',
      createdBy: adminId
    });

    await dailyGiveaway.save();
    giveaways.push(dailyGiveaway);
  }

  // Создаем активный недельный розыгрыш
  const weeklyPrize = prizes.find(p => p.type === 'telegram_gift' && p.value === 500);
  if (weeklyPrize) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Начало недели (воскресенье)
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(19, 0, 0, 0);
    
    const weekDraw = new Date(weekStart);
    weekDraw.setDate(weekStart.getDate() + 7);
    weekDraw.setHours(20, 0, 0, 0);

    const weeklyGiveaway = new Giveaway({
      title: `Недельный розыгрыш ${weekStart.toLocaleDateString('ru-RU')}`,
      type: 'weekly',
      prize: weeklyPrize._id,
      winnersCount: 3,
      startDate: weekStart,
      endDate: weekEnd,
      drawDate: weekDraw,
      status: 'active',
      requiresDeposit: true,
      depositTimeframe: 'same_week',
      createdBy: adminId
    });

    await weeklyGiveaway.save();
    giveaways.push(weeklyGiveaway);
  }

  // Создаем пример завершенного розыгрыша
  const completedPrize = prizes.find(p => p.type === 'promo_code' && p.value === 10);
  if (completedPrize) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(19, 0, 0, 0);
    
    const yesterdayDraw = new Date(yesterday);
    yesterdayDraw.setHours(20, 0, 0, 0);

    const completedGiveaway = new Giveaway({
      title: `Ежедневный розыгрыш ${yesterday.toLocaleDateString('ru-RU')}`,
      type: 'daily',
      prize: completedPrize._id,
      winnersCount: 1,
      startDate: yesterdayStart,
      endDate: yesterdayEnd,
      drawDate: yesterdayDraw,
      status: 'completed',
      requiresDeposit: true,
      depositTimeframe: 'same_day',
      participationCount: 15,
      diceResult: {
        value: 4,
        timestamp: yesterdayDraw
      },
      createdBy: adminId
    });

    await completedGiveaway.save();
    giveaways.push(completedGiveaway);
  }

  return giveaways;
}

// Запуск скрипта
setupGiveaways();