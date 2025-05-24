// backend/src/models/deposit.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const depositSchema = new Schema({
  // Связь с пользователем
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ID инвойса от CryptoBot
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Сумма депозита в USDT
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  
  // Статус депозита
  status: {
    type: String,
    enum: ['pending', 'paid', 'expired', 'failed'],
    default: 'pending'
  },
  
  // Данные от CryptoBot
  cryptoBotData: {
    // ID инвойса в системе CryptoBot
    invoiceId: String,
    
    // Хеш транзакции (если есть)
    hash: String,
    
    // Валюта (всегда USDT для нас)
    asset: {
      type: String,
      default: 'USDT'
    },
    
    // Сумма к оплате (может отличаться от amount из-за комиссий)
    payAmount: Number,
    
    // URL для оплаты
    payUrl: String,
    
    // Дата создания инвойса в CryptoBot
    createdAt: Date,
    
    // Дата оплаты (если оплачен)
    paidAt: Date,
    
    // Полные данные webhook от CryptoBot
    webhookData: Schema.Types.Mixed
  },
  
  // Баланс пользователя до и после депозита
  balanceBefore: {
    type: Number,
    default: 0
  },
  
  balanceAfter: {
    type: Number,
    default: 0
  },
  
  // Комментарий или описание
  description: {
    type: String,
    default: 'Пополнение баланса'
  },
  
  // IP адрес пользователя при создании депозита
  userIp: String,
  
  // Метаданные
  metadata: {
    // Источник создания депозита (web, bot, admin)
    source: {
      type: String,
      enum: ['web', 'bot', 'admin'],
      default: 'web'
    },
    
    // ID сессии или другие tracking данные
    sessionId: String,
    
    // Реферальный код, если использовался
    referralCode: String
  },
  
  // Дата обработки платежа
  processedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Автоматически добавляет createdAt и updatedAt
});

// Индексы для быстрого поиска
depositSchema.index({ user: 1, createdAt: -1 });
depositSchema.index({ invoiceId: 1 });
depositSchema.index({ status: 1 });
depositSchema.index({ 'cryptoBotData.hash': 1 });

// Виртуальное поле для проверки истечения срока
depositSchema.virtual('isExpired').get(function() {
  if (this.status !== 'pending') return false;
  
  // Инвойсы истекают через 1 час
  const expirationTime = new Date(this.createdAt.getTime() + 60 * 60 * 1000);
  return new Date() > expirationTime;
});

// Метод для обновления статуса на основе данных CryptoBot
depositSchema.methods.updateFromWebhook = function(webhookData) {
  this.cryptoBotData.webhookData = webhookData;
  
  if (webhookData.status === 'paid') {
    this.status = 'paid';
    this.cryptoBotData.paidAt = new Date(webhookData.paid_at);
    this.cryptoBotData.hash = webhookData.hash;
    this.processedAt = new Date();
  } else if (webhookData.status === 'expired') {
    this.status = 'expired';
  }
  
  return this.save();
};

// Статический метод для поиска депозита по invoiceId
depositSchema.statics.findByInvoiceId = function(invoiceId) {
  return this.findOne({ invoiceId });
};

// Статический метод для получения статистики депозитов пользователя
depositSchema.statics.getUserDepositStats = function(userId) {
  return this.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

const Deposit = mongoose.model('Deposit', depositSchema);

module.exports = Deposit;