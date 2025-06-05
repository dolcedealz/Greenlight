// backend/src/services/referral.service.js
const { User, ReferralEarning, ReferralPayout, Transaction } = require('../models');
const mongoose = require('mongoose');

class ReferralService {
  constructor() {
    // Конфигурация уровней партнерской программы
    this.levels = {
      bronze: {
        name: 'Бронза',
        requiredActiveReferrals: 0,
        commissionPercent: 5, // Восстановлено до заявленного 5%
        color: '🥉'
      },
      silver: {
        name: 'Серебро',
        requiredActiveReferrals: 6,
        commissionPercent: 7, // Восстановлено до заявленного 7%
        color: '🥈'
      },
      gold: {
        name: 'Золото',
        requiredActiveReferrals: 21,
        commissionPercent: 10, // Восстановлено до заявленного 10%
        color: '🥇'
      },
      platinum: {
        name: 'Платина',
        requiredActiveReferrals: 51,
        commissionPercent: 12, // Восстановлено до заявленного 12%
        color: '💎'
      },
      vip: {
        name: 'VIP',
        requiredActiveReferrals: 101,
        commissionPercent: 15, // Восстановлено до заявленного 15%
        color: '🌟'
      }
    };
  }

  /**
   * Обрабатывает проигрыш в игре и начисляет комиссию партнеру
   * @param {Object} gameData - Данные игры
   * @returns {Object|null} - Данные о начислении или null
   */
  async processGameLoss(gameData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { userId, gameId, gameType, bet, profit } = gameData;
      
      // Находим пользователя
      const user = await User.findById(userId).session(session);
      if (!user || !user.referrer) {
        // У пользователя нет реферера
        await session.abortTransaction();
        return null;
      }
      
      // Находим партнера (реферера)
      const partner = await User.findById(user.referrer).session(session);
      if (!partner) {
        await session.abortTransaction();
        return null;
      }
      
      // БЕЗОПАСНОСТЬ: Анти-фрод проверки
      // 1. Проверяем что реферер не заблокирован
      if (partner.isBlocked) {
        console.warn(`REFERRAL SECURITY: Партнер ${partner._id} заблокирован, комиссия не начисляется`);
        await session.abortTransaction();
        return null;
      }
      
      // 2. Проверяем что реферал не тот же пользователь (самореферал)
      if (user._id.equals(partner._id)) {
        console.warn(`REFERRAL SECURITY: Попытка самореферала пользователем ${user._id}`);
        await session.abortTransaction();
        return null;
      }
      
      // 3. Проверяем что игрок ПРОИГРАЛ (нет комиссии с выигрышей)
      if (profit >= 0) {
        // Игрок выиграл или сыграл в ноль - комиссии нет
        await session.abortTransaction();
        return null;
      }
      
      // 4. Проверяем минимальную ставку для предотвращения спама
      if (bet < 0.1) {
        console.warn(`REFERRAL SECURITY: Ставка слишком мала для реферальной комиссии: ${bet}`);
        await session.abortTransaction();
        return null;
      }
      
      // 4. Проверяем что пользователь достаточно активен (защита от ботов)
      const userGameCount = await User.aggregate([
        { $match: { _id: user._id } },
        { $lookup: { from: 'games', localField: '_id', foreignField: 'user', as: 'games' } },
        { $project: { gameCount: { $size: '$games' } } }
      ]).session(session);
      
      if (userGameCount[0]?.gameCount < 3) {
        console.warn(`REFERRAL SECURITY: Пользователь ${user._id} недостаточно активен для реферальной комиссии (игр: ${userGameCount[0]?.gameCount || 0})`);
        await session.abortTransaction();
        return null;
      }
      
      // Обновляем статистику партнера
      await this.updatePartnerLevel(partner._id, session);
      
      // Получаем актуальную информацию о партнере
      const updatedPartner = await User.findById(partner._id).session(session);
      
      // Рассчитываем комиссию с ПРОИГРЫША реферала
      const commissionPercent = updatedPartner.referralStats.commissionPercent;
      const lossAmount = Math.abs(profit); // Размер проигрыша
      const earnedAmount = lossAmount * (commissionPercent / 100);
      
      // Создаем запись о начислении
      const earning = new ReferralEarning({
        partner: partner._id,
        referral: user._id,
        game: gameId,
        type: 'game_loss',
        calculation: {
          baseAmount: lossAmount, // Сумма проигрыша реферала
          partnerLevel: updatedPartner.referralStats.level,
          commissionPercent: commissionPercent,
          earnedAmount: earnedAmount
        },
        status: 'credited',
        balanceBefore: updatedPartner.referralStats.referralBalance,
        balanceAfter: updatedPartner.referralStats.referralBalance + earnedAmount,
        metadata: {
          gameType: gameType
        },
        creditedAt: new Date()
      });
      
      await earning.save({ session });
      
      // Обновляем баланс партнера
      updatedPartner.referralStats.referralBalance += earnedAmount;
      updatedPartner.referralStats.totalEarned += earnedAmount;
      await updatedPartner.save({ session });
      
      await session.commitTransaction();
      
      console.log(`REFERRAL: Начислено ${earnedAmount.toFixed(2)} USDT партнеру ${partner._id} от проигрыша реферала ${user._id}`);
      
      return {
        partnerId: partner._id,
        referralId: user._id,
        earnedAmount,
        commissionPercent,
        level: updatedPartner.referralStats.level
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('REFERRAL: Ошибка обработки проигрыша:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обрабатывает первый депозит реферала и начисляет бонус партнеру
   * @param {string} userId - ID пользователя, сделавшего депозит
   * @param {number} depositAmount - Сумма депозита
   * @returns {Object|null} - Данные о начислении или null
   */
  async processFirstDeposit(userId, depositAmount) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      if (!user || !user.referrer) {
        await session.abortTransaction();
        return null;
      }
      
      // Проверяем, не был ли уже начислен бонус за первый депозит
      const existingBonus = await ReferralEarning.findOne({
        referral: userId,
        type: 'registration_bonus'
      }).session(session);
      
      if (existingBonus) {
        // Бонус уже был начислен
        await session.abortTransaction();
        return null;
      }
      
      const partner = await User.findById(user.referrer).session(session);
      if (!partner) {
        await session.abortTransaction();
        return null;
      }
      
      // Фиксированный бонус за первый депозит реферала
      const bonusAmount = 1; // 1 USDT
      
      // Создаем запись о начислении
      const earning = new ReferralEarning({
        partner: partner._id,
        referral: user._id,
        game: null, // Это не игра, а бонус
        type: 'registration_bonus',
        calculation: {
          baseAmount: depositAmount,
          partnerLevel: partner.referralStats.level,
          commissionPercent: 0, // Фиксированный бонус
          earnedAmount: bonusAmount
        },
        status: 'credited',
        balanceBefore: partner.referralStats.referralBalance,
        balanceAfter: partner.referralStats.referralBalance + bonusAmount,
        metadata: {
          notes: `Бонус за первый депозит реферала ${depositAmount} USDT`
        },
        creditedAt: new Date()
      });
      
      await earning.save({ session });
      
      // Обновляем баланс партнера
      partner.referralStats.referralBalance += bonusAmount;
      partner.referralStats.totalEarned += bonusAmount;
      await partner.save({ session });
      
      await session.commitTransaction();
      
      console.log(`REFERRAL: Начислен бонус ${bonusAmount} USDT партнеру ${partner._id} за первый депозит реферала ${user._id}`);
      
      return {
        partnerId: partner._id,
        referralId: user._id,
        earnedAmount: bonusAmount
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('REFERRAL: Ошибка обработки первого депозита:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Обновляет уровень партнера на основе количества активных рефералов
   * @param {string} partnerId - ID партнера
   * @param {Object} session - MongoDB сессия
   * @returns {Object} - Обновленный партнер
   */
  async updatePartnerLevel(partnerId, session = null) {
    try {
      const partner = await User.findById(partnerId).session(session);
      if (!partner) {
        throw new Error('Партнер не найден');
      }
      
      // Считаем активных рефералов
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeReferralsCount = await User.countDocuments({
        referrer: partnerId,
        lastActivity: { $gte: thirtyDaysAgo },
        totalWagered: { $gt: 0 }
      }).session(session);
      
      // Обновляем статистику
      partner.referralStats.activeReferrals = activeReferralsCount;
      partner.referralStats.totalReferrals = await User.countDocuments({ 
        referrer: partnerId 
      }).session(session);
      
      // Определяем новый уровень
      let newLevel = 'bronze';
      let newCommissionPercent = 5;
      
      for (const [level, config] of Object.entries(this.levels).reverse()) {
        if (activeReferralsCount >= config.requiredActiveReferrals) {
          newLevel = level;
          newCommissionPercent = config.commissionPercent;
          break;
        }
      }
      
      // Обновляем уровень если он изменился
      if (partner.referralStats.level !== newLevel) {
        console.log(`REFERRAL: Партнер ${partnerId} повышен до уровня ${newLevel}`);
        partner.referralStats.level = newLevel;
        partner.referralStats.commissionPercent = newCommissionPercent;
        partner.referralStats.levelUpdatedAt = new Date();
      }
      
      await partner.save({ session });
      return partner;
      
    } catch (error) {
      console.error('REFERRAL: Ошибка обновления уровня партнера:', error);
      throw error;
    }
  }

  /**
   * Получает статистику партнера
   * @param {string} partnerId - ID партнера
   * @param {Date} periodStart - Начало периода (опционально)
   * @returns {Object} - Статистика партнера
   */
  async getPartnerStatistics(partnerId, periodStart = null) {
    try {
      const partner = await User.findById(partnerId);
      if (!partner) {
        throw new Error('Партнер не найден');
      }
      
      // Обновляем уровень
      await this.updatePartnerLevel(partnerId);
      
      // Получаем обновленные данные
      const updatedPartner = await User.findById(partnerId);
      
      // Базовая статистика
      const stats = {
        level: updatedPartner.referralStats.level,
        levelInfo: this.levels[updatedPartner.referralStats.level],
        commissionPercent: updatedPartner.referralStats.commissionPercent,
        referralBalance: updatedPartner.referralStats.referralBalance,
        totalEarned: updatedPartner.referralStats.totalEarned,
        totalWithdrawn: updatedPartner.referralStats.totalWithdrawn,
        totalReferrals: updatedPartner.referralStats.totalReferrals,
        activeReferrals: updatedPartner.referralStats.activeReferrals,
        referralsWithDeposits: await User.countDocuments({
          referrer: partnerId,
          totalWagered: { $gt: 0 }
        })
      };
      
      // Статистика за период
      if (periodStart) {
        const earningsStats = await ReferralEarning.aggregate([
          {
            $match: {
              partner: partnerId,
              status: 'credited',
              createdAt: { $gte: periodStart }
            }
          },
          {
            $group: {
              _id: null,
              periodEarned: { $sum: '$calculation.earnedAmount' },
              periodTransactions: { $sum: 1 }
            }
          }
        ]);
        
        stats.periodEarned = earningsStats[0]?.periodEarned || 0;
        stats.periodTransactions = earningsStats[0]?.periodTransactions || 0;
      }
      
      // Прогресс до следующего уровня
      const currentLevelIndex = Object.keys(this.levels).indexOf(stats.level);
      const levelKeys = Object.keys(this.levels);
      
      if (currentLevelIndex < levelKeys.length - 1) {
        const nextLevel = levelKeys[currentLevelIndex + 1];
        const nextLevelConfig = this.levels[nextLevel];
        stats.nextLevel = nextLevel;
        stats.referralsToNextLevel = Math.max(0, 
          nextLevelConfig.requiredActiveReferrals - stats.activeReferrals
        );
        stats.progressToNextLevel = (stats.activeReferrals / nextLevelConfig.requiredActiveReferrals) * 100;
      } else {
        stats.nextLevel = null;
        stats.referralsToNextLevel = 0;
        stats.progressToNextLevel = 100;
      }
      
      return {
        partner: {
          id: updatedPartner._id,
          telegramId: updatedPartner.telegramId,
          username: updatedPartner.username,
          name: `${updatedPartner.firstName} ${updatedPartner.lastName}`.trim(),
          referralCode: updatedPartner.referralCode,
          level: stats.level,
          levelInfo: stats.levelInfo,
          progress: {
            current: stats.activeReferrals,
            needed: stats.referralsToNextLevel,
            nextLevel: stats.nextLevel,
            progress: stats.progressToNextLevel
          }
        },
        stats
      };
      
    } catch (error) {
      console.error('REFERRAL: Ошибка получения статистики партнера:', error);
      throw error;
    }
  }

  /**
   * Создает выплату реферального баланса на основной счет
   * @param {string} partnerId - ID партнера
   * @param {number} amount - Сумма (если не указана, выплачивается весь баланс)
   * @returns {Object} - Данные о выплате
   */
  async createReferralPayout(partnerId, amount = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const partner = await User.findById(partnerId).session(session);
      if (!partner) {
        throw new Error('Партнер не найден');
      }
      
      const referralBalance = partner.referralStats.referralBalance;
      
      // Определяем сумму выплаты
      const payoutAmount = amount || referralBalance;
      
      // Проверки
      if (payoutAmount <= 0) {
        throw new Error('Некорректная сумма для выплаты');
      }
      
      if (payoutAmount > referralBalance) {
        throw new Error('Недостаточно средств на реферальном балансе');
      }
      
      if (payoutAmount < 10) {
        throw new Error('Минимальная сумма для вывода: 10 USDT');
      }
      
      // Создаем запись о выплате
      const payout = new ReferralPayout({
        partner: partnerId,
        amount: payoutAmount,
        status: 'completed', // Сразу завершаем, так как это перевод между балансами
        type: 'manual',
        earningsCount: await ReferralEarning.countDocuments({
          partner: partnerId,
          status: 'credited'
        }),
        referralBalanceBefore: referralBalance,
        referralBalanceAfter: referralBalance - payoutAmount,
        operationalBalanceBefore: partner.balance,
        operationalBalanceAfter: partner.balance + payoutAmount,
        processing: {
          method: 'balance_transfer',
          approvedAt: new Date()
        },
        processedAt: new Date(),
        completedAt: new Date()
      });
      
      await payout.save({ session });
      
      // Обновляем балансы партнера
      partner.referralStats.referralBalance -= payoutAmount;
      partner.referralStats.totalWithdrawn += payoutAmount;
      partner.referralStats.lastPayoutAt = new Date();
      partner.balance += payoutAmount;
      
      await partner.save({ session });
      
      // Создаем транзакцию для учета
      const transaction = new Transaction({
        user: partnerId,
        type: 'referral',
        amount: payoutAmount,
        status: 'completed',
        description: `Вывод реферального баланса: ${payoutAmount} USDT`,
        balanceBefore: partner.balance - payoutAmount,
        balanceAfter: partner.balance
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      console.log(`REFERRAL: Выплата ${payoutAmount} USDT партнеру ${partnerId} завершена`);
      
      return payout;
      
    } catch (error) {
      await session.abortTransaction();
      console.error('REFERRAL: Ошибка создания выплаты:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Получает системную статистику реферальной программы
   * @param {Date} periodStart - Начало периода (опционально)
   * @returns {Object} - Системная статистика
   */
  async getSystemStatistics(periodStart = null) {
    try {
      // Общая статистика по партнерам
      const partnersStats = await User.aggregate([
        {
          $match: {
            'referralStats.totalEarned': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$referralStats.level',
            count: { $sum: 1 },
            totalEarned: { $sum: '$referralStats.totalEarned' },
            totalBalance: { $sum: '$referralStats.referralBalance' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Статистика по рефералам
      const referralsStats = await User.aggregate([
        {
          $match: { referrer: { $exists: true } }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'referrer',
            foreignField: '_id',
            as: 'partnerInfo'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withDeposits: { 
              $sum: { $cond: [{ $gt: ['$totalWagered', 0] }, 1, 0] }
            },
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$lastActivity', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                      { $gt: ['$totalWagered', 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      
      // Статистика по выплатам
      const payoutsStats = await ReferralPayout.getPayoutStats(null, periodStart);
      
      // Статистика по начислениям за период
      let earningsStats = [];
      if (periodStart) {
        earningsStats = await ReferralEarning.aggregate([
          {
            $match: {
              status: 'credited',
              createdAt: { $gte: periodStart }
            }
          },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              totalAmount: { $sum: '$calculation.earnedAmount' }
            }
          }
        ]);
      }
      
      // Финансовое влияние на казино
      const totalReferralPayments = partnersStats.reduce((sum, level) => sum + level.totalEarned, 0);
      const totalReferralBalance = partnersStats.reduce((sum, level) => sum + level.totalBalance, 0);
      
      return {
        partners: {
          total: partnersStats.reduce((sum, level) => sum + level.count, 0),
          byLevel: partnersStats,
          totalBalance: totalReferralBalance
        },
        referrals: {
          total: referralsStats[0]?.total || 0,
          withDeposits: referralsStats[0]?.withDeposits || 0,
          active: referralsStats[0]?.active || 0,
          conversionRate: referralsStats[0]?.total > 0 
            ? ((referralsStats[0]?.active / referralsStats[0]?.total) * 100).toFixed(2)
            : 0
        },
        payouts: {
          totalPaid: payoutsStats[0]?.totalPaid || 0,
          payoutsCount: payoutsStats[0]?.payoutsCount || 0,
          avgPayout: payoutsStats[0]?.avgPayout || 0
        },
        earnings: earningsStats,
        finance: {
          totalReferralPayments,
          pendingPayouts: totalReferralBalance,
          impactPercent: 0 // Будет рассчитан относительно общей прибыли казино
        }
      };
      
    } catch (error) {
      console.error('REFERRAL: Ошибка получения системной статистики:', error);
      throw error;
    }
  }

  /**
   * Обнаруживает подозрительную активность в реферальной системе
   * @returns {Array} - Массив подозрительных паттернов
   */
  async detectFraudulentActivity() {
    try {
      const suspiciousPatterns = [];
      
      // 1. Партнеры с аномально высоким процентом неактивных рефералов
      const partnersWithInactiveReferrals = await User.aggregate([
        {
          $match: {
            'referralStats.totalReferrals': { $gt: 5 }
          }
        },
        {
          $project: {
            telegramId: 1,
            username: 1,
            totalReferrals: '$referralStats.totalReferrals',
            activeReferrals: '$referralStats.activeReferrals',
            inactivePercent: {
              $multiply: [
                { $divide: [
                  { $subtract: ['$referralStats.totalReferrals', '$referralStats.activeReferrals'] },
                  '$referralStats.totalReferrals'
                ]},
                100
              ]
            }
          }
        },
        {
          $match: {
            inactivePercent: { $gt: 80 } // Более 80% неактивных
          }
        },
        { $sort: { inactivePercent: -1 } }
      ]);
      
      if (partnersWithInactiveReferrals.length > 0) {
        suspiciousPatterns.push({
          type: 'high_inactive_rate',
          severity: 'medium',
          message: 'Партнеры с высоким процентом неактивных рефералов',
          data: partnersWithInactiveReferrals
        });
      }
      
      // 2. Массовые регистрации за короткий период
      const bulkRegistrations = await User.aggregate([
        {
          $match: {
            referrer: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              referrer: '$referrer',
              hour: {
                $dateToString: {
                  format: '%Y-%m-%d %H:00',
                  date: '$createdAt'
                }
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 10 } // Более 10 регистраций за час
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id.referrer',
            foreignField: '_id',
            as: 'partnerInfo'
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      if (bulkRegistrations.length > 0) {
        suspiciousPatterns.push({
          type: 'bulk_registrations',
          severity: 'high',
          message: 'Массовые регистрации за короткий период',
          data: bulkRegistrations
        });
      }
      
      // 3. Рефералы с депозитами, но без игровой активности
      const depositsWithoutGames = await User.aggregate([
        {
          $match: {
            referrer: { $exists: true },
            totalWagered: { $gt: 0 }
          }
        },
        {
          $lookup: {
            from: 'games',
            localField: '_id',
            foreignField: 'user',
            as: 'games'
          }
        },
        {
          $match: {
            'games.0': { $exists: false } // Нет игр
          }
        },
        {
          $group: {
            _id: '$referrer',
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 3 } // Более 3 таких рефералов
          }
        }
      ]);
      
      if (depositsWithoutGames.length > 0) {
        suspiciousPatterns.push({
          type: 'deposits_without_games',
          severity: 'high',
          message: 'Рефералы с депозитами, но без игр',
          data: depositsWithoutGames
        });
      }
      
      return suspiciousPatterns;
      
    } catch (error) {
      console.error('REFERRAL: Ошибка обнаружения мошенничества:', error);
      throw error;
    }
  }

  /**
   * Обрабатывает реферальные начисления с комиссии казино (для дуэлей)
   * Начисляет комиссию только рефереру проигравшего игрока
   * @param {Object} commissionData - Данные о комиссии
   * @returns {Array} - Массив начислений или пустой массив
   */
  async processCommission(commissionData) {
    try {
      const { winnerId, loserId, commission, gameType, gameId } = commissionData;
      const results = [];
      
      console.log(`REFERRAL: Обработка комиссии ${commission} USDT для дуэли ${gameId} (только проигравший)`);
      
      // Обрабатываем реферальную комиссию только для проигравшего игрока
      const playerIds = [loserId].filter(Boolean);
      
      for (const playerId of playerIds) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
          // Находим пользователя
          const user = await User.findOne({ telegramId: playerId }).session(session);
          if (!user || !user.referrer) {
            console.log(`REFERRAL: Пользователь ${playerId} не имеет реферера`);
            await session.abortTransaction();
            continue;
          }
          
          // Находим партнера (реферера)
          const partner = await User.findById(user.referrer).session(session);
          if (!partner) {
            console.log(`REFERRAL: Реферер пользователя ${playerId} не найден`);
            await session.abortTransaction();
            continue;
          }
          
          // БЕЗОПАСНОСТЬ: Проверки
          if (partner.isBlocked) {
            console.warn(`REFERRAL: Партнер ${partner._id} заблокирован`);
            await session.abortTransaction();
            continue;
          }
          
          if (user._id.equals(partner._id)) {
            console.warn(`REFERRAL: Попытка самореферала пользователем ${user._id}`);
            await session.abortTransaction();
            continue;
          }
          
          // Определяем уровень партнера и комиссию
          const partnerLevel = this.getPartnerLevel(partner.level);
          const commissionPercent = partnerLevel.commissionPercent;
          
          // Вычисляем реферальное начисление с комиссии казино
          const referralAmount = Math.round(commission * (commissionPercent / 100) * 100) / 100;
          
          if (referralAmount < 0.01) {
            console.log(`REFERRAL: Сумма ${referralAmount} слишком мала для начисления`);
            await session.abortTransaction();
            continue;
          }
          
          // Создаем запись о начислении
          const earning = await ReferralEarning.create([{
            partner: partner._id,
            user: user._id,
            game: gameId,
            gameType,
            type: 'commission', // Новый тип для дуэлей
            calculation: {
              commissionAmount: commission,
              commissionPercent,
              earnedAmount: referralAmount,
              level: partnerLevel.name
            },
            status: 'credited'
          }], { session });
          
          // Начисляем баланс партнеру
          partner.balance = Math.round((partner.balance + referralAmount) * 100) / 100;
          partner.totalEarnings = Math.round((partner.totalEarnings + referralAmount) * 100) / 100;
          await partner.save({ session });
          
          // Создаем транзакцию
          await Transaction.create([{
            user: partner._id,
            type: 'referral_commission',
            amount: referralAmount,
            description: `Реферальная комиссия с дуэли ${gameId}`,
            balanceBefore: partner.balance - referralAmount,
            balanceAfter: partner.balance,
            relatedUser: user._id
          }], { session });
          
          // Обновляем уровень партнера
          await this.updatePartnerLevel(partner._id, session);
          
          await session.commitTransaction();
          
          results.push({
            partnerId: partner._id,
            partnerUsername: partner.username,
            userId: user._id,
            userUsername: user.username,
            earnedAmount: referralAmount,
            commissionPercent,
            level: partnerLevel.name
          });
          
          console.log(`REFERRAL: Начислено ${referralAmount} USDT партнеру ${partner.username} (${commissionPercent}% с ${commission} USDT)`);
          
        } catch (error) {
          await session.abortTransaction();
          console.error(`REFERRAL: Ошибка обработки реферальной комиссии для пользователя ${playerId}:`, error);
        } finally {
          session.endSession();
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('REFERRAL: Ошибка обработки комиссии:', error);
      throw error;
    }
  }
}

module.exports = new ReferralService();