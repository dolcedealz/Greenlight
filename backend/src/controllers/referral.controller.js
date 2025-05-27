// backend/src/controllers/referral.controller.js
const { referralService } = require('../services');

/**
 * Контроллер для управления реферальной системой
 */
class ReferralController {
  /**
   * Получить статистику партнера
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getPartnerStats(req, res) {
    try {
      const partnerId = req.params.partnerId || req.user._id;
      const { period } = req.query;
      
      let periodDate = null;
      if (period) {
        periodDate = new Date();
        switch (period) {
          case 'day':
            periodDate.setDate(periodDate.getDate() - 1);
            break;
          case 'week':
            periodDate.setDate(periodDate.getDate() - 7);
            break;
          case 'month':
            periodDate.setMonth(periodDate.getMonth() - 1);
            break;
        }
      }
      
      const statistics = await referralService.getPartnerStatistics(partnerId, periodDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения статистики партнера:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Создать выплату реферальных средств
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async createPayout(req, res) {
    try {
      const partnerId = req.user._id;
      const { amount } = req.body;
      
      const payout = await referralService.createReferralPayout(partnerId, amount);
      
      res.status(201).json({
        success: true,
        message: 'Реферальные средства переведены на основной баланс',
        data: {
          payoutId: payout._id,
          amount: payout.amount,
          newReferralBalance: payout.referralBalanceAfter,
          newMainBalance: req.user.balance + payout.amount
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка создания выплаты:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить историю начислений
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getEarningsHistory(req, res) {
    try {
      const partnerId = req.user._id;
      const { limit = 50, skip = 0, type } = req.query;
      
      const { ReferralEarning } = require('../models');
      
      const query = { partner: partnerId, status: 'credited' };
      if (type) {
        query.type = type;
      }
      
      const earnings = await ReferralEarning.find(query)
        .populate('referral', 'telegramId username firstName lastName')
        .populate('game', 'gameType bet profit')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip));
      
      const total = await ReferralEarning.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: {
          earnings,
          pagination: {
            total,
            currentPage: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit: Number(limit),
            skip: Number(skip)
          }
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения истории начислений:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить историю выплат
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getPayoutsHistory(req, res) {
    try {
      const partnerId = req.user._id;
      const { limit = 20, skip = 0 } = req.query;
      
      const { ReferralPayout } = require('../models');
      
      const payouts = await ReferralPayout.find({ partner: partnerId })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip));
      
      const total = await ReferralPayout.countDocuments({ partner: partnerId });
      
      res.status(200).json({
        success: true,
        data: {
          payouts,
          pagination: {
            total,
            currentPage: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit: Number(limit),
            skip: Number(skip)
          }
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения истории выплат:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить список рефералов
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getReferrals(req, res) {
    try {
      const partnerId = req.user._id;
      const { activeOnly = false, limit = 50, skip = 0 } = req.query;
      
      const { User } = require('../models');
      
      const query = { referrer: partnerId };
      
      if (activeOnly === 'true') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query.lastActivity = { $gte: thirtyDaysAgo };
        query.totalWagered = { $gt: 0 };
      }
      
      const referrals = await User.find(query)
        .select('telegramId username firstName lastName createdAt lastActivity totalWagered totalWon balance')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip));
      
      const total = await User.countDocuments(query);
      
      // Добавляем виртуальные поля
      const referralsWithStats = referrals.map(ref => ({
        ...ref.toObject(),
        isActive: ref.isActiveReferral,
        profitLoss: ref.profitLoss
      }));
      
      res.status(200).json({
        success: true,
        data: {
          referrals: referralsWithStats,
          pagination: {
            total,
            currentPage: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit: Number(limit),
            skip: Number(skip)
          }
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения списка рефералов:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // === АДМИНСКИЕ МЕТОДЫ ===
  
  /**
   * Получить общую статистику реферальной системы (админ)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getSystemStats(req, res) {
    try {
      const { period } = req.query;
      
      let periodDate = null;
      if (period) {
        periodDate = new Date();
        switch (period) {
          case 'day':
            periodDate.setDate(periodDate.getDate() - 1);
            break;
          case 'week':
            periodDate.setDate(periodDate.getDate() - 7);
            break;
          case 'month':
            periodDate.setMonth(periodDate.getMonth() - 1);
            break;
          case 'year':
            periodDate.setFullYear(periodDate.getFullYear() - 1);
            break;
        }
      }
      
      const statistics = await referralService.getSystemStatistics(periodDate);
      
      res.status(200).json({
        success: true,
        data: statistics
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения системной статистики:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить топ партнеров (админ)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getTopPartners(req, res) {
    try {
      const { limit = 10, period } = req.query;
      
      const { User } = require('../models');
      
      const partners = await User.getTopPartners(Number(limit));
      
      // Дополняем информацией о рефералах
      const partnersWithDetails = await Promise.all(partners.map(async (partner) => {
        const stats = await referralService.getPartnerStatistics(partner._id, period ? new Date(period) : null);
        return {
          ...partner.toObject(),
          referralDetails: {
            totalReferrals: stats.stats.totalReferrals,
            activeReferrals: stats.stats.activeReferrals,
            conversionRate: stats.stats.referralsWithDeposits > 0 
              ? (stats.stats.activeReferrals / stats.stats.referralsWithDeposits * 100).toFixed(2)
              : 0
          }
        };
      }));
      
      res.status(200).json({
        success: true,
        data: {
          partners: partnersWithDetails
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка получения топ партнеров:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Обнаружить подозрительную активность (админ)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async detectFraud(req, res) {
    try {
      const suspiciousPatterns = await referralService.detectFraudulentActivity();
      
      res.status(200).json({
        success: true,
        data: {
          patterns: suspiciousPatterns,
          totalSuspicious: suspiciousPatterns.reduce((sum, p) => sum + p.data.length, 0)
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка обнаружения мошенничества:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Одобрить выплату партнеру (админ)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async approvePayout(req, res) {
    try {
      const { payoutId } = req.params;
      const adminId = req.user._id;
      
      const { ReferralPayout } = require('../models');
      
      const payout = await ReferralPayout.findById(payoutId);
      if (!payout) {
        return res.status(404).json({
          success: false,
          message: 'Выплата не найдена'
        });
      }
      
      if (payout.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Выплата уже обработана'
        });
      }
      
      await payout.approve(adminId);
      
      // TODO: Здесь можно добавить автоматическую обработку через withdrawalService
      
      res.status(200).json({
        success: true,
        message: 'Выплата одобрена',
        data: payout
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка одобрения выплаты:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Обновить уровень партнера вручную (админ)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async updatePartnerLevel(req, res) {
    try {
      const { partnerId } = req.params;
      const { level } = req.body;
      
      const { User } = require('../models');
      
      const validLevels = ['bronze', 'silver', 'gold', 'platinum', 'vip'];
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный уровень'
        });
      }
      
      const partner = await User.findById(partnerId);
      if (!partner) {
        return res.status(404).json({
          success: false,
          message: 'Партнер не найден'
        });
      }
      
      const levelConfig = referralService.levels[level];
      
      partner.referralStats.level = level;
      partner.referralStats.commissionPercent = levelConfig.commissionPercent;
      partner.referralStats.levelUpdatedAt = new Date();
      
      await partner.save();
      
      res.status(200).json({
        success: true,
        message: `Уровень партнера изменен на ${levelConfig.name}`,
        data: {
          partnerId: partner._id,
          newLevel: level,
          commissionPercent: levelConfig.commissionPercent
        }
      });
      
    } catch (error) {
      console.error('REFERRAL CONTROLLER: Ошибка изменения уровня партнера:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ReferralController();