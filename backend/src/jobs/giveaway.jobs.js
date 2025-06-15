// backend/src/jobs/giveaway.jobs.js
const cron = require('node-cron');
const GiveawayService = require('../services/giveaway.service');
const TelegramService = require('../services/telegram.service');
const { Giveaway, GiveawayParticipation } = require('../models');

class GiveawayJobs {
  constructor() {
    this.giveawayService = new GiveawayService();
    this.telegramService = new TelegramService();
    this.jobs = new Map();
  }

  /**
   * Запуск всех крон-задач
   */
  startAllJobs() {
    try {
      // Проверка готовых к проведению розыгрышей каждые 5 минут
      this.startGiveawayCheck();
      
      // Автоматическое создание ежедневных розыгрышей
      this.startDailyGiveawayCreation();
      
      // Автоматическое создание недельных розыгрышей
      this.startWeeklyGiveawayCreation();
      
      // Отправка напоминаний
      this.startReminderJobs();
      
      // Очистка старых данных
      this.startCleanupJobs();

      console.log('✅ Все задачи розыгрышей запущены');
    } catch (error) {
      console.error('❌ Ошибка запуска задач розыгрышей:', error);
    }
  }

  /**
   * Проверка и проведение готовых розыгрышей
   */
  startGiveawayCheck() {
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🔍 Проверка готовых к проведению розыгрышей...');
        const conductedCount = await this.giveawayService.scheduleAutomaticGiveaways();
        
        if (conductedCount > 0) {
          console.log(`✅ Проведено розыгрышей: ${conductedCount}`);
        }
      } catch (error) {
        console.error('❌ Ошибка при проверке розыгрышей:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('giveawayCheck', task);
    task.start();
    console.log('📅 Запущена задача проверки розыгрышей (каждые 5 минут)');
  }

  /**
   * Создание ежедневных розыгрышей
   */
  startDailyGiveawayCreation() {
    // Каждый день в 00:01 создаем ежедневный розыгрыш
    const task = cron.schedule('1 0 * * *', async () => {
      try {
        console.log('🎯 Создание ежедневного розыгрыша...');
        await this.createDailyGiveaway();
      } catch (error) {
        console.error('❌ Ошибка создания ежедневного розыгрыша:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Moscow'
    });

    this.jobs.set('dailyCreation', task);
    task.start();
    console.log('📅 Запущена задача создания ежедневных розыгрышей (00:01 каждый день)');
  }

  /**
   * Создание недельных розыгрышей
   */
  startWeeklyGiveawayCreation() {
    // Каждое воскресенье в 00:01 создаем недельный розыгрыш
    const task = cron.schedule('1 0 * * 0', async () => {
      try {
        console.log('💎 Создание недельного розыгрыша...');
        await this.createWeeklyGiveaway();
      } catch (error) {
        console.error('❌ Ошибка создания недельного розыгрыша:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Moscow'
    });

    this.jobs.set('weeklyCreation', task);
    task.start();
    console.log('📅 Запущена задача создания недельных розыгрышей (00:01 каждое воскресенье)');
  }

  /**
   * Напоминания о розыгрышах
   */
  startReminderJobs() {
    // Напоминания за 2 часа до окончания
    const reminderTask = cron.schedule('0 */1 * * *', async () => {
      try {
        await this.sendGiveawayReminders();
      } catch (error) {
        console.error('❌ Ошибка отправки напоминаний:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Moscow'
    });

    this.jobs.set('reminders', reminderTask);
    reminderTask.start();
    console.log('📅 Запущена задача напоминаний (каждый час)');
  }

  /**
   * Очистка старых данных
   */
  startCleanupJobs() {
    // Очистка старых завершенных розыгрышей (каждый день в 02:00)
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Очистка старых данных розыгрышей...');
        await this.cleanupOldGiveaways();
      } catch (error) {
        console.error('❌ Ошибка очистки данных:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Moscow'
    });

    this.jobs.set('cleanup', cleanupTask);
    cleanupTask.start();
    console.log('📅 Запущена задача очистки данных (02:00 каждый день)');
  }

  /**
   * Создание автоматического ежедневного розыгрыша
   */
  async createDailyGiveaway() {
    try {
      // Получаем случайный приз для ежедневного розыгрыша
      const prizes = await this.getAvailablePrizes('daily');
      if (prizes.length === 0) {
        console.log('⚠️ Нет доступных призов для ежедневного розыгрыша');
        return;
      }

      const randomPrize = prizes[Math.floor(Math.random() * prizes.length)];
      
      const today = new Date();
      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      endDate.setHours(19, 0, 0, 0); // До 19:00
      
      const drawDate = new Date(today);
      drawDate.setUTCHours(20 - 3, 0, 0, 0); // Розыгрыш в 20:00 МСК (UTC = MSK - 3)

      // Проверяем, нет ли уже созданного розыгрыша на сегодня
      const existingGiveaway = await Giveaway.findOne({
        type: 'daily',
        startDate: { $gte: startDate },
        status: { $in: ['pending', 'active'] }
      });

      if (existingGiveaway) {
        console.log('ℹ️ Ежедневный розыгрыш на сегодня уже существует');
        return;
      }

      const giveaway = new Giveaway({
        title: `Ежедневный розыгрыш ${today.toLocaleDateString('ru-RU')}`,
        type: 'daily',
        prize: randomPrize._id,
        winnersCount: 1,
        startDate,
        endDate,
        drawDate,
        status: 'active',
        requiresDeposit: true,
        depositTimeframe: 'same_day',
        createdBy: null // Системный розыгрыш
      });

      await giveaway.save();

      // Объявляем о начале розыгрыша
      const populatedGiveaway = await Giveaway.findById(giveaway._id).populate('prize');
      await this.telegramService.announceGiveawayStart(populatedGiveaway);

      console.log(`✅ Создан ежедневный розыгрыш: ${giveaway._id}`);
    } catch (error) {
      console.error('❌ Ошибка создания ежедневного розыгрыша:', error);
    }
  }

  /**
   * Создание автоматического недельного розыгрыша
   */
  async createWeeklyGiveaway() {
    try {
      const prizes = await this.getAvailablePrizes('weekly');
      if (prizes.length === 0) {
        console.log('⚠️ Нет доступных призов для недельного розыгрыша');
        return;
      }

      // Для недельного розыгрыша выбираем более ценные призы
      const premiumPrizes = prizes.filter(p => p.value >= 100 || p.type === 'telegram_gift');
      const selectedPrize = premiumPrizes.length > 0 ? 
        premiumPrizes[Math.floor(Math.random() * premiumPrizes.length)] :
        prizes[Math.floor(Math.random() * prizes.length)];

      const today = new Date(); // Воскресенье
      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      
      // Неделя участия до следующего воскресенья 19:00
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      endDate.setHours(19, 0, 0, 0);
      
      // Розыгрыш в следующее воскресенье в 20:00
      const drawDate = new Date(today);
      drawDate.setDate(today.getDate() + 7);
      drawDate.setUTCHours(20 - 3, 0, 0, 0); // Розыгрыш в 20:00 МСК (UTC = MSK - 3)

      const existingGiveaway = await Giveaway.findOne({
        type: 'weekly',
        startDate: { $gte: startDate },
        status: { $in: ['pending', 'active'] }
      });

      if (existingGiveaway) {
        console.log('ℹ️ Недельный розыгрыш на эту неделю уже существует');
        return;
      }

      const giveaway = new Giveaway({
        title: `Недельный розыгрыш ${today.toLocaleDateString('ru-RU')}`,
        type: 'weekly',
        prize: selectedPrize._id,
        winnersCount: 3,
        startDate,
        endDate,
        drawDate,
        status: 'active',
        requiresDeposit: true,
        depositTimeframe: 'same_week',
        createdBy: null
      });

      await giveaway.save();

      const populatedGiveaway = await Giveaway.findById(giveaway._id).populate('prize');
      await this.telegramService.announceGiveawayStart(populatedGiveaway);

      console.log(`✅ Создан недельный розыгрыш: ${giveaway._id}`);
    } catch (error) {
      console.error('❌ Ошибка создания недельного розыгрыша:', error);
    }
  }

  /**
   * Получение доступных призов
   */
  async getAvailablePrizes(type) {
    const { GiveawayPrize } = require('../models');
    
    // Фильтруем призы по типу розыгрыша
    const filter = { isActive: true };
    
    if (type === 'daily') {
      // Для ежедневных розыгрышей - менее ценные призы
      filter.$or = [
        { value: { $lte: 50 } },
        { type: 'promo_code' }
      ];
    } else if (type === 'weekly') {
      // Для недельных розыгрышей - более ценные призы
      filter.$or = [
        { value: { $gte: 50 } },
        { type: 'telegram_gift' }
      ];
    }

    return await GiveawayPrize.find(filter);
  }

  /**
   * Отправка напоминаний о розыгрышах
   */
  async sendGiveawayReminders() {
    try {
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Находим розыгрыши, которые заканчиваются через 2 часа
      const endingSoon = await Giveaway.find({
        status: 'active',
        endDate: {
          $gte: now,
          $lte: twoHoursLater
        }
      }).populate('prize');

      for (const giveaway of endingSoon) {
        // Проверяем, не отправляли ли уже напоминание
        if (!giveaway.reminderSent) {
          const participantsCount = await GiveawayParticipation.countDocuments({
            giveaway: giveaway._id
          });

          await this.telegramService.sendGiveawayReminder(giveaway, participantsCount);
          
          // Отмечаем, что напоминание отправлено
          giveaway.reminderSent = true;
          await giveaway.save();

          console.log(`📢 Отправлено напоминание для розыгрыша: ${giveaway._id}`);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка отправки напоминаний:', error);
    }
  }

  /**
   * Очистка старых данных
   */
  async cleanupOldGiveaways() {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Удаляем старые завершенные розыгрыши и их участия
      const oldGiveaways = await Giveaway.find({
        status: 'completed',
        createdAt: { $lt: oneMonthAgo }
      });

      for (const giveaway of oldGiveaways) {
        await GiveawayParticipation.deleteMany({ giveaway: giveaway._id });
      }

      const deletedCount = await Giveaway.deleteMany({
        status: 'completed',
        createdAt: { $lt: oneMonthAgo }
      });

      console.log(`🧹 Очищено старых розыгрышей: ${deletedCount.deletedCount}`);
    } catch (error) {
      console.error('❌ Ошибка очистки данных:', error);
    }
  }

  /**
   * Остановка всех задач
   */
  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Остановлена задача: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Получение статуса задач
   */
  getJobsStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        lastDate: job.lastDate,
        nextDate: job.nextDate
      };
    });
    return status;
  }
}

module.exports = GiveawayJobs;