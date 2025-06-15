// backend/src/models/giveaway.model.js
const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true
  },
  prize: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiveawayPrize',
    required: true
  },
  winnersCount: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  drawDate: {
    type: Date,
    required: true
  },
  requiresDeposit: {
    type: Boolean,
    default: true
  },
  depositTimeframe: {
    type: String,
    enum: ['same_day', 'same_week', 'any_time'],
    default: 'same_day'
  },
  participationCount: {
    type: Number,
    default: 0
  },
  telegramMessageId: {
    type: String
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  diceResult: {
    value: Number,
    messageId: String,
    timestamp: Date
  },
  winners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    position: Number,
    selectedAt: Date,
    notified: {
      type: Boolean,
      default: false
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

giveawaySchema.index({ type: 1, status: 1 });
giveawaySchema.index({ drawDate: 1 });
giveawaySchema.index({ status: 1 });
giveawaySchema.index({ 'winners.user': 1 });

module.exports = mongoose.model('Giveaway', giveawaySchema);