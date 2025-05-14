// user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    sparse: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    default: ''
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  referrer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referralCount: {
    type: Number,
    default: 0
  },
  referralEarnings: {
    type: Number,
    default: 0
  },
  totalWagered: {
    type: Number,
    default: 0
  },
  totalWon: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Новое поле для настроек игр и модификаторов шансов
  gameSettings: {
    coin: {
      winChanceModifier: {
        type: Number,
        default: 0, // модификатор в процентных пунктах (+/- от базового шанса)
        min: -47.5, // не может быть ниже 0% шанса (47.5 базовый)
        max: 52.5,  // не может быть выше 100% шанса
      }
    }
  }
}, {
  timestamps: true
});

// Создаем виртуальное свойство для определения прибыли/убытка
userSchema.virtual('profitLoss').get(function() {
  return this.totalWon - this.totalWagered;
});

// Индексы для быстрого поиска
userSchema.index({ telegramId: 1 });
userSchema.index({ username: 1 });
userSchema.index({ referralCode: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;