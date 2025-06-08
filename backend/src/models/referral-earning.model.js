// backend/src/models/referral-earning.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const referralEarningSchema = new Schema({
  // Партнер, получающий комиссию
  partner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Реферал, с которого начислена комиссия
  referral: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Игра, в которой произошел проигрыш
  game: {
    type: Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  
  // Тип начисления
  type: {
    type: String,
    enum: ['game_loss', 'coin_dispute_fee', 'registration_bonus'],
    required: true
  },
  
  // Детали расчета
  calculation: {
    // Сумма проигрыша/комиссии реферала
    baseAmount: {
      type: Number,
      required: true
    },
    
    // Уровень партнера на момент начисления
    partnerLevel: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'vip', 'partner_bronze', 'partner_silver', 'partner_gold'],
      required: true
    },
    
    // Процент комиссии
    commissionPercent: {
      type: Number,
      required: true
    },
    
    // Итоговая сумма начисления
    earnedAmount: {
      type: Number,
      required: true
    }
  },
  
  // Статус начисления
  status: {
    type: String,
    enum: ['pending', 'credited', 'cancelled'],
    default: 'pending'
  },
  
  // Баланс партнера до и после
  balanceBefore: {
    type: Number,
    required: true
  },
  
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Метаданные
  metadata: {
    // Тип игры (для game_loss)
    gameType: String,
    
    // ID спора (для coin_dispute_fee)
    disputeId: String,
    
    // Дополнительная информация
    notes: String
  },
  
  // Дата зачисления на баланс
  creditedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
referralEarningSchema.index({ partner: 1, createdAt: -1 });
referralEarningSchema.index({ referral: 1, createdAt: -1 });
referralEarningSchema.index({ status: 1 });
referralEarningSchema.index({ 'calculation.partnerLevel': 1 });

// Статические методы
referralEarningSchema.statics.getPartnerStats = async function(partnerId, period = null) {
  const match = { partner: partnerId, status: 'credited' };
  
  if (period) {
    match.createdAt = { $gte: period };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalEarned: { $sum: '$calculation.earnedAmount' },
        totalTransactions: { $sum: 1 },
        byType: {
          $push: {
            type: '$type',
            amount: '$calculation.earnedAmount'
          }
        },
        byLevel: {
          $push: {
            level: '$calculation.partnerLevel',
            amount: '$calculation.earnedAmount'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalEarned: 1,
        totalTransactions: 1,
        earningsByType: {
          $reduce: {
            input: '$byType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[{
                    k: '$$this.type',
                    v: { $add: [{ $ifNull: [`$$value.$$this.type`, 0] }, '$$this.amount'] }
                  }]]
                }
              ]
            }
          }
        },
        earningsByLevel: {
          $reduce: {
            input: '$byLevel',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[{
                    k: '$$this.level',
                    v: { $add: [{ $ifNull: [`$$value.$$this.level`, 0] }, '$$this.amount'] }
                  }]]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

// Метод для получения топ рефералов партнера
referralEarningSchema.statics.getTopReferrals = async function(partnerId, limit = 10) {
  return this.aggregate([
    { $match: { partner: partnerId, status: 'credited' } },
    {
      $group: {
        _id: '$referral',
        totalBrought: { $sum: '$calculation.earnedAmount' },
        transactionsCount: { $sum: 1 },
        lastActivity: { $max: '$createdAt' }
      }
    },
    { $sort: { totalBrought: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'referralInfo'
      }
    },
    { $unwind: '$referralInfo' },
    {
      $project: {
        referral: '$referralInfo',
        totalBrought: 1,
        transactionsCount: 1,
        lastActivity: 1
      }
    }
  ]);
};

const ReferralEarning = mongoose.model('ReferralEarning', referralEarningSchema);

module.exports = ReferralEarning;