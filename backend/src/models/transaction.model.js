// transaction.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'referral', 'bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  game: {
    type: Schema.Types.ObjectId,
    ref: 'Game'
  },
  payment: {
    // Данные о платеже (для депозитов и выводов)
    invoiceId: String,
    paymentMethod: String,
    externalReference: String,
    fee: Number
  },
  description: {
    type: String
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Индексы
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ 'payment.invoiceId': 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;