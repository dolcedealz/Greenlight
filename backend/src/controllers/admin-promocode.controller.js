const Promocode = require('../models/promocode.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { validationResult } = require('express-validator');

/**
 * Создать промокод (админ)
 */
exports.createPromocode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const {
      code,
      type,
      value,
      usageLimit,
      duration,
      description,
      conditions,
      settings
    } = req.body;

    // Проверяем уникальность кода
    const existingPromocode = await Promocode.findOne({ code: code.toUpperCase() });
    if (existingPromocode) {
      return res.status(400).json({
        success: false,
        message: 'Промокод с таким кодом уже существует'
      });
    }

    // Создаем промокод
    const promocode = new Promocode({
      code: code.toUpperCase(),
      type,
      value,
      usageLimit: usageLimit || 1,
      duration: duration || 30,
      description,
      createdBy: req.user.id,
      conditions: conditions || {},
      settings: formatPromocodeSettings(type, settings || {}, value),
      expiresAt: new Date(Date.now() + (duration || 30) * 24 * 60 * 60 * 1000)
    });

    await promocode.save();

    res.status(201).json({
      success: true,
      message: 'Промокод успешно создан',
      data: {
        promocode: {
          id: promocode._id,
          code: promocode.code,
          type: promocode.type,
          value: promocode.value,
          usageLimit: promocode.usageLimit,
          duration: promocode.duration,
          description: promocode.description,
          expiresAt: promocode.expiresAt,
          settings: promocode.settings,
          conditions: promocode.conditions
        }
      }
    });

  } catch (error) {
    console.error('Ошибка создания промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Получить список промокодов (админ)
 */
exports.getPromocodes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Формируем фильтр
    let filter = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (status === 'active') {
      filter.isActive = true;
      filter.expiresAt = { $gt: new Date() };
    } else if (status === 'expired') {
      filter.expiresAt = { $lte: new Date() };
    } else if (status === 'inactive') {
      filter.isActive = false;
    }
    
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Получаем промокоды с пагинацией
    const [promocodes, total] = await Promise.all([
      Promocode.find(filter)
        .populate('createdBy', 'firstName lastName telegramId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Promocode.countDocuments(filter)
    ]);

    // Форматируем данные
    const formattedPromocodes = promocodes.map(promo => ({
      id: promo._id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      usageLimit: promo.usageLimit,
      usedCount: promo.usedCount,
      remainingUsage: promo.remainingUsage,
      description: promo.description,
      isActive: promo.isActive,
      isExpired: promo.isExpired,
      createdBy: promo.createdBy,
      createdAt: promo.createdAt,
      expiresAt: promo.expiresAt,
      settings: promo.settings,
      conditions: promo.conditions,
      stats: promo.stats,
      activationRate: promo.activationRate
    }));

    res.status(200).json({
      success: true,
      data: {
        promocodes: formattedPromocodes,
        pagination: {
          current: pageNum,
          total: total,
          pages: Math.ceil(total / limitNum),
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Ошибка получения промокодов:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Получить статистику промокодов (админ)
 */
exports.getPromocodesStats = async (req, res) => {
  try {
    // Общая статистика
    const [
      totalPromocodes,
      activePromocodes,
      expiredPromocodes,
      totalActivations,
      typeStats,
      recentActivations
    ] = await Promise.all([
      Promocode.countDocuments({}),
      Promocode.countDocuments({ 
        isActive: true, 
        expiresAt: { $gt: new Date() } 
      }),
      Promocode.countDocuments({ 
        expiresAt: { $lte: new Date() } 
      }),
      Promocode.aggregate([
        { $group: { _id: null, total: { $sum: '$usedCount' } } }
      ]),
      Promocode.getActiveStats(),
      getRecentActivations()
    ]);

    // Топ промокодов по использованию
    const topPromocodes = await Promocode.find({})
      .sort({ usedCount: -1 })
      .limit(10)
      .select('code type usedCount usageLimit description activationRate');

    // Статистика по периодам
    const periodStats = await getPromocodesPeriodStats();

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total: totalPromocodes,
          active: activePromocodes,
          expired: expiredPromocodes,
          totalActivations: totalActivations.length > 0 ? totalActivations[0].total : 0
        },
        byType: typeStats,
        topPromocodes: topPromocodes,
        recentActivations: recentActivations,
        periodStats: periodStats
      }
    });

  } catch (error) {
    console.error('Ошибка получения статистики промокодов:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Получить детали промокода (админ)
 */
exports.getPromocodeDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const promocode = await Promocode.findById(id)
      .populate('createdBy', 'firstName lastName telegramId')
      .populate('activatedBy.user', 'firstName lastName telegramId');

    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    // Получаем связанные транзакции
    const transactions = await Transaction.find({
      'metadata.promocodeId': promocode._id
    }).populate('user', 'firstName lastName telegramId');

    res.status(200).json({
      success: true,
      data: {
        promocode: promocode,
        transactions: transactions
      }
    });

  } catch (error) {
    console.error('Ошибка получения деталей промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Обновить промокод (админ)
 */
exports.updatePromocode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Запрещаем изменение некоторых полей
    delete updates.code; // Код нельзя изменить
    delete updates.usedCount; // Счетчик использований нельзя изменить
    delete updates.activatedBy; // Список активаций нельзя изменить
    delete updates.createdBy; // Создателя нельзя изменить

    const promocode = await Promocode.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Промокод успешно обновлен',
      data: {
        promocode: promocode
      }
    });

  } catch (error) {
    console.error('Ошибка обновления промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Деактивировать промокод (админ)
 */
exports.deactivatePromocode = async (req, res) => {
  try {
    const { id } = req.params;

    const promocode = await Promocode.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Промокод деактивирован',
      data: {
        promocode: promocode
      }
    });

  } catch (error) {
    console.error('Ошибка деактивации промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Удалить промокод (админ)
 */
exports.deletePromocode = async (req, res) => {
  try {
    const { id } = req.params;

    const promocode = await Promocode.findById(id);
    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден'
      });
    }

    // Проверяем, был ли промокод использован
    if (promocode.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Нельзя удалить промокод, который уже был использован. Деактивируйте его вместо удаления.'
      });
    }

    await Promocode.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Промокод успешно удален'
    });

  } catch (error) {
    console.error('Ошибка удаления промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

// Вспомогательные функции

/**
 * Форматировать настройки промокода
 */
function formatPromocodeSettings(type, settings, value) {
  const formattedSettings = {};

  switch (type) {
    case 'balance':
      formattedSettings.balanceAmount = settings.balanceAmount || value;
      break;
    case 'freespins':
      formattedSettings.freespinsCount = settings.freespinsCount || value;
      formattedSettings.freespinsGame = settings.freespinsGame || 'slots';
      break;
    case 'deposit':
      formattedSettings.depositPercentage = settings.depositPercentage || value;
      formattedSettings.maxDepositBonus = settings.maxDepositBonus || null;
      break;
    case 'vip':
      formattedSettings.vipDays = settings.vipDays || value;
      break;
  }

  return formattedSettings;
}

/**
 * Получить недавние активации промокодов
 */
async function getRecentActivations() {
  const recent = await Promocode.aggregate([
    { $unwind: '$activatedBy' },
    { $sort: { 'activatedBy.activatedAt': -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'activatedBy.user',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        code: 1,
        type: 1,
        activatedAt: '$activatedBy.activatedAt',
        user: {
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          telegramId: '$user.telegramId'
        }
      }
    }
  ]);

  return recent;
}

/**
 * Получить статистику по периодам
 */
async function getPromocodesPeriodStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const periodStats = await Promocode.aggregate([
    {
      $facet: {
        today: [
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: today } 
            } 
          },
          { $unwind: '$activatedBy' },
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: today } 
            } 
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ],
        thisWeek: [
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: thisWeek } 
            } 
          },
          { $unwind: '$activatedBy' },
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: thisWeek } 
            } 
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ],
        thisMonth: [
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: thisMonth } 
            } 
          },
          { $unwind: '$activatedBy' },
          { 
            $match: { 
              'activatedBy.activatedAt': { $gte: thisMonth } 
            } 
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ]
      }
    }
  ]);

  const stats = periodStats[0];
  
  return {
    today: stats.today.length > 0 ? stats.today[0].count : 0,
    thisWeek: stats.thisWeek.length > 0 ? stats.thisWeek[0].count : 0,
    thisMonth: stats.thisMonth.length > 0 ? stats.thisMonth[0].count : 0
  };
}