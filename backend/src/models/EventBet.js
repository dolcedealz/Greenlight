// backend/src/models/EventBet.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventBetSchema = new Schema({
  // Связь с пользователем
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Связь с событием
  event: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  // ID выбранного исхода
  outcomeId: {
    type: String,
    required: true
  },
  
  // Название выбранного исхода (для истории)
  outcomeName: {
    type: String,
    required: true
  },
  
  // Сумма ставки
  betAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  
  // Коэффициент на момент ставки
  odds: {
    type: Number,
    required: true,
    min: 1.01
  },
  
  // Потенциальный выигрыш
  potentialWin: {
    type: Number,
    required: true
  },
  
  // Статус ставки
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled', 'refunded'],
    default: 'active'
  },
  
  // Фактический выигрыш (заполняется при завершении события)
  actualWin: {
    type: Number,
    default: 0
  },
  
  // Прибыль/убыток
  profit: {
    type: Number,
    default: 0
  },
  
  // Баланс до и после ставки
  balanceBefore: {
    type: Number,
    required: true
  },
  
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Время размещения ставки
  placedAt: {
    type: Date,
    default: Date.now
  },
  
  // Время завершения ставки
  settledAt: {
    type: Date,
    default: null
  },
  
  // IP адрес пользователя
  userIp: {
    type: String
  },
  
  // Метаданные для аналитики
  metadata: {
    userAgent: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'bot'],
      default: 'web'
    },
    sessionId: String
  }
}, {
  timestamps: true
});

// Pre-save middleware для расчета потенциального выигрыша
eventBetSchema.pre('save', function(next) {
  if (this.isNew) {
    this.potentialWin = this.betAmount * this.odds;
  }
  next();
});

// Метод для завершения ставки (выигрыш)
eventBetSchema.methods.markAsWon = async function() {
  this.status = 'won';
  this.actualWin = this.potentialWin;
  this.profit = this.actualWin - this.betAmount;
  this.settledAt = new Date();
  
  return this.save();
};

// Метод для завершения ставки (проигрыш)
eventBetSchema.methods.markAsLost = async function() {
  this.status = 'lost';
  this.actualWin = 0;
  this.profit = -this.betAmount;
  this.settledAt = new Date();
  
  return this.save();
};

// Метод для возврата ставки
eventBetSchema.methods.refund = async function() {
  this.status = 'refunded';
  this.actualWin = this.betAmount;
  this.profit = 0;
  this.settledAt = new Date();
  
  return this.save();
};

// Статический метод для получения ставок события
eventBetSchema.statics.getEventBets = function(eventId, options = {}) {
  const { limit = 50, skip = 0, outcomeId = null } = options;
  
  const query = { event: eventId };
  if (outcomeId) {
    query.outcomeId = outcomeId;
  }
  
  return this.find(query)
    .populate('user', 'telegramId username firstName lastName')
    .sort({ placedAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Статический метод для получения статистики ставок пользователя
eventBetSchema.statics.getUserEventStats = function(userId) {
  return this.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBet: { $sum: '$betAmount' },
        totalWin: { $sum: '$actualWin' },
        totalProfit: { $sum: '$profit' }
      }
    }
  ]);
};

// Статический метод для завершения всех ставок события
eventBetSchema.statics.settleBets = async function(eventId, winningOutcomeId) {
  const { User } = require('./index');
  
  // Получаем все активные ставки на событие
  const bets = await this.find({
    event: eventId,
    status: 'active'
  }).populate('user');
  
  const results = {
    winningBets: 0,
    losingBets: 0,
    totalPayout: 0,
    totalProfit: 0
  };
  
  // Обрабатываем каждую ставку
  for (const bet of bets) {
    if (bet.outcomeId === winningOutcomeId) {
      // Выигрышная ставка
      await bet.markAsWon();
      
      // Добавляем выигрыш на баланс пользователя
      bet.user.balance += bet.actualWin;
      await bet.user.save();
      
      results.winningBets++;
      results.totalPayout += bet.actualWin;
    } else {
      // Проигрышная ставка
      await bet.markAsLost();
      results.losingBets++;
    }
    
    results.totalProfit += bet.profit;
  }
  
  return results;
};

// Индексы для производительности
eventBetSchema.index({ user: 1, createdAt: -1 });
eventBetSchema.index({ event: 1, outcomeId: 1 });
eventBetSchema.index({ status: 1, settledAt: 1 });
eventBetSchema.index({ placedAt: -1 });

const EventBet = mongoose.model('EventBet', eventBetSchema);

module.exports = EventBet;
