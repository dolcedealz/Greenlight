// user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    sparse: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    default: ''
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  // Заблокированные средства для активных операций
  lockedFunds: [{
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      enum: ['duel', 'casino', 'withdrawal'],
      required: true
    },
    lockedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    }
  }],
  isBlocked: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  referrer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  // Подробная статистика реферальной программы
  referralStats: {
    level: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'vip'],
      default: 'bronze'
    },
    commissionPercent: {
      type: Number,
      default: 2
    },
    totalReferrals: {
      type: Number,
      default: 0
    },
    activeReferrals: {
      type: Number,
      default: 0
    },
    totalEarned: {
      type: Number,
      default: 0
    },
    referralBalance: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    levelUpdatedAt: {
      type: Date,
      default: Date.now
    },
    lastPayoutAt: {
      type: Date,
      default: null
    }
  },
  
  // НОВОЕ: Партнерский статус (назначается только админом)
  partnerLevel: {
    type: String,
    enum: ['none', 'partner_bronze', 'partner_silver', 'partner_gold'],
    default: 'none'
  },
  
  // НОВОЕ: Метаданные партнерского статуса
  partnerMeta: {
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    previousLevel: {
      type: String,
      default: null
    }
  },
  totalWagered: {
    type: Number,
    default: 0
  },
  totalWon: {
    type: Number,
    default: 0
  },
  totalGames: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Фриспины от промокодов
  freespins: {
    slots: {
      type: Number,
      default: 0,
      min: 0
    },
    coin: {
      type: Number,
      default: 0,
      min: 0
    },
    mines: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Активные бонусы к депозитам от промокодов
  activeDepositBonuses: [{
    promocodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promocode',
      required: true
    },
    percentage: {
      type: Number,
      required: true,
      min: 1,
      max: 500
    },
    maxBonus: {
      type: Number,
      default: null
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // VIP статус
  isVip: {
    type: Boolean,
    default: false
  },
  vipExpiresAt: {
    type: Date,
    default: null
  },
  // Уровень пользователя
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  // Новое поле для настроек игр и модификаторов шансов
  gameSettings: {
    coin: {
      winChanceModifier: {
        type: Number,
        default: 0, // модификатор в процентных пунктах (+/- от базового шанса)
        min: -47.5, // не может быть ниже 0% шанса (47.5 базовый)
        max: 52.5,  // не может быть выше 100% шанса
      }
    },
    slots: {
      // Модификатор RTP (Return To Player) в процентах
      rtpModifier: {
        type: Number,
        default: 0, // 0 = стандартный RTP
        min: -30, // минимум -30% от базового RTP
        max: 20   // максимум +20% от базового RTP
      }
    },
    mines: {
      // Модификатор шанса на мину
      mineChanceModifier: {
        type: Number,
        default: 0,
        min: -20, // меньше мин = легче игра
        max: 30   // больше мин = сложнее игра
      }
    },
    crash: {
      // Модификатор шанса раннего краша
      crashModifier: {
        type: Number,
        default: 0,
        min: -20, // реже крашится рано
        max: 50   // чаще крашится рано
      }
    }
  }
}, {
  timestamps: true
});

// Функция для генерации уникального реферального кода
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Pre-save middleware для автоматической генерации реферального кода
userSchema.pre('save', async function(next) {
  // Генерируем реферальный код если его нет
  if (!this.referralCode) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      const code = generateReferralCode();
      const existingUser = await this.constructor.findOne({ referralCode: code });
      
      if (!existingUser) {
        this.referralCode = code;
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      const timestamp = Date.now().toString(36).toUpperCase();
      this.referralCode = 'REF' + timestamp.slice(-5);
    }
  }
  
  // Инициализируем referralStats если их нет
  if (!this.referralStats) {
    this.referralStats = {
      level: 'bronze',
      commissionPercent: 5,
      totalReferrals: 0,
      activeReferrals: 0,
      totalEarned: 0,
      referralBalance: 0,
      totalWithdrawn: 0,
      levelUpdatedAt: new Date(),
      lastPayoutAt: null
    };
  }
  
  next();
});

// Создаем виртуальное свойство для определения прибыли/убытка
userSchema.virtual('profitLoss').get(function() {
  return this.totalWon - this.totalWagered;
});

// Индексы для быстрого поиска
userSchema.index({ telegramId: 1 });
userSchema.index({ username: 1 });
userSchema.index({ referralCode: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;