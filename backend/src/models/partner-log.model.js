// backend/src/models/partner-log.model.js
const mongoose = require('mongoose');

const partnerLogSchema = new mongoose.Schema({
  // Пользователь, которому изменили статус
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Админ, который внес изменения
  admin: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Тип действия
  action: {
    type: String,
    enum: ['assign', 'change', 'remove'],
    required: true
  },
  
  // Предыдущий уровень
  previousLevel: {
    type: String,
    enum: ['none', 'partner_bronze', 'partner_silver', 'partner_gold'],
    required: true
  },
  
  // Новый уровень
  newLevel: {
    type: String,
    enum: ['none', 'partner_bronze', 'partner_silver', 'partner_gold'],
    required: true
  },
  
  // Причина изменения
  reason: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Метаданные
  metadata: {
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Индексы для быстрого поиска
partnerLogSchema.index({ user: 1, createdAt: -1 });
partnerLogSchema.index({ admin: 1, createdAt: -1 });
partnerLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('PartnerLog', partnerLogSchema);