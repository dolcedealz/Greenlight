// backend/src/models/crash-round.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const crashRoundSchema = new Schema({
  roundId: {
    type: Number,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['waiting', 'flying', 'crashed', 'completed'],
    default: 'waiting',
    required: true
  },
  crashPoint: {
    type: Number,
    required: true,
    min: 1.0
  },
  startedAt: {
    type: Date,
    default: null
  },
  crashedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  bets: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    autoCashOut: {
      type: Number,
      default: 0,
      min: 0
    },
    cashedOut: {
      type: Boolean,
      default: false
    },
    cashOutMultiplier: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    placedAt: {
      type: Date,
      default: Date.now
    },
    cashedOutAt: {
      type: Date,
      default: null
    }
  }],
  serverSeed: {
    type: String,
    required: true
  },
  serverSeedHashed: {
    type: String,
    required: true
  },
  nonce: {
    type: Number,
    required: true
  },
  gameData: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Виртуальное поле для общей суммы ставок
crashRoundSchema.virtual('totalBetAmount').get(function() {
  return this.bets.reduce((total, bet) => total + bet.amount, 0);
});

// Виртуальное поле для количества выведенных ставок
crashRoundSchema.virtual('cashOutCount').get(function() {
  return this.bets.filter(bet => bet.cashedOut).length;
});

// Статический метод для получения следующего ID раунда
crashRoundSchema.statics.getNextRoundId = async function() {
  const lastRound = await this.findOne({}, {}, { sort: { roundId: -1 } });
  return lastRound ? lastRound.roundId + 1 : 1;
};

// Статический метод для получения последних раундов
crashRoundSchema.statics.getLastRounds = function(limit = 50) {
  return this.find({ status: 'completed' })
    .sort({ roundId: -1 })
    .limit(limit)
    .select('roundId crashPoint createdAt bets')
    .lean(); // Используем lean() для лучшей производительности, но без виртуальных полей
};

// Методы экземпляра
crashRoundSchema.methods.addBet = function(userId, amount, autoCashOut = 0) {
  // Проверяем, что пользователь еще не делал ставку в этом раунде
  const existingBet = this.bets.find(bet => bet.user.toString() === userId.toString());
  if (existingBet) {
    throw new Error('Вы уже сделали ставку в этом раунде');
  }

  const bet = {
    user: userId,
    amount: amount,
    autoCashOut: autoCashOut,
    cashedOut: false,
    cashOutMultiplier: 0,
    profit: 0,
    placedAt: new Date()
  };

  this.bets.push(bet);
  return bet;
};

crashRoundSchema.methods.cashOut = function(userId, multiplier) {
  const bet = this.bets.find(bet => 
    bet.user.toString() === userId.toString() && !bet.cashedOut
  );
  
  if (!bet) {
    throw new Error('Ставка не найдена или уже выведена');
  }

  bet.cashedOut = true;
  bet.cashOutMultiplier = multiplier;
  bet.profit = (bet.amount * multiplier) - bet.amount;
  bet.cashedOutAt = new Date();

  return bet;
};

crashRoundSchema.methods.startFlying = function() {
  this.status = 'flying';
  this.startedAt = new Date();
};

crashRoundSchema.methods.crash = function(crashPoint) {
  this.status = 'crashed';
  this.crashPoint = crashPoint;
  this.crashedAt = new Date();
};

crashRoundSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
};

// Индексы для оптимизации запросов
crashRoundSchema.index({ roundId: 1 });
crashRoundSchema.index({ status: 1 });
crashRoundSchema.index({ createdAt: -1 });
crashRoundSchema.index({ 'bets.user': 1 });

const CrashRound = mongoose.model('CrashRound', crashRoundSchema);

module.exports = CrashRound;
