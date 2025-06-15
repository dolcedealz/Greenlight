// backend/src/models/giveaway-prize.model.js
const mongoose = require('mongoose');

const giveawayPrizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['telegram_gift', 'promo_code', 'balance_bonus'],
    required: true
  },
  value: {
    type: Number,
    min: 0
  },
  giftData: {
    telegramGiftId: String,
    giftStickerId: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

giveawayPrizeSchema.index({ type: 1 });
giveawayPrizeSchema.index({ isActive: 1 });

module.exports = mongoose.model('GiveawayPrize', giveawayPrizeSchema);