// backend/src/services/referral.service.js
const { User, ReferralEarning, ReferralPayout, Transaction, PartnerLog } = require('../models');
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
    
    // НОВОЕ: Партнерские уровни (назначаются только админом)
    this.partnerLevels = {
      partner_bronze: {
        name: 'Партнер Бронза',
        commissionPercent: 20,
        color: '🥉',
        adminOnly: true
      },
      partner_silver: {
        name: 'Партнер Серебро', 
        commissionPercent: 30,
        color: '🥈',
        adminOnly: true
      },
      partner_gold: {
        name: 'Партнер Золото',
        commissionPercent: 40,
        color: '🥇',
        adminOnly: true
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
      // Получаем количество игр пользователя из модели User (уже обновлено)
      const userTotalGames = user.totalGames || 0;
      
      if (userTotalGames < 2) { // Снижаем порог до 2 игр для начисления комиссии
        console.warn(`REFERRAL SECURITY: Пользователь ${user._id} недостаточно активен для реферальной комиссии (игр: ${userTotalGames})`);
        await session.abortTransaction();
        return null;
      }
      
      // Обновляем статистику партнера
      await this.updatePartnerLevel(partner._id, session);
      
      // Получаем актуальную информацию о партнере
      const updatedPartner = await User.findById(partner._id).session(session);
      
      // Определяем процент комиссии с учетом партнерского статуса
      let commissionPercent;
      if (updatedPartner.partnerLevel && updatedPartner.partnerLevel !== 'none' && this.partnerLevels[updatedPartner.partnerLevel]) {
        // Используем партнерский уровень если он назначен
        commissionPercent = this.partnerLevels[updatedPartner.partnerLevel].commissionPercent;
      } else {
        // Иначе используем автоматический реферальный уровень
        commissionPercent = updatedPartner.referralStats.commissionPercent;
      }
      
      // Рассчитываем комиссию с ПРОИГРЫША реферала
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
      
      // НОВАЯ ЛОГИКА: Проверяем партнерский статус
      let finalCommissionPercent;
      
      // Если у пользователя есть партнерский статус - он имеет приоритет
      if (partner.partnerLevel && partner.partnerLevel !== 'none' && this.partnerLevels[partner.partnerLevel]) {
        finalCommissionPercent = this.partnerLevels[partner.partnerLevel].commissionPercent;
        console.log(`REFERRAL: Партнер ${partnerId} использует партнерский статус ${partner.partnerLevel} (${finalCommissionPercent}%)`);
      } else {
        // Иначе используем автоматический уровень по количеству рефералов
        let newLevel = 'bronze';
        let newCommissionPercent = 5;
        
        for (const [level, config] of Object.entries(this.levels).reverse()) {
          if (activeReferralsCount >= config.requiredActiveReferrals) {
            newLevel = level;
            newCommissionPercent = config.commissionPercent;
            break;
          }
        }
        
        // Обновляем автоматический уровень если он изменился
        if (partner.referralStats.level !== newLevel) {
          console.log(`REFERRAL: Партнер ${partnerId} повышен до автоматического уровня ${newLevel}`);
          partner.referralStats.level = newLevel;
          partner.referralStats.levelUpdatedAt = new Date();
        }
        
        finalCommissionPercent = newCommissionPercent;
      }
      
      // Устанавливаем итоговый процент комиссии
      partner.referralStats.commissionPercent = finalCommissionPercent;
      
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
      
      // Определяем активный уровень и комиссию
      let activeLevel, activeLevelInfo, activeCommissionPercent;
      
      if (updatedPartner.partnerLevel && updatedPartner.partnerLevel !== 'none' && this.partnerLevels[updatedPartner.partnerLevel]) {
        // Используем партнерский уровень
        activeLevel = updatedPartner.partnerLevel;
        activeLevelInfo = this.partnerLevels[updatedPartner.partnerLevel];
        activeCommissionPercent = this.partnerLevels[updatedPartner.partnerLevel].commissionPercent;
      } else {
        // Используем автоматический реферальный уровень
        activeLevel = updatedPartner.referralStats.level;
        activeLevelInfo = this.levels[updatedPartner.referralStats.level];
        activeCommissionPercent = updatedPartner.referralStats.commissionPercent;
      }
      
      // Базовая статистика
      const stats = {
        level: activeLevel,
        levelInfo: activeLevelInfo,
        commissionPercent: activeCommissionPercent,
        partnerLevel: updatedPartner.partnerLevel,
        autoLevel: updatedPartner.referralStats.level,
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
      
      // Прогресс до следующего уровня (только для автоматических уровней)
      if (updatedPartner.partnerLevel && updatedPartner.partnerLevel !== 'none') {
        // Партнерский уровень - нет автоматического прогресса
        stats.nextLevel = null;
        stats.referralsToNextLevel = 0;
        stats.progressToNextLevel = 100;
        stats.isPartnerLevel = true;
      } else {
        // Автоматический уровень - показываем прогресс
        const currentLevelIndex = Object.keys(this.levels).indexOf(updatedPartner.referralStats.level);
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
        stats.isPartnerLevel = false;
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
          
          // Обновляем уровень партнера
          await this.updatePartnerLevel(partner._id, session);
          
          // Получаем актуальную информацию о партнере
          const updatedPartner = await User.findById(partner._id).session(session);
          
          // Определяем процент комиссии с учетом партнерского статуса
          let commissionPercent;
          if (updatedPartner.partnerLevel && updatedPartner.partnerLevel !== 'none' && this.partnerLevels[updatedPartner.partnerLevel]) {
            // Используем партнерский уровень если он назначен
            commissionPercent = this.partnerLevels[updatedPartner.partnerLevel].commissionPercent;
          } else {
            // Иначе используем автоматический реферальный уровень
            commissionPercent = updatedPartner.referralStats.commissionPercent;
          }
          
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
              level: updatedPartner.partnerLevel || updatedPartner.referralStats.level
            },
            status: 'credited'
          }], { session });
          
          // Начисляем баланс партнеру
          updatedPartner.balance = Math.round((updatedPartner.balance + referralAmount) * 100) / 100;
          updatedPartner.totalEarnings = Math.round((updatedPartner.totalEarnings + referralAmount) * 100) / 100;
          await updatedPartner.save({ session });
          
          // Создаем транзакцию
          await Transaction.create([{
            user: updatedPartner._id,
            type: 'referral_commission',
            amount: referralAmount,
            description: `Реферальная комиссия с дуэли ${gameId}`,
            balanceBefore: updatedPartner.balance - referralAmount,
            balanceAfter: updatedPartner.balance,
            relatedUser: user._id
          }], { session });
          
          await session.commitTransaction();
          
          results.push({
            partnerId: updatedPartner._id,
            partnerUsername: updatedPartner.username,
            userId: user._id,
            userUsername: user.username,
            earnedAmount: referralAmount,
            commissionPercent,
            level: updatedPartner.partnerLevel || updatedPartner.referralStats.level
          });
          
          console.log(`REFERRAL: Начислено ${referralAmount} USDT партнеру ${updatedPartner.username} (${commissionPercent}% с ${commission} USDT)`);
          
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

  /**
   * НОВОЕ: Назначает партнерский статус пользователю (только админ)
   * @param {string} userId - ID пользователя
   * @param {string} newLevel - Новый партнерский уровень
   * @param {string} adminId - ID админа
   * @param {string} reason - Причина изменения
   * @param {Object} metadata - Метаданные (IP, User-Agent)
   */
  async assignPartnerLevel(userId, newLevel, adminId, reason = '', metadata = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Проверяем валидность нового уровня
      const validLevels = ['none', 'partner_bronze', 'partner_silver', 'partner_gold'];
      if (!validLevels.includes(newLevel)) {
        throw new Error(`Недопустимый партнерский уровень: ${newLevel}`);
      }
      
      // Получаем пользователя и админа
      const user = await User.findById(userId).session(session);
      const admin = await User.findById(adminId).session(session);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (!admin) {
        throw new Error('Админ не найден');
      }
      
      // Проверяем права админа (можно добавить проверку роли)
      // if (!admin.isAdmin) {
      //   throw new Error('Недостаточно прав для назначения партнерского статуса');
      // }
      
      const previousLevel = user.partnerLevel || 'none';
      
      // Если уровень не изменился
      if (previousLevel === newLevel) {
        throw new Error('Новый уровень совпадает с текущим');
      }
      
      // Определяем тип действия
      let action;
      if (previousLevel === 'none' && newLevel !== 'none') {
        action = 'assign';
      } else if (previousLevel !== 'none' && newLevel === 'none') {
        action = 'remove';
      } else {
        action = 'change';
      }
      
      // Обновляем партнерский статус пользователя
      user.partnerLevel = newLevel;
      user.partnerMeta = {
        assignedBy: adminId,
        assignedAt: new Date(),
        previousLevel: previousLevel
      };
      
      await user.save({ session });
      
      // Создаем лог изменения
      const partnerLog = new PartnerLog({
        user: userId,
        admin: adminId,
        action: action,
        previousLevel: previousLevel,
        newLevel: newLevel,
        reason: reason,
        metadata: {
          ...metadata,
          timestamp: new Date()
        }
      });
      
      await partnerLog.save({ session });
      
      // Обновляем уровень партнера (пересчитываем комиссию)
      await this.updatePartnerLevel(userId, session);
      
      await session.commitTransaction();
      
      console.log(`REFERRAL: Партнерский статус изменен для ${user.username}: ${previousLevel} → ${newLevel} (админ: ${admin.username})`);
      
      return {
        success: true,
        user: {
          id: user._id,
          username: user.username,
          previousLevel: previousLevel,
          newLevel: newLevel,
          commissionPercent: user.referralStats.commissionPercent
        },
        admin: {
          id: admin._id,
          username: admin.username
        },
        action: action,
        reason: reason
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('REFERRAL: Ошибка назначения партнерского статуса:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * НОВОЕ: Получает историю изменений партнерских статусов
   * @param {string} userId - ID пользователя (опционально)
   * @param {Object} options - Опции фильтрации
   */
  async getPartnerLogs(userId = null, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        action = null,
        adminId = null,
        startDate = null,
        endDate = null
      } = options;
      
      // Строим фильтр
      const filter = {};
      
      if (userId) {
        filter.user = userId;
      }
      
      if (action) {
        filter.action = action;
      }
      
      if (adminId) {
        filter.admin = adminId;
      }
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      // Получаем логи с populate
      const logs = await PartnerLog.find(filter)
        .populate('user', 'username telegramId')
        .populate('admin', 'username telegramId')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);
      
      const total = await PartnerLog.countDocuments(filter);
      
      return {
        logs: logs,
        pagination: {
          total: total,
          limit: limit,
          offset: offset,
          hasMore: offset + limit < total
        }
      };
      
    } catch (error) {
      console.error('REFERRAL: Ошибка получения логов партнеров:', error);
      throw error;
    }
  }

  /**
   * НОВОЕ: Получает список всех партнеров
   * @param {Object} options - Опции фильтрации
   */
  async getAllPartners(options = {}) {
    try {
      const {
        level = null,
        limit = 100,
        offset = 0,
        sortBy = 'assignedAt',
        sortOrder = 'desc'
      } = options;
      
      // Строим фильтр
      const filter = {
        partnerLevel: { $ne: 'none' }
      };
      
      if (level && level !== 'all') {
        filter.partnerLevel = level;
      }
      
      // Строим сортировку
      const sort = {};
      sort[`partnerMeta.${sortBy}`] = sortOrder === 'desc' ? -1 : 1;
      
      // Получаем партнеров
      const partners = await User.find(filter)
        .populate('partnerMeta.assignedBy', 'username telegramId')
        .select('username telegramId partnerLevel partnerMeta referralStats')
        .sort(sort)
        .limit(limit)
        .skip(offset);
      
      const total = await User.countDocuments(filter);
      
      // Группируем по уровням
      const summary = await User.aggregate([
        { $match: { partnerLevel: { $ne: 'none' } } },
        {
          $group: {
            _id: '$partnerLevel',
            count: { $sum: 1 },
            totalEarned: { $sum: '$referralStats.totalEarned' },
            totalReferrals: { $sum: '$referralStats.totalReferrals' }
          }
        }
      ]);
      
      return {
        partners: partners,
        summary: summary,
        pagination: {
          total: total,
          limit: limit,
          offset: offset,
          hasMore: offset + limit < total
        }
      };
      
    } catch (error) {
      console.error('REFERRAL: Ошибка получения списка партнеров:', error);
      throw error;
    }
  }
}

module.exports = new ReferralService();