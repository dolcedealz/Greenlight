// backend/src/models/Event.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ НОВЫХ ФУНКЦИЙ
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // Два варианта исходов
  outcomes: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    totalBets: {
      type: Number,
      default: 0,
      min: 0
    },
    betsCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  
  // Общие ставки на событие
  totalPool: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Статус события
  status: {
    type: String,
    enum: ['upcoming', 'active', 'betting_closed', 'finished', 'cancelled'],
    default: 'upcoming'
  },
  
  // Результат события (ID выигрышного исхода)
  winningOutcome: {
    type: String,
    default: null
  },
  
  // Временные рамки
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  bettingEndsAt: {
    type: Date,
    required: true
  },
  
  // Настройки коэффициентов
  initialOdds: {
    type: Number,
    default: 2.0,
    min: 1.01,
    max: 10.0
  },
  
  // Минимальная ставка
  minBet: {
    type: Number,
    default: 1,
    min: 0.01
  },
  
  // Максимальная ставка
  maxBet: {
    type: Number,
    default: 1000,
    min: 1
  },
  
  // Комиссия казино (в процентах)
  houseEdge: {
    type: Number,
    default: 5,
    min: 0,
    max: 20
  },
  
  // Категория события
  category: {
    type: String,
    enum: ['sports', 'crypto', 'politics', 'entertainment', 'other'],
    default: 'other'
  },
  
  // Приоритет для отображения
  priority: {
    type: Number,
    default: 0
  },
  
  // Флаг показа на главной странице
  featured: {
    type: Boolean,
    default: false
  },
  
  // Создатель события (админ)
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // НОВЫЕ МЕТАДАННЫЕ для расширенного управления
  metadata: {
    source: String,
    externalId: String,
    tags: [String],
    
    // Правильный исход (установленный заранее)
    correctOutcomeId: {
      type: String,
      default: null
    },
    correctOutcomeSetBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    correctOutcomeSetAt: {
      type: Date,
      default: null
    },
    
    // Информация о завершении
    finishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    finishedAt: {
      type: Date,
      default: null
    },
    finishType: {
      type: String,
      enum: ['auto', 'manual', 'early', 'prepared'],
      default: null
    },
    
    // История изменений времени
    timeChanges: [{
      changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      previousEndTime: Date,
      newEndTime: Date,
      previousBettingEndsAt: Date,
      newBettingEndsAt: Date,
      reason: String
    }],
    
    // Уведомления
    notificationsSent: {
      oneHour: { type: Boolean, default: false },
      thirtyMinutes: { type: Boolean, default: false },
      fiveMinutes: { type: Boolean, default: false },
      overdue: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Валидация: должно быть ровно 2 исхода
eventSchema.pre('save', function(next) {
  if (this.outcomes.length !== 2) {
    next(new Error('События должны иметь ровно 2 исхода'));
  }
  
  // Проверяем уникальность ID исходов
  const outcomeIds = this.outcomes.map(o => o.id);
  if (new Set(outcomeIds).size !== outcomeIds.length) {
    next(new Error('ID исходов должны быть уникальными'));
  }
  
  // Проверяем временные рамки
  if (this.bettingEndsAt > this.endTime) {
    next(new Error('Прием ставок должен закончиться до окончания события'));
  }
  
  if (this.startTime >= this.endTime) {
    next(new Error('Время начала должно быть раньше времени окончания'));
  }
  
  next();
});

// Метод для расчета коэффициентов в реальном времени
eventSchema.methods.calculateOdds = function() {
  if (this.totalPool === 0) {
    return {
      [this.outcomes[0].id]: this.initialOdds,
      [this.outcomes[1].id]: this.initialOdds
    };
  }
  
  const odds = {};
  const houseEdgeMultiplier = (100 - this.houseEdge) / 100; // 0.95 для 5% комиссии
  
  this.outcomes.forEach(outcome => {
    if (outcome.totalBets === 0) {
      // Если на исход никто не ставил, даем максимальный коэффициент
      odds[outcome.id] = Math.max(this.initialOdds * 2, 5.0);
    } else {
      // Формула: (общий пул * множитель без комиссии) / ставки на исход
      const rawOdds = (this.totalPool * houseEdgeMultiplier) / outcome.totalBets;
      // Ограничиваем минимум 1.1, максимум 10.0
      odds[outcome.id] = Math.max(1.1, Math.min(10.0, rawOdds));
    }
  });
  
  return odds;
};

// Метод для проверки возможности сделать ставку
eventSchema.methods.canPlaceBet = function() {
  const now = new Date();
  return this.status === 'active' && 
         now < this.bettingEndsAt && 
         this.winningOutcome === null;
};

// НОВЫЙ метод для проверки готовности к завершению
eventSchema.methods.isReadyToFinish = function() {
  return this.metadata?.correctOutcomeId !== null;
};

// НОВЫЙ метод для получения времени до окончания в минутах
eventSchema.methods.getTimeUntilEnd = function() {
  const now = new Date();
  const timeUntilEnd = new Date(this.endTime) - now;
  return Math.floor(timeUntilEnd / (1000 * 60)); // в минутах
};

// НОВЫЙ метод для проверки необходимости уведомления
eventSchema.methods.needsNotification = function(type) {
  if (!this.metadata?.notificationsSent) {
    return true;
  }
  return !this.metadata.notificationsSent[type];
};

// НОВЫЙ метод для отметки отправленного уведомления
eventSchema.methods.markNotificationSent = function(type) {
  if (!this.metadata) {
    this.metadata = {};
  }
  if (!this.metadata.notificationsSent) {
    this.metadata.notificationsSent = {};
  }
  this.metadata.notificationsSent[type] = true;
  return this.save();
};

// Метод для финализации события
eventSchema.methods.finalize = async function(winningOutcomeId, finishedBy = null, finishType = 'manual') {
  if (!this.outcomes.find(o => o.id === winningOutcomeId)) {
    throw new Error('Неверный ID выигрышного исхода');
  }
  
  this.winningOutcome = winningOutcomeId;
  this.status = 'finished';
  
  // Записываем метаданные о завершении
  if (!this.metadata) {
    this.metadata = {};
  }
  this.metadata.finishedBy = finishedBy;
  this.metadata.finishedAt = new Date();
  this.metadata.finishType = finishType;
  
  return this.save();
};

// НОВЫЙ метод для записи изменения времени
eventSchema.methods.recordTimeChange = function(changedBy, previousEndTime, newEndTime, previousBettingEndsAt, newBettingEndsAt, reason = null) {
  if (!this.metadata) {
    this.metadata = { timeChanges: [] };
  }
  if (!this.metadata.timeChanges) {
    this.metadata.timeChanges = [];
  }
  
  this.metadata.timeChanges.push({
    changedBy,
    changedAt: new Date(),
    previousEndTime,
    newEndTime,
    previousBettingEndsAt,
    newBettingEndsAt,
    reason
  });
};

// Статический метод для получения активных событий
eventSchema.statics.getActiveEvents = function(limit = 10) {
  return this.find({
    status: 'active',
    bettingEndsAt: { $gt: new Date() }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Статический метод для получения события для главной страницы
eventSchema.statics.getFeaturedEvent = function() {
  return this.findOne({
    featured: true,
    status: 'active',
    bettingEndsAt: { $gt: new Date() }
  })
  .sort({ priority: -1, createdAt: -1 });
};

// НОВЫЙ статический метод для получения событий, требующих внимания
eventSchema.statics.getEventsRequiringAttention = function() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  
  return this.find({
    status: 'active',
    $or: [
      // События, которые заканчиваются в течение часа и не имеют установленного исхода
      { 
        endTime: { $lte: oneHourFromNow },
        'metadata.correctOutcomeId': { $exists: false }
      },
      // События, которые уже просрочены
      { endTime: { $lte: now } }
    ]
  }).sort({ endTime: 1 });
};

// Индексы для производительности
eventSchema.index({ status: 1, bettingEndsAt: 1 });
eventSchema.index({ featured: 1, priority: -1 });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ endTime: 1, status: 1 }); // Для уведомлений
eventSchema.index({ 'metadata.correctOutcomeId': 1 }); // Для поиска событий с установленным исходом

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
