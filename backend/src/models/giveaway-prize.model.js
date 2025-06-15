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
    giftStickerId: String,
    originalUrl: String,
    giftId: String,
    rarity: String,
    collection: String,
    attributes: [{
      trait_type: String,
      value: String
    }],
    totalSupply: Number,
    currentSupply: Number,
    imageUrl: String, // Прямая ссылка на изображение
    imageValid: Boolean,
    parsedAt: Date
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

// Виртуальное поле для imageUrl
giveawayPrizeSchema.virtual('imageUrl').get(function() {
  // Приоритет: giftData.imageUrl > image
  return this.giftData?.imageUrl || this.image;
});

// Включаем виртуальные поля в JSON
giveawayPrizeSchema.set('toJSON', { virtuals: true });
giveawayPrizeSchema.set('toObject', { virtuals: true });

giveawayPrizeSchema.index({ type: 1 });
giveawayPrizeSchema.index({ isActive: 1 });

module.exports = mongoose.model('GiveawayPrize', giveawayPrizeSchema);