// backend/src/models/casino-finance.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const casinoFinanceSchema = new Schema({
  // Основные балансы
  totalUserBalance: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма балансов всех пользователей'
  },
  
  operationalBalance: {
    type: Number,
    default: 0,
    description: 'Оперативный счет (комиссии + проигрыши - выигрыши)'
  },
  
  reserveBalance: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Резервный фонд (% от оперативного счета)'
  },
  
  availableForWithdrawal: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Доступно для вывода как прибыль'
  },
  
  // Настройки резервирования
  reservePercentage: {
    type: Number,
    default: 30,
    min: 0,
    max: 100,
    description: 'Процент резервирования от оперативного счета'
  },
  
  // Статистика по играм
  totalBets: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма ставок'
  },
  
  totalWins: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма выигрышей'
  },
  
  totalCommissions: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма комиссий'
  },
  
  // Детализация комиссий
  commissionBreakdown: {
    duels: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Комиссии с PvP дуэлей'
    },
    events: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Прибыль с маржи событий'
    }
  },
  
  // Расходы на промокоды
  totalPromocodeExpenses: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма расходов на промокоды'
  },
  
  // Статистика по платежам
  totalDeposits: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма депозитов'
  },
  
  totalWithdrawals: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма выводов пользователей'
  },
  
  totalOwnerWithdrawals: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма выводов владельца'
  },
  
  // Реферальные выплаты
  totalReferralPayments: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма реферальных выплат'
  },
  
  // НОВОЕ: Комиссии CryptoBot
  totalCryptoBotFees: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Общая сумма комиссий CryptoBot (депозиты + выводы)'
  },
  
  // Детализация по играм
  gameStats: {
    coin: {
      totalBets: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      totalGames: { type: Number, default: 0 },
      profit: { type: Number, default: 0 }
    },
    mines: {
      totalBets: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      totalGames: { type: Number, default: 0 },
      profit: { type: Number, default: 0 }
    },
    slots: {
      totalBets: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      totalGames: { type: Number, default: 0 },
      profit: { type: Number, default: 0 }
    },
    crash: {
      totalBets: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      totalGames: { type: Number, default: 0 },
      profit: { type: Number, default: 0 }
    },
    events: {
      totalBets: { type: Number, default: 0 },
      totalWins: { type: Number, default: 0 },
      totalGames: { type: Number, default: 0 },
      profit: { type: Number, default: 0 },
      totalEventBets: { type: Number, default: 0 },
      totalPayouts: { type: Number, default: 0 }
    }
  },
  
  // История изменений
  balanceHistory: [{
    timestamp: { type: Date, default: Date.now },
    totalUserBalance: Number,
    operationalBalance: Number,
    reserveBalance: Number,
    availableForWithdrawal: Number,
    event: String, // 'deposit', 'withdrawal', 'game_win', 'game_loss', etc.
    details: Schema.Types.Mixed
  }],
  
  // Флаги и предупреждения
  warnings: {
    lowReserve: {
      type: Boolean,
      default: false,
      description: 'Резерв ниже рекомендуемого уровня'
    },
    highRiskRatio: {
      type: Boolean,
      default: false,
      description: 'Высокое соотношение балансов к резерву'
    },
    negativeOperational: {
      type: Boolean,
      default: false,
      description: 'Отрицательный оперативный баланс'
    }
  },
  
  // Последние обновления
  lastCalculated: {
    type: Date,
    default: Date.now,
    description: 'Время последнего пересчета'
  },
  
  lastOwnerWithdrawal: {
    type: Date,
    default: null,
    description: 'Время последнего вывода владельцем'
  }
}, {
  timestamps: true
});

// Индексы
casinoFinanceSchema.index({ lastCalculated: -1 });
casinoFinanceSchema.index({ 'balanceHistory.timestamp': -1 });

// Методы
casinoFinanceSchema.methods.calculateAvailableForWithdrawal = function() {
  // Рассчитываем доступную для вывода сумму
  // Оперативный баланс минус резерв
  this.availableForWithdrawal = Math.max(0, this.operationalBalance - this.reserveBalance);
  return this.availableForWithdrawal;
};

casinoFinanceSchema.methods.calculateReserve = function() {
  // Рассчитываем резерв на основе процента
  if (this.operationalBalance > 0) {
    this.reserveBalance = this.operationalBalance * (this.reservePercentage / 100);
  } else {
    this.reserveBalance = 0;
  }
  this.calculateAvailableForWithdrawal();
  return this.reserveBalance;
};

casinoFinanceSchema.methods.checkWarnings = function() {
  // Проверяем предупреждения
  
  // Низкий резерв относительно балансов пользователей
  this.warnings.lowReserve = this.reserveBalance < (this.totalUserBalance * 0.1);
  
  // Высокое соотношение балансов к резерву
  const riskRatio = this.totalUserBalance / (this.reserveBalance || 1);
  this.warnings.highRiskRatio = riskRatio > 10;
  
  // Отрицательный оперативный баланс
  this.warnings.negativeOperational = this.operationalBalance < 0;
  
  return this.warnings;
};

casinoFinanceSchema.methods.addToHistory = function(event, details = {}) {
  // Добавляем запись в историю
  this.balanceHistory.push({
    timestamp: new Date(),
    totalUserBalance: this.totalUserBalance,
    operationalBalance: this.operationalBalance,
    reserveBalance: this.reserveBalance,
    availableForWithdrawal: this.availableForWithdrawal,
    event,
    details
  });
  
  // Ограничиваем историю последними 1000 записями
  if (this.balanceHistory.length > 1000) {
    this.balanceHistory = this.balanceHistory.slice(-1000);
  }
};

// Статические методы
casinoFinanceSchema.statics.getInstance = async function() {
  // Получаем единственный экземпляр финансовой статистики
  let finance = await this.findOne();
  
  if (!finance) {
    // Создаем новый, если не существует
    finance = new this({
      commissionBreakdown: {
        duels: 0,
        events: 0
      }
    });
    await finance.save();
  }
  
  // Убеждаемся, что commissionBreakdown инициализирован
  if (!finance.commissionBreakdown) {
    finance.commissionBreakdown = {
      duels: 0,
      events: 0
    };
    await finance.save();
  }
  
  return finance;
};

const CasinoFinance = mongoose.model('CasinoFinance', casinoFinanceSchema);

module.exports = CasinoFinance;