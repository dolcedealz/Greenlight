// backend/src/models/giveaway-participation.model.js
const mongoose = require('mongoose');

const giveawayParticipationSchema = new mongoose.Schema({
  giveaway: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Giveaway',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deposit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deposit',
    required: true
  },
  depositAmount: {
    type: Number,
    required: true,
    min: 0
  },
  depositDate: {
    type: Date,
    required: true
  },
  participationNumber: {
    type: Number,
    required: true
  },
  isWinner: {
    type: Boolean,
    default: false
  },
  winnerPosition: {
    type: Number
  },
  status: {
    type: String,
    enum: ['active', 'winner', 'not_winner'],
    default: 'active'
  }
}, {
  timestamps: true
});

giveawayParticipationSchema.index({ giveaway: 1, user: 1 }, { unique: true });
giveawayParticipationSchema.index({ giveaway: 1, participationNumber: 1 });
giveawayParticipationSchema.index({ user: 1, createdAt: -1 });
giveawayParticipationSchema.index({ giveaway: 1, isWinner: 1 });

module.exports = mongoose.model('GiveawayParticipation', giveawayParticipationSchema);