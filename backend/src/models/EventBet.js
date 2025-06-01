// backend/src/models/EventBet.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ГИБКИМИ КОЭФФИЦИЕНТАМИ
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
  
  // ИЗМЕНЕНИЕ: Коэффициент на момент размещения ставки (только для истории и UI)
  oddsAtBet: {
    type: Number,
    required: true,
    min: 1.01
  },
  
  // НОВОЕ: Финальный коэффициент для расчета выплат (устанавливается при завершении события)
  finalOdds: {
    type: Number,
    default: null
  },
  
  // Потенциальный выигрыш на момент ставки (для UI и истории)
  estimatedWin: {
    type: Number,
    default: 0
  },
  
  // Статус ставки
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled', 'refunded'],
    default: 'active'
  },
  
  // Фактический выигрыш (рассчитывается по finalOdds при завершении события)
  actualWin: {
    type: Number,
    default: 0
  },
  
  // Прибыль/убыток (рассчитывается по finalOdds)
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
    sessionId: String,
    
    // Дополнительная информация о коэффициентах
    oddsHistory: {
      // Коэффициенты всех исходов на момент ставки
      allOddsAtBet: {
        type: Object,
        default: {}
      },
      
      // Позиция в очереди ставок (для аналитики)
      betPosition: {
        type: Number,
        default: 0
      }
    }
  }
}, {
  timestamps: true
});

// Pre-save middleware для расчета estimatedWin
eventBetSchema.pre('save', function(next) {
  // Рассчитываем estimatedWin на основе oddsAtBet (для UI)
  if (!this.estimatedWin || this.estimatedWin === 0) {
    if (this.betAmount && this.oddsAtBet && !isNaN(this.betAmount) && !isNaN(this.oddsAtBet)) {
      this.estimatedWin = this.betAmount * this.oddsAtBet;
      console.log(`EventBet: Рассчитан estimatedWin = ${this.betAmount} * ${this.oddsAtBet} = ${this.estimatedWin}`);
    } else {
      console.error('EventBet: Невозможно рассчитать estimatedWin, betAmount:', this.betAmount, 'oddsAtBet:', this.oddsAtBet);
      this.estimatedWin = this.betAmount || 0;
    }
  }
  
  next();
});

// ОБНОВЛЕННЫЙ метод для завершения ставки (выигрыш) с финальными коэффициентами
eventBetSchema.methods.markAsWonWithFinalOdds = async function(finalOdds) {
  this.status = 'won';
  this.finalOdds = finalOdds;
  this.actualWin = this.betAmount * finalOdds;
  this.profit = this.actualWin - this.betAmount;
  this.settledAt = new Date();
  
  console.log(`EventBet ${this._id}: Выигрыш рассчитан по финальным коэффициентам`);
  console.log(`  Ставка: ${this.betAmount} USDT`);
  console.log(`  Коэффициент при ставке: ${this.oddsAtBet}`);
  console.log(`  Финальный коэффициент: ${this.finalOdds}`);
  console.log(`  Ожидаемый выигрыш: ${this.estimatedWin} USDT`);
  console.log(`  Фактический выигрыш: ${this.actualWin} USDT`);
  console.log(`  Разница: ${(this.actualWin - this.estimatedWin).toFixed(2)} USDT`);
  
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

// ОБНОВЛЕННЫЙ статический метод для завершения всех ставок события с финальными коэффициентами
eventBetSchema.statics.settleBetsWithFinalOdds = async function(eventId, winningOutcomeId) {
  const { User, Event } = require('./index');
  
  console.log(`EventBet: Начинаем расчет ставок для события ${eventId}, победитель: ${winningOutcomeId}`);
  
  // Получаем событие для расчета финальных коэффициентов
  const event = await Event.findById(eventId);
  if (!event) {
    throw new Error('Событие не найдено при расчете ставок');
  }
  
  // Рассчитываем финальные коэффициенты
  const finalOdds = event.calculateOdds();
  const winningFinalOdds = finalOdds[winningOutcomeId];
  
  console.log(`EventBet: Финальные коэффициенты:`, finalOdds);
  console.log(`EventBet: Коэффициент победившего исхода: ${winningFinalOdds}`);
  
  if (!winningFinalOdds || winningFinalOdds <= 0) {
    console.error('EventBet: Некорректный финальный коэффициент, используем резервное значение 1.1');
    winningFinalOdds = 1.1;
  }
  
  // Получаем все активные ставки на событие
  const bets = await this.find({
    event: eventId,
    status: 'active'
  }).populate('user');
  
  console.log(`EventBet: Найдено ${bets.length} активных ставок для расчета`);
  
  const results = {
    winningBets: 0,
    losingBets: 0,
    totalPayout: 0,
    totalProfit: 0,
    oddsChanges: {
      totalBets: bets.length,
      avgOddsAtBet: 0,
      finalOdds: winningFinalOdds,
      winnersBenefited: 0,
      winnersLost: 0
    }
  };
  
  let totalOddsAtBet = 0;
  let winningBetsCount = 0;
  
  // Обрабатываем каждую ставку
  for (const bet of bets) {
    if (bet.outcomeId === winningOutcomeId) {
      // Выигрышная ставка - используем финальные коэффициенты
      await bet.markAsWonWithFinalOdds(winningFinalOdds);
      
      // Добавляем выигрыш на баланс пользователя
      bet.user.balance += bet.actualWin;
      await bet.user.save();
      
      results.winningBets++;
      results.totalPayout += bet.actualWin;
      
      // Аналитика изменения коэффициентов
      totalOddsAtBet += bet.oddsAtBet;
      winningBetsCount++;
      
      const oddsChange = winningFinalOdds - bet.oddsAtBet;
      if (oddsChange > 0) {
        results.oddsChanges.winnersBenefited++;
      } else if (oddsChange < 0) {
        results.oddsChanges.winnersLost++;
      }
      
      console.log(`EventBet: Выигрышная ставка ${bet._id} (${bet.betAmount} USDT)`);
      console.log(`  Коэффициент при ставке: ${bet.oddsAtBet}`);
      console.log(`  Финальный коэффициент: ${bet.finalOdds}`);
      console.log(`  Выигрыш: ${bet.actualWin} USDT`);
      
    } else {
      // Проигрышная ставка
      await bet.markAsLost();
      results.losingBets++;
      
      console.log(`EventBet: Проигрышная ставка ${bet._id} (${bet.betAmount} USDT)`);
    }
    
    results.totalProfit += bet.profit;
  }
  
  // Рассчитываем статистику изменения коэффициентов
  if (winningBetsCount > 0) {
    results.oddsChanges.avgOddsAtBet = totalOddsAtBet / winningBetsCount;
  }
  
  console.log(`EventBet: Расчет завершен. Результаты:`, results);
  
  return results;
};

// Индексы для производительности
eventBetSchema.index({ user: 1, createdAt: -1 });
eventBetSchema.index({ event: 1, outcomeId: 1 });
eventBetSchema.index({ status: 1, settledAt: 1 });
eventBetSchema.index({ placedAt: -1 });

const EventBet = mongoose.model('EventBet', eventBetSchema);

module.exports = EventBet;
