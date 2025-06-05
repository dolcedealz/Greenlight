// backend/src/models/game.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameType: {
    type: String,
    enum: ['coin', 'mines', 'crash', 'slots', 'events'], // Добавили 'events'
    required: true
  },
  bet: {
    type: Number,
    required: true,
    min: 0.01
  },
  multiplier: {
    type: Number,
    required: true,
    default: 2.0
  },
  result: {
    type: Object,
    required: true
  },
  win: {
    type: Boolean,
    default: null  // Изменено с required: true на default: null
  },
  profit: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  clientSeed: {
    type: String
  },
  serverSeed: {
    type: String
  },
  serverSeedHashed: {
    type: String
  },
  nonce: {
    type: Number
  },
  gameData: {
    type: Object,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
    required: true
  }
}, {
  timestamps: true
});

// Индексы для ускорения запросов
gameSchema.index({ user: 1, createdAt: -1 });
gameSchema.index({ gameType: 1, createdAt: -1 });
gameSchema.index({ win: 1 });
gameSchema.index({ status: 1 }); // Индекс для поля status для более быстрых запросов

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
