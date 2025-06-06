const mongoose = require('mongoose');

const duelInvitationSchema = new mongoose.Schema({
  // Уникальный ID приглашения
  inviteId: {
    type: String,
    unique: true,
    required: true,
    default: () => `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Создатель приглашения
  challengerId: {
    type: String,
    required: true
  },
  challengerUsername: {
    type: String,
    required: true
  },
  
  // Целевой пользователь (может быть null для открытых приглашений)
  targetUserId: {
    type: String,
    default: null
  },
  targetUsername: {
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
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  
  // Статус приглашения
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
    default: 'pending'
  },
  
  // Связанная дуэль (устанавливается при принятии)
  duelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Duel',
    default: null
  },
  
  // Временные ограничения
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 минут
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  
  // Источник приглашения
  source: {
    type: String,
    enum: ['inline', 'direct', 'group'],
    default: 'inline'
  },
  
  // Контекст (chat где было создано приглашение)
  contextChatId: {
    type: String,
    default: null
  },
  contextMessageId: {
    type: Number,
    default: null
  },
  
  // Telegram данные
  inviteMessageId: {
    type: Number,
    default: null
  },
  sourceMessageId: {
    type: Number,
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
duelInvitationSchema.index({ inviteId: 1 });
duelInvitationSchema.index({ challengerId: 1 });
duelInvitationSchema.index({ targetUserId: 1 });
duelInvitationSchema.index({ targetUsername: 1 });
duelInvitationSchema.index({ status: 1 });
duelInvitationSchema.index({ expiresAt: 1 });
duelInvitationSchema.index({ createdAt: -1 });

// Виртуальные поля
duelInvitationSchema.virtual('gameName').get(function() {
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

duelInvitationSchema.virtual('formatName').get(function() {
  const formatNames = {
    'bo1': 'Bo1 (1 раунд)',
    'bo3': 'Bo3 (до 2 побед)',
    'bo5': 'Bo5 (до 3 побед)',
    'bo7': 'Bo7 (до 4 побед)'
  };
  return formatNames[this.format] || 'Bo1';
});

// Методы экземпляра
duelInvitationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

duelInvitationSchema.methods.canAccept = function(userId, username = null) {
  if (this.status !== 'pending' || this.isExpired()) {
    return false;
  }
  
  // Нельзя принять собственное приглашение
  if (this.challengerId === userId) {
    return false;
  }
  
  // Если приглашение адресовано конкретному пользователю
  if (this.targetUserId && this.targetUserId !== userId) {
    return false;
  }
  
  // Если приглашение адресовано по username
  if (this.targetUsername && username && this.targetUsername !== username) {
    return false;
  }
  
  return true;
};

duelInvitationSchema.methods.canCancel = function(userId) {
  return this.status === 'pending' && 
         this.challengerId === userId &&
         !this.isExpired();
};

duelInvitationSchema.methods.getInviteText = function() {
  const target = this.targetUsername ? `@${this.targetUsername}` : 'любого игрока';
  return `🎮 **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** 🎮\n\n` +
         `${this.gameType} **${this.gameName}** ${this.gameType}\n` +
         `👤 От: @${this.challengerUsername}\n` +
         `🎯 Вызывает: ${target}\n` +
         `💰 Ставка: ${this.amount} USDT каждый\n` +
         `🏆 Формат: ${this.formatName}\n` +
         `⏱ Действует до: ${this.expiresAt.toLocaleTimeString('ru')}`;
};

// Статические методы
duelInvitationSchema.statics.cleanupExpired = async function() {
  const expiredInvitations = await this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
  
  await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
  
  return expiredInvitations.length;
};

duelInvitationSchema.statics.findActiveByUser = async function(userId) {
  return await this.find({
    $or: [
      { challengerId: userId },
      { targetUserId: userId },
      { targetUserId: null } // Открытые приглашения
    ],
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

// Хуки модели
duelInvitationSchema.pre('save', function(next) {
  // Автоматически устанавливаем статус expired для истекших приглашений
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }
  
  // Устанавливаем время принятия
  if (this.isModified('status') && this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('DuelInvitation', duelInvitationSchema);