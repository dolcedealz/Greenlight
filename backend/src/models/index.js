// backend/src/models/index.js
const User = require('./user.model');
const Game = require('./game.model');
const Transaction = require('./transaction.model');
const Deposit = require('./deposit.model');
const Withdrawal = require('./withdrawal.model'); // ДОБАВЛЯЕМ
const CrashRound = require('./crash-round.model');

module.exports = {
  User,
  Game,
  Transaction,
  Deposit,
  Withdrawal, // ДОБАВЛЯЕМ
  CrashRound
};