// backend/src/models/index.js
const User = require('./user.model');
const Game = require('./game.model');
const Transaction = require('./transaction.model');
const Deposit = require('./deposit.model');
const CrashRound = require('./crash-round.model'); // ДОБАВЛЯЕМ

module.exports = {
  User,
  Game,
  Transaction,
  Deposit,
  CrashRound // ДОБАВЛЯЕМ
};
