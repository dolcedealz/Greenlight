// backend/src/models/withdrawal.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const withdrawalSchema = new Schema({
  // Связь с пользователем
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Сумма вывода в USDT
  amount: {
    type: Number,
    required: true,
    min: 1 // Минимальная сумма вывода 1 USDT
  },
  
  // Адрес или username получателя для CryptoBot
  recipient: {
    type: String,
    required: true,
    trim: true
  },
  
  // Тип получателя
  recipientType: {
    type: String,
    enum: ['username', 'wallet'],
    required: true
  },
  
  // Статус вывода
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending'
  },
  
  // Требует ли одобрения администратора
  requiresApproval: {
    type: Boolean,
    default: false
  },
  
  // ID администратора, который одобрил/отклонил
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Дата одобрения/отклонения
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Причина отклонения (если отклонено)
  rejectionReason: {
    type: String,
    default: null
  },
  
  // Данные от CryptoBot
  cryptoBotData: {
    // ID перевода в системе CryptoBot
    transferId: String,
    
    // Хеш транзакции (если есть)
    hash: String,
    
    // Комиссия
    fee: Number,
    
    // Итоговая сумма с учетом комиссии
    totalAmount: Number,
    
    // Дата создания перевода
    createdAt: Date,
    
    // Дата завершения перевода
    completedAt: Date,
    
    // Полные данные ответа от CryptoBot
    responseData: Schema.Types.Mixed
  },
  
  // Баланс пользователя до и после вывода
  balanceBefore: {
    type: Number,
    required: true
  },
  
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Комиссия платформы (если есть)
  platformFee: {
    type: Number,
    default: 0
  },
  
  // Итоговая сумма к получению пользователем
  netAmount: {
    type: Number,
    required: true
  },
  
  // Комментарий от пользователя
  comment: {
    type: String,
    maxlength: 500
  },
  
  // IP адрес пользователя при создании запроса
  userIp: String,
  
  // Метаданные
  metadata: {
    // Источник создания вывода (web, bot, admin)
    source: {
      type: String,
      enum: ['web', 'bot', 'admin'],
      default: 'web'
    },
    
    // ID сессии или другие tracking данные
    sessionId: String,
    
    // Дополнительные данные для безопасности
    userAgent: String,
    
    // Флаг подозрительной активности
    suspicious: {
      type: Boolean,
      default: false
    },
    
    // Причина подозрения
    suspicionReason: String
  },
  
  // Дата обработки вывода
  processedAt: {
    type: Date,
    default: null
  },
  
  // Количество попыток обработки
  processingAttempts: {
    type: Number,
    default: 0
  },
  
  // Последняя ошибка при обработке
  lastError: {
    message: String,
    details: Schema.Types.Mixed, // Добавляем поле для деталей ошибки
    timestamp: Date
  }
}, {
  timestamps: true // Автоматически добавляет createdAt и updatedAt
});

// Индексы для быстрого поиска
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ requiresApproval: 1, status: 1 });
withdrawalSchema.index({ 'cryptoBotData.transferId': 1 });

// Виртуальное поле для проверки истечения срока
withdrawalSchema.virtual('isExpired').get(function() {
  if (this.status !== 'pending') return false;
  
  // Выводы истекают через 24 часа
  const expirationTime = new Date(this.createdAt.getTime() + 24 * 60 * 60 * 1000);
  return new Date() > expirationTime;
});

// Метод для проверки возможности обработки
withdrawalSchema.methods.canProcess = function() {
  // Можно обработать если:
  // 1. Статус 'approved' (для больших сумм)
  // 2. Статус 'pending' и не требует одобрения (для малых сумм)
  return (this.status === 'approved') || 
         (this.status === 'pending' && !this.requiresApproval);
};

// Метод для одобрения вывода
withdrawalSchema.methods.approve = async function(adminId) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Метод для отклонения вывода
withdrawalSchema.methods.reject = async function(adminId, reason) {
  this.status = 'rejected';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Метод для обновления статуса после обработки
withdrawalSchema.methods.markAsProcessing = async function() {
  this.status = 'processing';
  this.processingAttempts += 1;
  return this.save();
};

// Метод для завершения вывода
withdrawalSchema.methods.complete = async function(cryptoBotData) {
  this.status = 'completed';
  this.processedAt = new Date();
  this.cryptoBotData = {
    ...this.cryptoBotData,
    ...cryptoBotData,
    completedAt: new Date()
  };
  return this.save();
};

// Метод для отметки как неудачного
withdrawalSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  this.lastError = {
    message: error.message || error,
    timestamp: new Date()
  };
  return this.save();
};

// Статический метод для получения выводов, требующих одобрения
withdrawalSchema.statics.getPendingApprovals = function() {
  return this.find({
    status: 'pending',
    requiresApproval: true
  })
  .populate('user', 'telegramId username firstName lastName balance')
  .sort({ createdAt: -1 });
};

// Статический метод для получения статистики выводов
withdrawalSchema.statics.getWithdrawalStats = function(userId = null) {
  const match = userId ? { user: userId } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

// Проверка лимитов перед сохранением
withdrawalSchema.pre('save', function(next) {
  // Определяем, требует ли одобрения на основе суммы
  if (this.isNew) {
    this.requiresApproval = this.amount > 300;
    
    // Вычисляем чистую сумму (можно добавить комиссию платформы)
    this.netAmount = this.amount - this.platformFee;
  }
  
  next();
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;