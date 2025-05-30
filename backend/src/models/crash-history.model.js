// backend/src/models/crash-history.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const crashHistorySchema = new Schema({
  roundId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  
  crashPoint: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalBets: {
    type: Number,
    default: 0
  },
  
  totalAmount: {
    type: Number,
    default: 0
  },
  
  totalWinners: {
    type: Number,
    default: 0
  },
  
  totalWinAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Индексы
crashHistorySchema.index({ createdAt: -1 });

const CrashHistory = mongoose.model('CrashHistory', crashHistorySchema);

module.exports = CrashHistory;