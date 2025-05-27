// backend/src/models/referral-payout.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const referralPayoutSchema = new Schema({
  // Партнер, получающий выплату
  partner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Сумма выплаты
  amount: {
    type: Number,
    required: true,
    min: 10 // Минимальная сумма вывода
  },
  
  // Статус выплаты
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Тип выплаты
  type: {
    type: String,
    enum: ['manual', 'automatic', 'scheduled'],
    default: 'manual'
  },
  
  // Детали о начислениях, включенных в выплату
  earnings: [{
    earning: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralEarning'
    },
    amount: Number
  }],
  
  // Общее количество начислений в выплате
  earningsCount: {
    type: Number,
    default: 0
  },
  
  // Балансы
  referralBalanceBefore: {
    type: Number,
    required: true
  },
  
  referralBalanceAfter: {
    type: Number,
    required: true
  },
  
  operationalBalanceBefore: {
    type: Number,
    required: true
  },
  
  operationalBalanceAfter: {
    type: Number,
    required: true
  },
  
  // Детали обработки
  processing: {
    // ID администратора, одобрившего выплату
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    
    // Дата одобрения
    approvedAt: Date,
    
    // Способ выплаты
    method: {
      type: String,
      enum: ['balance_transfer', 'crypto_withdrawal'],
      default: 'balance_transfer'
    },
    
    // ID транзакции (для crypto_withdrawal)
    transactionId: String,
    
    // Хеш транзакции (для crypto_withdrawal)
    transactionHash: String
  },
  
  // Причина отмены/ошибки
  failureReason: String,
  
  // Метаданные
  metadata: {
    // IP адрес запроса
    ipAddress: String,
    
    // User agent
    userAgent: String,
    
    // Дополнительные заметки
    notes: String,
    
    // Флаг автоматической выплаты
    isAutomatic: {
      type: Boolean,
      default: false
    }
  },
  
  // Даты
  processedAt: Date,
  completedAt: Date,
  failedAt: Date
}, {
  timestamps: true
});

// Индексы
referralPayoutSchema.index({ partner: 1, createdAt: -1 });
referralPayoutSchema.index({ status: 1 });
referralPayoutSchema.index({ 'processing.approvedBy': 1 });

// Виртуальные поля
referralPayoutSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

referralPayoutSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Методы
referralPayoutSchema.methods.approve = async function(adminId) {
  this.status = 'processing';
  this.processing.approvedBy = adminId;
  this.processing.approvedAt = new Date();
  return this.save();
};

referralPayoutSchema.methods.markAsCompleted = async function(transactionDetails = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (transactionDetails.transactionId) {
    this.processing.transactionId = transactionDetails.transactionId;
  }
  
  if (transactionDetails.transactionHash) {
    this.processing.transactionHash = transactionDetails.transactionHash;
  }
  
  return this.save();
};

referralPayoutSchema.methods.markAsFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Статические методы
referralPayoutSchema.statics.getPayoutStats = async function(partnerId = null, period = null) {
  const match = { status: 'completed' };
  
  if (partnerId) {
    match.partner = partnerId;
  }
  
  if (period) {
    match.completedAt = { $gte: period };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: partnerId ? null : '$partner',
        totalPaid: { $sum: '$amount' },
        payoutsCount: { $sum: 1 },
        avgPayout: { $avg: '$amount' },
        lastPayout: { $max: '$completedAt' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'partnerInfo'
      }
    },
    {
      $project: {
        partner: { $arrayElemAt: ['$partnerInfo', 0] },
        totalPaid: 1,
        payoutsCount: 1,
        avgPayout: 1,
        lastPayout: 1
      }
    },
    { $sort: { totalPaid: -1 } }
  ]);
};

// Метод для получения истории выплат
referralPayoutSchema.statics.getPayoutHistory = async function(filters = {}) {
  const { partnerId, status, limit = 50, skip = 0 } = filters;
  
  const query = {};
  
  if (partnerId) {
    query.partner = partnerId;
  }
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('partner', 'telegramId username firstName lastName')
    .populate('processing.approvedBy', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

const ReferralPayout = mongoose.model('ReferralPayout', referralPayoutSchema);

module.exports = ReferralPayout;