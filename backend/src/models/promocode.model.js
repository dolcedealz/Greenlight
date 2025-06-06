const mongoose = require('mongoose');

const promocodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  type: {
    type: String,
    required: true,
    enum: ['balance', 'freespins', 'deposit', 'vip']
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  usageLimit: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  duration: {
    type: Number, // Срок действия в днях
    required: true,
    min: 1,
    max: 365
  },
  description: {
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activatedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    activatedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  expiresAt: {
    type: Date,
    required: true
  },
  // Дополнительные настройки для разных типов промокодов
  settings: {
    // Для balance
    balanceAmount: Number,
    
    // Для freespins
    freespinsCount: Number,
    freespinsGame: String, // 'slots', 'coin', 'mines'
    
    // Для deposit
    depositPercentage: Number, // от 1 до 500
    maxDepositBonus: Number, // максимальная сумма бонуса
    
    // Для vip
    vipDays: Number // дни VIP статуса
  },
  // Условия использования
  conditions: {
    minDeposit: Number, // минимальный депозит для активации
    maxBalance: Number, // максимальный баланс пользователя
    onlyNewUsers: Boolean, // только для новых пользователей
    allowedCountries: [String], // разрешенные страны
    requiredLevel: Number // минимальный уровень пользователя
  },
  // Статистика
  stats: {
    totalActivated: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    averageUserValue: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    lastActivation: Date
  }
}, {
  timestamps: true
});

// Индексы для оптимизации поиска
promocodeSchema.index({ code: 1 });
promocodeSchema.index({ type: 1 });
promocodeSchema.index({ isActive: 1 });
promocodeSchema.index({ expiresAt: 1 });
promocodeSchema.index({ createdBy: 1 });

// Виртуальные поля
promocodeSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

promocodeSchema.virtual('isUsageLimitReached').get(function() {
  return this.usedCount >= this.usageLimit;
});

promocodeSchema.virtual('remainingUsage').get(function() {
  return Math.max(0, this.usageLimit - this.usedCount);
});

promocodeSchema.virtual('activationRate').get(function() {
  return this.usageLimit > 0 ? (this.usedCount / this.usageLimit * 100).toFixed(2) : 0;
});

// Методы модели
promocodeSchema.methods.canBeUsed = function() {
  return this.isActive && 
         !this.isExpired && 
         !this.isUsageLimitReached;
};

promocodeSchema.methods.canBeUsedByUser = function(userId) {
  if (!this.canBeUsed()) return false;
  
  // Проверяем, использовал ли уже этот пользователь промокод
  const alreadyUsed = this.activatedBy.some(activation => 
    activation.user.toString() === userId.toString()
  );
  
  return !alreadyUsed;
};

promocodeSchema.methods.activate = function(userId, ipAddress = null) {
  if (!this.canBeUsedByUser(userId)) {
    throw new Error('Промокод не может быть использован');
  }
  
  this.activatedBy.push({
    user: userId,
    activatedAt: new Date(),
    ipAddress: ipAddress
  });
  
  this.usedCount += 1;
  this.stats.totalActivated += 1;
  this.stats.lastActivation = new Date();
  
  return this.save();
};

promocodeSchema.methods.calculateValue = function(userDeposit = 0) {
  switch (this.type) {
    case 'balance':
      return this.settings.balanceAmount || this.value;
      
    case 'freespins':
      return this.settings.freespinsCount || this.value;
      
    case 'deposit':
      if (userDeposit <= 0) return 0;
      const percentage = this.settings.depositPercentage || this.value;
      const bonus = userDeposit * (percentage / 100);
      const maxBonus = this.settings.maxDepositBonus || Infinity;
      return Math.min(bonus, maxBonus);
      
    case 'vip':
      return this.settings.vipDays || this.value;
      
    default:
      return this.value;
  }
};

// Статические методы
promocodeSchema.statics.findValidCode = function(code) {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

promocodeSchema.statics.findByType = function(type) {
  return this.find({
    type: type,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

promocodeSchema.statics.getActiveStats = function() {
  return this.aggregate([
    {
      $match: {
        isActive: true,
        expiresAt: { $gt: new Date() }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalUsed: { $sum: '$usedCount' },
        totalLimit: { $sum: '$usageLimit' },
        avgValue: { $avg: '$value' }
      }
    }
  ]);
};

// Middleware
promocodeSchema.pre('save', function(next) {
  // Автоматически устанавливаем expiresAt если не задано
  if (!this.expiresAt && this.duration) {
    this.expiresAt = new Date(Date.now() + this.duration * 24 * 60 * 60 * 1000);
  }
  
  // Обновляем статистику
  if (this.isModified('activatedBy')) {
    this.stats.totalValue = this.calculateTotalValue();
    this.stats.averageUserValue = this.stats.totalActivated > 0 ? 
      this.stats.totalValue / this.stats.totalActivated : 0;
    this.stats.successRate = this.usageLimit > 0 ? 
      (this.usedCount / this.usageLimit * 100) : 0;
  }
  
  next();
});

promocodeSchema.methods.calculateTotalValue = function() {
  let total = 0;
  
  this.activatedBy.forEach(() => {
    switch (this.type) {
      case 'balance':
        total += this.settings.balanceAmount || this.value;
        break;
      case 'freespins':
        // Условная стоимость фриспина в USDT
        total += (this.settings.freespinsCount || this.value) * 0.1;
        break;
      case 'deposit':
        // Средний бонус к депозиту
        total += this.value; // Примерное значение
        break;
      case 'vip':
        // Условная стоимость VIP дня
        total += (this.settings.vipDays || this.value) * 5;
        break;
    }
  });
  
  return total;
};

// Создание модели
const Promocode = mongoose.model('Promocode', promocodeSchema);

module.exports = Promocode;