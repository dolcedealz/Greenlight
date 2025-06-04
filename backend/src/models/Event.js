// backend/src/models/Event.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ОПТИМИЗАЦИЯМИ ДЛЯ ГИБКИХ КОЭФФИЦИЕНТОВ
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { createLogger } = require('../utils/logger');

const logger = createLogger('Event');

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
  
  // РАСШИРЕННЫЕ МЕТАДАННЫЕ для гибких коэффициентов
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
    
    // НОВОЕ: Статистика гибких коэффициентов
    flexibleOddsStats: {
      // Количество пересчетов коэффициентов
      oddsRecalculations: {
        type: Number,
        default: 0
      },
      
      // История коэффициентов (сохраняем ключевые моменты)
      oddsHistory: [{
        timestamp: {
          type: Date,
          default: Date.now
        },
        odds: {
          type: Object,
          default: {}
        },
        trigger: {
          type: String,
          enum: ['bet_placed', 'manual_update', 'large_bet'],
          default: 'bet_placed'
        },
        betAmount: Number
      }],
      
      // Средние коэффициенты за время жизни события
      averageOdds: {
        type: Object,
        default: {}
      },
      
      // Максимальные и минимальные коэффициенты
      extremeOdds: {
        type: Object,
        default: {}
      }
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

// ОБНОВЛЕННЫЙ метод для расчета коэффициентов с сохранением истории
eventSchema.methods.calculateOdds = function(saveHistory = false) {
  logger.debug(`Расчет коэффициентов (всего ставок: ${this.totalPool} USDT)`, { eventId: this._id });
  
  if (this.totalPool === 0) {
    const defaultOdds = {
      [this.outcomes[0].id]: this.initialOdds,
      [this.outcomes[1].id]: this.initialOdds
    };
    
    logger.debug('Нет ставок, используем начальные коэффициенты', { eventId: this._id, defaultOdds });
    return defaultOdds;
  }
  
  const odds = {};
  const houseEdgeMultiplier = (100 - this.houseEdge) / 100; // 0.95 для 5% комиссии
  
  console.log(`Event ${this._id}: Расчет с комиссией казино ${this.houseEdge}% (множитель: ${houseEdgeMultiplier})`);
  
  this.outcomes.forEach(outcome => {
    if (outcome.totalBets === 0) {
      // Если на исход никто не ставил, даем максимальный коэффициент
      odds[outcome.id] = Math.max(this.initialOdds * 2, 5.0);
      console.log(`Event ${this._id}: Исход ${outcome.id} (${outcome.name}): нет ставок, коэффициент ${odds[outcome.id]}`);
    } else {
      // Формула: (общий пул * множитель без комиссии) / ставки на исход
      const rawOdds = (this.totalPool * houseEdgeMultiplier) / outcome.totalBets;
      // Ограничиваем минимум 1.1, максимум 10.0
      odds[outcome.id] = Math.max(1.1, Math.min(10.0, rawOdds));
      
      console.log(`Event ${this._id}: Исход ${outcome.id} (${outcome.name}):`);
      console.log(`  Ставки на исход: ${outcome.totalBets} USDT`);
      console.log(`  Расчет: (${this.totalPool} * ${houseEdgeMultiplier}) / ${outcome.totalBets} = ${rawOdds}`);
      console.log(`  Финальный коэффициент: ${odds[outcome.id]}`);
    }
  });
  
  // Сохраняем историю коэффициентов если требуется
  if (saveHistory) {
    this.saveOddsHistory(odds, 'calculation');
  }
  
  console.log(`Event ${this._id}: Финальные коэффициенты:`, odds);
  return odds;
};

// НОВЫЙ метод для сохранения истории коэффициентов
eventSchema.methods.saveOddsHistory = function(odds, trigger = 'bet_placed', betAmount = null) {
  if (!this.metadata) {
    this.metadata = {};
  }
  if (!this.metadata.flexibleOddsStats) {
    this.metadata.flexibleOddsStats = {
      oddsRecalculations: 0,
      oddsHistory: [],
      averageOdds: {},
      extremeOdds: {}
    };
  }
  
  // Добавляем запись в историю
  this.metadata.flexibleOddsStats.oddsHistory.push({
    timestamp: new Date(),
    odds: odds,
    trigger: trigger,
    betAmount: betAmount
  });
  
  // Увеличиваем счетчик пересчетов
  this.metadata.flexibleOddsStats.oddsRecalculations++;
  
  // Обновляем экстремальные значения
  Object.keys(odds).forEach(outcomeId => {
    const currentOdds = odds[outcomeId];
    
    if (!this.metadata.flexibleOddsStats.extremeOdds[outcomeId]) {
      this.metadata.flexibleOddsStats.extremeOdds[outcomeId] = {
        min: currentOdds,
        max: currentOdds
      };
    } else {
      this.metadata.flexibleOddsStats.extremeOdds[outcomeId].min = 
        Math.min(this.metadata.flexibleOddsStats.extremeOdds[outcomeId].min, currentOdds);
      this.metadata.flexibleOddsStats.extremeOdds[outcomeId].max = 
        Math.max(this.metadata.flexibleOddsStats.extremeOdds[outcomeId].max, currentOdds);
    }
  });
  
  // Ограничиваем историю последними 100 записями
  if (this.metadata.flexibleOddsStats.oddsHistory.length > 100) {
    this.metadata.flexibleOddsStats.oddsHistory = 
      this.metadata.flexibleOddsStats.oddsHistory.slice(-100);
  }
  
  console.log(`Event ${this._id}: История коэффициентов обновлена (записей: ${this.metadata.flexibleOddsStats.oddsHistory.length})`);
};

// НОВЫЙ метод для получения статистики коэффициентов
eventSchema.methods.getOddsStatistics = function() {
  if (!this.metadata?.flexibleOddsStats?.oddsHistory?.length) {
    return {
      hasHistory: false,
      message: 'История коэффициентов отсутствует'
    };
  }
  
  const history = this.metadata.flexibleOddsStats.oddsHistory;
  const currentOdds = this.calculateOdds();
  
  // Рассчитываем средние коэффициенты
  const avgOdds = {};
  const oddsCount = {};
  
  history.forEach(record => {
    Object.keys(record.odds).forEach(outcomeId => {
      if (!avgOdds[outcomeId]) {
        avgOdds[outcomeId] = 0;
        oddsCount[outcomeId] = 0;
      }
      avgOdds[outcomeId] += record.odds[outcomeId];
      oddsCount[outcomeId]++;
    });
  });
  
  Object.keys(avgOdds).forEach(outcomeId => {
    avgOdds[outcomeId] = avgOdds[outcomeId] / oddsCount[outcomeId];
  });
  
  return {
    hasHistory: true,
    recalculations: this.metadata.flexibleOddsStats.oddsRecalculations,
    currentOdds: currentOdds,
    averageOdds: avgOdds,
    extremeOdds: this.metadata.flexibleOddsStats.extremeOdds,
    historyLength: history.length,
    firstCalculation: history[0]?.timestamp,
    lastCalculation: history[history.length - 1]?.timestamp
  };
};

// Метод для проверки возможности сделать ставку
eventSchema.methods.canPlaceBet = function() {
  const now = new Date();
  return this.status === 'active' && 
         now < this.bettingEndsAt && 
         this.winningOutcome === null;
};

// Метод для проверки готовности к завершению
eventSchema.methods.isReadyToFinish = function() {
  return this.metadata?.correctOutcomeId !== null;
};

// Метод для получения времени до окончания в минутах
eventSchema.methods.getTimeUntilEnd = function() {
  const now = new Date();
  const timeUntilEnd = new Date(this.endTime) - now;
  return Math.floor(timeUntilEnd / (1000 * 60)); // в минутах
};

// Метод для проверки необходимости уведомления
eventSchema.methods.needsNotification = function(type) {
  if (!this.metadata?.notificationsSent) {
    return true;
  }
  return !this.metadata.notificationsSent[type];
};

// Метод для отметки отправленного уведомления
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

// ОБНОВЛЕННЫЙ метод для финализации события с сохранением финальных коэффициентов
eventSchema.methods.finalize = async function(winningOutcomeId, finishedBy = null, finishType = 'manual') {
  if (!this.outcomes.find(o => o.id === winningOutcomeId)) {
    throw new Error('Неверный ID выигрышного исхода');
  }
  
  // Сохраняем финальные коэффициенты в историю
  const finalOdds = this.calculateOdds();
  this.saveOddsHistory(finalOdds, 'event_finished');
  
  this.winningOutcome = winningOutcomeId;
  this.status = 'finished';
  
  // Записываем метаданные о завершении
  if (!this.metadata) {
    this.metadata = {};
  }
  this.metadata.finishedBy = finishedBy;
  this.metadata.finishedAt = new Date();
  this.metadata.finishType = finishType;
  
  console.log(`Event ${this._id}: Финализация завершена. Финальные коэффициенты:`, finalOdds);
  
  return this.save();
};

// Метод для записи изменения времени
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

// Статический метод для получения событий, требующих внимания
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

// НОВЫЙ статический метод для получения статистики гибких коэффициентов
eventSchema.statics.getFlexibleOddsStatistics = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        'metadata.flexibleOddsStats.oddsRecalculations': { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalRecalculations: { $sum: '$metadata.flexibleOddsStats.oddsRecalculations' },
        avgRecalculationsPerEvent: { $avg: '$metadata.flexibleOddsStats.oddsRecalculations' }
      }
    }
  ]);
  
  return stats[0] || {
    totalEvents: 0,
    totalRecalculations: 0,
    avgRecalculationsPerEvent: 0
  };
};

// Оптимизированные индексы для производительности

// Основной композитный индекс для получения активных событий (наиболее частый запрос)
eventSchema.index({ 
  status: 1, 
  bettingEndsAt: 1, 
  priority: -1, 
  createdAt: -1 
}, { 
  name: 'active_events_optimized' 
});

// Индекс для поиска главного события
eventSchema.index({ 
  featured: 1, 
  status: 1, 
  bettingEndsAt: 1,
  priority: -1 
}, { 
  name: 'featured_events' 
});

// Индексы для административных запросов
eventSchema.index({ createdBy: 1, createdAt: -1 }, { name: 'admin_events' });
eventSchema.index({ status: 1, endTime: 1 }, { name: 'events_by_end_time' });

// Индекс для уведомлений и мониторинга
eventSchema.index({ 
  endTime: 1, 
  status: 1,
  'metadata.notificationsSent.overdue': 1
}, { 
  name: 'notifications_index' 
});

// Индекс для поиска событий готовых к завершению
eventSchema.index({ 
  'metadata.correctOutcomeId': 1,
  status: 1
}, { 
  name: 'ready_to_finish' 
});

// Текстовый индекс для поиска по названию и описанию
eventSchema.index({ 
  title: 'text', 
  description: 'text' 
}, { 
  name: 'text_search',
  weights: { title: 10, description: 1 }
});

// Индекс для категорий
eventSchema.index({ category: 1, status: 1, priority: -1 }, { name: 'category_events' });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
