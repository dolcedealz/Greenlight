const Promocode = require('../models/promocode.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const CasinoFinance = require('../models/casino-finance.model');
const { validationResult } = require('express-validator');
const casinoFinanceService = require('../services/casino-finance.service');

/**
 * Активировать промокод
 */
exports.activatePromocode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { code } = req.body;
    const userId = req.user.id;
    const userIp = req.ip || req.connection.remoteAddress;

    // Находим промокод
    const promocode = await Promocode.findValidCode(code);
    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден или истек срок действия'
      });
    }

    // Проверяем, может ли пользователь использовать промокод
    if (!promocode.canBeUsedByUser(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Промокод уже использован или недоступен'
      });
    }

    // Получаем пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Проверяем условия промокода
    const conditionsCheck = await checkPromocodeConditions(promocode, user);
    if (!conditionsCheck.valid) {
      return res.status(400).json({
        success: false,
        message: conditionsCheck.message
      });
    }

    // Выполняем активацию промокода
    const activationResult = await executePromocodeActivation(promocode, user, userIp);

    // Обновляем статистику промокода
    await promocode.activate(userId, userIp);

    res.status(200).json({
      success: true,
      message: 'Промокод успешно активирован!',
      data: {
        promocode: {
          code: promocode.code,
          type: promocode.type,
          description: promocode.description
        },
        reward: activationResult.reward,
        transaction: activationResult.transaction
      }
    });

  } catch (error) {
    console.error('Ошибка активации промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Получить промокоды пользователя
 */
exports.getUserPromocodes = async (req, res) => {
  try {
    const userId = req.user.id;

    // Находим все промокоды, активированные пользователем
    const promocodes = await Promocode.find({
      'activatedBy.user': userId
    }).select('code type description activatedBy createdAt').sort({ 'activatedBy.activatedAt': -1 });

    // Форматируем данные
    const userPromocodes = promocodes.map(promo => {
      const activation = promo.activatedBy.find(act => act.user.toString() === userId);
      return {
        code: promo.code,
        type: promo.type,
        description: promo.description,
        activatedAt: activation ? activation.activatedAt : null,
        transactionId: activation ? activation.transactionId : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        promocodes: userPromocodes,
        total: userPromocodes.length
      }
    });

  } catch (error) {
    console.error('Ошибка получения промокодов пользователя:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Валидировать промокод (без активации)
 */
exports.validatePromocode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;

    const promocode = await Promocode.findValidCode(code);
    if (!promocode) {
      return res.status(404).json({
        success: false,
        message: 'Промокод не найден или истек'
      });
    }

    const user = await User.findById(userId);
    const canUse = promocode.canBeUsedByUser(userId);
    const conditionsCheck = await checkPromocodeConditions(promocode, user);

    // Рассчитываем потенциальную награду
    let rewardPreview = null;
    if (canUse && conditionsCheck.valid) {
      rewardPreview = calculateRewardPreview(promocode, user);
    }

    res.status(200).json({
      success: true,
      data: {
        code: promocode.code,
        type: promocode.type,
        description: promocode.description,
        canUse: canUse && conditionsCheck.valid,
        reason: !canUse || !conditionsCheck.valid ? conditionsCheck.message : null,
        rewardPreview: rewardPreview,
        expiresAt: promocode.expiresAt,
        remainingUsage: promocode.remainingUsage
      }
    });

  } catch (error) {
    console.error('Ошибка валидации промокода:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Получить доступные промокоды (публичная информация)
 */
exports.getAvailablePromocodes = async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = {
      isActive: true,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$usedCount', '$usageLimit'] }
    };

    if (type) {
      query.type = type;
    }

    const promocodes = await Promocode.find(query)
      .select('code type description expiresAt remainingUsage settings')
      .sort({ createdAt: -1 })
      .limit(10);

    // Фильтруем чувствительную информацию
    const publicPromocodes = promocodes.map(promo => ({
      code: promo.code,
      type: promo.type,
      description: promo.description,
      expiresAt: promo.expiresAt,
      remainingUsage: promo.remainingUsage,
      // Показываем только общую информацию о награде
      rewardInfo: getPublicRewardInfo(promo)
    }));

    res.status(200).json({
      success: true,
      data: {
        promocodes: publicPromocodes,
        total: publicPromocodes.length
      }
    });

  } catch (error) {
    console.error('Ошибка получения доступных промокодов:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
};

// Вспомогательные функции

/**
 * Проверить условия промокода
 */
async function checkPromocodeConditions(promocode, user) {
  const conditions = promocode.conditions || {};

  // Проверка минимального депозита
  if (conditions.minDeposit) {
    const userDeposits = await Transaction.aggregate([
      { $match: { user: user._id, type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = userDeposits.length > 0 ? userDeposits[0].total : 0;
    
    if (totalDeposits < conditions.minDeposit) {
      return {
        valid: false,
        message: `Требуется минимальный депозит ${conditions.minDeposit} USDT`
      };
    }
  }

  // Проверка максимального баланса
  if (conditions.maxBalance && user.balance > conditions.maxBalance) {
    return {
      valid: false,
      message: `Максимальный баланс для использования: ${conditions.maxBalance} USDT`
    };
  }

  // Проверка только для новых пользователей
  if (conditions.onlyNewUsers) {
    const daysSinceRegistration = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRegistration > 7) {
      return {
        valid: false,
        message: 'Промокод доступен только новым пользователям (до 7 дней)'
      };
    }
  }

  // Проверка уровня пользователя
  if (conditions.requiredLevel && user.level < conditions.requiredLevel) {
    return {
      valid: false,
      message: `Требуется уровень ${conditions.requiredLevel}`
    };
  }

  return { valid: true };
}

/**
 * Выполнить активацию промокода
 */
async function executePromocodeActivation(promocode, user, userIp) {
  let transaction = null;
  let reward = null;

  switch (promocode.type) {
    case 'balance':
      const balanceAmount = promocode.settings.balanceAmount || promocode.value;
      
      // Создаем транзакцию
      transaction = new Transaction({
        user: user._id,
        type: 'promocode_balance',
        amount: balanceAmount,
        status: 'completed',
        description: `Бонус от промокода ${promocode.code}`,
        metadata: {
          promocodeId: promocode._id,
          promocodeCode: promocode.code,
          ipAddress: userIp
        }
      });
      await transaction.save();

      // АТОМАРНО обновляем баланс пользователя
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $inc: { balance: balanceAmount },
          lastActivity: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      );
      
      if (!updatedUser) {
        throw new Error('Не удалось обновить баланс пользователя');
      }
      
      user.balance = updatedUser.balance;

      // Обновляем финансовую статистику казино через новый сервис
      await casinoFinanceService.updateAfterPromocode({
        type: 'balance',
        value: balanceAmount,
        _id: promocode._id,
        activatedBy: user._id
      });

      reward = {
        type: 'balance',
        amount: balanceAmount,
        currency: 'USDT'
      };
      break;

    case 'freespins':
      const freespinsCount = promocode.settings.freespinsCount || promocode.value;
      const game = promocode.settings.freespinsGame || 'slots';
      
      // Создаем запись о фриспинах
      transaction = new Transaction({
        user: user._id,
        type: 'promocode_freespins',
        amount: 0,
        status: 'completed',
        description: `${freespinsCount} фриспинов в ${game} от промокода ${promocode.code}`,
        metadata: {
          promocodeId: promocode._id,
          promocodeCode: promocode.code,
          freespinsCount: freespinsCount,
          game: game,
          ipAddress: userIp
        }
      });
      await transaction.save();

      // Добавляем фриспины пользователю
      if (!user.freespins) user.freespins = {};
      if (!user.freespins[game]) user.freespins[game] = 0;
      user.freespins[game] += freespinsCount;
      await user.save();

      reward = {
        type: 'freespins',
        count: freespinsCount,
        game: game
      };
      break;

    case 'deposit':
      // Промокод на процент от депозита активируется при следующем депозите
      transaction = new Transaction({
        user: user._id,
        type: 'promocode_deposit_pending',
        amount: 0,
        status: 'pending',
        description: `Бонус к депозиту ${promocode.value}% от промокода ${promocode.code}`,
        metadata: {
          promocodeId: promocode._id,
          promocodeCode: promocode.code,
          depositPercentage: promocode.settings.depositPercentage || promocode.value,
          maxDepositBonus: promocode.settings.maxDepositBonus,
          ipAddress: userIp
        }
      });
      await transaction.save();

      // Добавляем активный бонус к депозиту
      if (!user.activeDepositBonuses) user.activeDepositBonuses = [];
      user.activeDepositBonuses.push({
        promocodeId: promocode._id,
        percentage: promocode.settings.depositPercentage || promocode.value,
        maxBonus: promocode.settings.maxDepositBonus,
        transactionId: transaction._id
      });
      await user.save();

      reward = {
        type: 'deposit_bonus',
        percentage: promocode.settings.depositPercentage || promocode.value,
        maxBonus: promocode.settings.maxDepositBonus
      };
      break;

    case 'vip':
      const vipDays = promocode.settings.vipDays || promocode.value;
      
      transaction = new Transaction({
        user: user._id,
        type: 'promocode_vip',
        amount: 0,
        status: 'completed',
        description: `VIP статус на ${vipDays} дней от промокода ${promocode.code}`,
        metadata: {
          promocodeId: promocode._id,
          promocodeCode: promocode.code,
          vipDays: vipDays,
          ipAddress: userIp
        }
      });
      await transaction.save();

      // Продлеваем VIP статус
      const vipExtension = vipDays * 24 * 60 * 60 * 1000; // в миллисекундах
      if (user.vipExpiresAt && user.vipExpiresAt > new Date()) {
        // Продлеваем существующий VIP
        user.vipExpiresAt = new Date(user.vipExpiresAt.getTime() + vipExtension);
      } else {
        // Устанавливаем новый VIP
        user.vipExpiresAt = new Date(Date.now() + vipExtension);
      }
      user.isVip = true;
      await user.save();

      reward = {
        type: 'vip',
        days: vipDays,
        expiresAt: user.vipExpiresAt
      };
      break;
  }

  return { reward, transaction };
}

/**
 * Рассчитать предварительную награду
 */
function calculateRewardPreview(promocode, user) {
  switch (promocode.type) {
    case 'balance':
      return {
        type: 'balance',
        amount: promocode.settings.balanceAmount || promocode.value,
        currency: 'USDT'
      };
    case 'freespins':
      return {
        type: 'freespins',
        count: promocode.settings.freespinsCount || promocode.value,
        game: promocode.settings.freespinsGame || 'slots'
      };
    case 'deposit':
      return {
        type: 'deposit_bonus',
        percentage: promocode.settings.depositPercentage || promocode.value,
        maxBonus: promocode.settings.maxDepositBonus
      };
    case 'vip':
      return {
        type: 'vip',
        days: promocode.settings.vipDays || promocode.value
      };
    default:
      return null;
  }
}

/**
 * Получить публичную информацию о награде
 */
function getPublicRewardInfo(promocode) {
  switch (promocode.type) {
    case 'balance':
      return `Бонус ${promocode.settings.balanceAmount || promocode.value} USDT`;
    case 'freespins':
      return `${promocode.settings.freespinsCount || promocode.value} фриспинов`;
    case 'deposit':
      return `Бонус ${promocode.settings.depositPercentage || promocode.value}% к депозиту`;
    case 'vip':
      return `VIP статус на ${promocode.settings.vipDays || promocode.value} дней`;
    default:
      return 'Бонус';
  }
}

/**
 * Обновить финансовую статистику казино
 */
async function updateCasinoFinance(type, amount) {
  try {
    let casinoFinance = await CasinoFinance.findOne().sort({ createdAt: -1 });
    
    if (!casinoFinance) {
      casinoFinance = new CasinoFinance({
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0
      });
    }

    switch (type) {
      case 'promocode_expense':
        casinoFinance.totalExpenses += amount;
        casinoFinance.totalBalance -= amount;
        break;
    }

    await casinoFinance.save();
  } catch (error) {
    console.error('Ошибка обновления финансовой статистики:', error);
  }
}

// Экспорт уже выполнен через exports.functionName выше