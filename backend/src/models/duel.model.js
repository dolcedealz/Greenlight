const mongoose = require('mongoose');

const duelSchema = new mongoose.Schema({
  // Базовая информация о дуэли
  sessionId: {
    type: String,
    unique: true,
    required: true,
    default: () => `duel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Участники дуэли
  challengerId: {
    type: String,
    required: true
  },
  challengerUsername: {
    type: String,
    required: true
  },
  opponentId: {
    type: String,
    default: null
  },
  opponentUsername: {
    type: String,
    default: null
  },
  
  // Настройки игры
  gameType: {
    type: String,
    enum: ['🎲', '🎯', '⚽', '⚽️', '🏀', '🎳', '🎰'],
    required: true
  },
  format: {
    type: String,
    enum: ['bo1', 'bo3', 'bo5', 'bo7'],
    default: 'bo1'
  },
  winsRequired: {
    type: Number,
    required: true
  },
  
  // Финансовая информация
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  totalAmount: {
    type: Number,
    required: true
  },
  winAmount: {
    type: Number,
    required: true
  },
  commission: {
    type: Number,
    required: true
  },
  
  // Статус дуэли
  status: {
    type: String,
    enum: ['pending', 'accepted', 'active', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  
  // Результаты
  winnerId: {
    type: String,
    default: null
  },
  winnerUsername: {
    type: String,
    default: null
  },
  challengerScore: {
    type: Number,
    default: 0
  },
  opponentScore: {
    type: Number,
    default: 0
  },
  
  // Раунды дуэли
  rounds: [{
    roundNumber: {
      type: Number,
      required: true
    },
    challengerResult: {
      type: Number,
      default: null
    },
    opponentResult: {
      type: Number,
      default: null
    },
    winnerId: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Информация о чате
  chatId: {
    type: String,
    required: true
  },
  chatType: {
    type: String,
    enum: ['private', 'group', 'supergroup', 'channel'],
    required: true
  },
  messageId: {
    type: Number,
    default: null
  },
  
  // Временные ограничения
  expiresAt: {
    type: Date,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  
  // Метаданные
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Индексы
duelSchema.index({ sessionId: 1 });
duelSchema.index({ challengerId: 1 });
duelSchema.index({ opponentId: 1 });
duelSchema.index({ status: 1 });
duelSchema.index({ chatId: 1 });
duelSchema.index({ winnerId: 1 });
duelSchema.index({ gameType: 1 });
duelSchema.index({ createdAt: -1 });

// Виртуальные поля
duelSchema.virtual('gameName').get(function() {
  const gameNames = {
    '🎲': 'Кости',
    '🎯': 'Дартс',
    '⚽': 'Футбол',
    '⚽️': 'Футбол',
    '🏀': 'Баскетбол',
    '🎳': 'Боулинг',
    '🎰': 'Слоты'
  };
  return gameNames[this.gameType] || 'Неизвестная игра';
});

duelSchema.virtual('formatName').get(function() {
  const formatNames = {
    'bo1': 'Bo1 (1 раунд)',
    'bo3': 'Bo3 (до 2 побед)',
    'bo5': 'Bo5 (до 3 побед)',
    'bo7': 'Bo7 (до 4 побед)'
  };
  return formatNames[this.format] || 'Неизвестный формат';
});

// Методы экземпляра
duelSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

duelSchema.methods.canAccept = function(userId, username = null) {
  // Основные проверки
  if (this.status !== 'pending' || this.isExpired() || this.challengerId === userId) {
    return false;
  }
  
  // Проверяем, что место оппонента свободно
  if (this.opponentId && this.opponentId !== userId) {
    return false;
  }
  
  // 🔒 КРИТИЧЕСКАЯ ПРОВЕРКА: Направленная дуэль
  if (this.opponentUsername && username && this.opponentUsername !== username) {
    console.warn(`🚫 DUEL SECURITY: Пользователь ${username} пытается принять дуэль, предназначенную для ${this.opponentUsername}`);
    return false;
  }
  
  return true;
};

duelSchema.methods.isParticipant = function(userId) {
  return this.challengerId === userId || this.opponentId === userId;
};

// Хуки модели
duelSchema.pre('save', function(next) {
  // Рассчитываем финансовые поля
  if (this.isNew || this.isModified('amount')) {
    this.totalAmount = this.amount * 2;
    this.winAmount = this.totalAmount * 0.95;
    this.commission = this.totalAmount * 0.05;
  }
  
  // Устанавливаем количество побед для формата
  if (this.isNew || this.isModified('format')) {
    const winsMap = { bo1: 1, bo3: 2, bo5: 3, bo7: 4 };
    this.winsRequired = winsMap[this.format] || 1;
  }
  
  // Устанавливаем время истечения (5 минут для приглашений)
  if (this.isNew && this.status === 'pending') {
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  }
  
  // Устанавливаем время начала при принятии дуэли
  if (this.isModified('status') && this.status === 'active' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Устанавливаем время завершения при завершении дуэли
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Duel', duelSchema);