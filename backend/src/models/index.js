// backend/src/models/index.js
const User = require('./user.model');
const Game = require('./game.model');
const Transaction = require('./transaction.model');
const Deposit = require('./deposit.model'); // Добавляем модель депозитов

module.exports = {
  User,
  Game,
  Transaction,
  Deposit
};