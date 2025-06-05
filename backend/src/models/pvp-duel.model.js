// backend/src/models/pvp-duel.model.js
const mongoose = require('mongoose');

const pvpDuelSchema = new mongoose.Schema({
  // Участники дуэли
  challengerId: {
    type: String,
    required: true,
    index: true
  },
  challengerUsername: {
    type: String,
    required: true
  },
  opponentId: {
    type: String,
    required: true,
    index: true
  },
  opponentUsername: {
    type: String,
    required: true
  },
  
  // Тип игры (эмодзи)
  gameType: {
    type: String,
    enum: ['🎲', '🎯', '⚽', '🏀', '🎰', '🎳'],
    default: '🎲'
  },
  
  // Формат серии
  format: {
    type: String,
    enum: ['bo1', 'bo3', 'bo5', 'bo7', 'bo9', 'custom'],
    default: 'bo1'
  },
  winsRequired: {
    type: Number,
    default: 1 // bo1=1, bo3=2, bo5=3, etc.
  },
  
  // Счет
  score: {
    challenger: {
      type: Number,
      default: 0
    },
    opponent: {
      type: Number,
      default: 0
    }
  },
  
  // История раундов
  rounds: [{
    number: {
      type: Number,
      required: true
    },
    challengerResult: {
      type: Number,
      required: true
    },
    opponentResult: {
      type: Number,
      required: true
    },
    winnerId: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Финансовые данные (за всю серию)
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  commission: {
    type: Number,
    required: true,
    default: function() {
      return this.amount * 2 * 0.05; // 5% от общего банка
    }
  },
  totalBank: {
    type: Number,
    required: true,
    default: function() {
      return this.amount * 2;
    }
  },
  winAmount: {
    type: Number,
    default: function() {
      return this.totalBank - this.commission;
    }
  },
  
  // Статус дуэли
  status: {
    type: String,
    enum: ['pending', 'accepted', 'active', 'completed', 'declined', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Telegram данные
  chatId: {
    type: String,
    required: true
  },
  chatType: {
    type: String,
    enum: ['private', 'group', 'supergroup'],
    default: 'private'
  },
  messageId: {
    type: Number,
    required: true
  },
  
  // Игровые данные
  sessionId: {
    type: String,
    unique: true,
    sparse: true, // Создается только при принятии дуэли
    index: true
  },
  
  // Готовность игроков
  challengerReady: {
    type: Boolean,
    default: false
  },
  opponentReady: {
    type: Boolean,
    default: false
  },
  challengerJoined: {
    type: Boolean,
    default: false
  },
  opponentJoined: {
    type: Boolean,
    default: false
  },
  
  // Результат игры (автоматическое закрепление сторон)
  // Инициатор всегда играет за "heads", оппонент за "tails"
  challengerSide: {
    type: String,
    enum: ['heads', 'tails'],
    default: 'heads'
  },
  opponentSide: {
    type: String,
    enum: ['heads', 'tails'],
    default: 'tails'
  },
  coinResult: {
    type: String,
    enum: ['heads', 'tails']
  },
  
  // Данные игры для провабли фейр верификации
  gameData: {
    serverSeed: {
      type: String
    },
    serverSeedHashed: {
      type: String
    },
    clientSeed: {
      type: String
    },
    nonce: {
      type: Number
    },
    randomValue: {
      type: Number
    }
  },
  
  winnerId: {
    type: String
  },
  winnerUsername: {
    type: String
  },
  loserId: {
    type: String
  },
  loserUsername: {
    type: String
  },
  
  // Реферальные данные
  challengerReferrerId: {
    type: String
  },
  opponentReferrerId: {
    type: String
  },
  referralPayouts: [{
    userId: String,
    amount: Number,
    type: String // 'winner_referral', 'loser_referral'
  }],
  
  // Временные метки
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  acceptedAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 5 * 60 * 1000); // 5 минут на принятие
    },
    index: true
  },
  
  // Дополнительные данные
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Виртуальные поля
pvpDuelSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
});

pvpDuelSchema.virtual('participants').get(function() {
  return [this.challengerId, this.opponentId];
});

pvpDuelSchema.virtual('bothReady').get(function() {
  return this.challengerReady && this.opponentReady;
});

pvpDuelSchema.virtual('bothJoined').get(function() {
  return this.challengerJoined && this.opponentJoined;
});

// Индексы для оптимизации
pvpDuelSchema.index({ challengerId: 1, status: 1 });
pvpDuelSchema.index({ opponentId: 1, status: 1 });
pvpDuelSchema.index({ sessionId: 1 });
pvpDuelSchema.index({ chatId: 1, messageId: 1 });
pvpDuelSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
pvpDuelSchema.index({ createdAt: -1 });

// Методы экземпляра
pvpDuelSchema.methods.accept = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.sessionId = require('crypto').randomBytes(16).toString('hex');
  this.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут на игру
  return this.save();
};

pvpDuelSchema.methods.decline = function() {
  this.status = 'declined';
  return this.save();
};

pvpDuelSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

pvpDuelSchema.methods.expire = function() {
  this.status = 'expired';
  return this.save();
};

pvpDuelSchema.methods.start = function() {
  this.status = 'active';
  this.startedAt = new Date();
  return this.save();
};

pvpDuelSchema.methods.complete = function(result) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.coinResult = result;
  
  // Определяем победителя
  const challengerWins = this.challengerSide === result;
  if (challengerWins) {
    this.winnerId = this.challengerId;
    this.winnerUsername = this.challengerUsername;
    this.loserId = this.opponentId;
    this.loserUsername = this.opponentUsername;
  } else {
    this.winnerId = this.opponentId;
    this.winnerUsername = this.opponentUsername;
    this.loserId = this.challengerId;
    this.loserUsername = this.challengerUsername;
  }
  
  return this.save();
};

pvpDuelSchema.methods.setPlayerReady = function(userId, ready = true) {
  if (userId === this.challengerId) {
    this.challengerReady = ready;
  } else if (userId === this.opponentId) {
    this.opponentReady = ready;
  }
  return this.save();
};

pvpDuelSchema.methods.setPlayerJoined = function(userId, joined = true) {
  if (userId === this.challengerId) {
    this.challengerJoined = joined;
  } else if (userId === this.opponentId) {
    this.opponentJoined = joined;
  }
  return this.save();
};

// Статические методы
pvpDuelSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    $or: [
      { challengerId: userId },
      { opponentId: userId }
    ],
    status: { $in: ['pending', 'accepted', 'active'] }
  });
};

pvpDuelSchema.statics.findBySession = function(sessionId) {
  return this.findOne({ sessionId });
};

pvpDuelSchema.statics.findPendingByUser = function(userId) {
  return this.find({
    $or: [
      { challengerId: userId },
      { opponentId: userId }
    ],
    status: 'pending'
  });
};

pvpDuelSchema.statics.findHistoryByUser = function(userId, limit = 20) {
  return this.find({
    $or: [
      { challengerId: userId },
      { opponentId: userId }
    ],
    status: { $in: ['completed', 'declined', 'expired', 'cancelled'] }
  })
  .sort({ completedAt: -1, createdAt: -1 })
  .limit(limit);
};

pvpDuelSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { challengerId: userId },
          { opponentId: userId }
        ],
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalGames: { $sum: 1 },
        wins: {
          $sum: {
            $cond: [{ $eq: ['$winnerId', userId] }, 1, 0]
          }
        },
        totalWinnings: {
          $sum: {
            $cond: [
              { $eq: ['$winnerId', userId] },
              '$winAmount',
              0
            ]
          }
        },
        totalLosses: {
          $sum: {
            $cond: [
              { $eq: ['$loserId', userId] },
              '$amount',
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalGames: 1,
        wins: 1,
        losses: { $subtract: ['$totalGames', '$wins'] },
        winRate: {
          $cond: [
            { $gt: ['$totalGames', 0] },
            { $divide: ['$wins', '$totalGames'] },
            0
          ]
        },
        totalWinnings: 1,
        totalLosses: 1,
        netProfit: { $subtract: ['$totalWinnings', '$totalLosses'] }
      }
    }
  ]);
};

// Pre-save middleware
pvpDuelSchema.pre('save', function(next) {
  // Вычисляем финансовые поля при создании
  if (this.isNew) {
    this.totalBank = this.amount * 2;
    this.commission = this.totalBank * 0.05;
    this.winAmount = this.totalBank - this.commission;
  }
  next();
});

// Очистка истекших дуэлей
pvpDuelSchema.statics.cleanupExpired = async function() {
  const expired = await this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
  
  for (const duel of expired) {
    await duel.expire();
  }
  
  return expired.length;
};

const PvPDuel = mongoose.model('PvPDuel', pvpDuelSchema);

module.exports = PvPDuel;