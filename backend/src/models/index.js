// backend/src/models/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const User = require('./user.model');
const Game = require('./game.model');
const Transaction = require('./transaction.model');
const Deposit = require('./deposit.model');
const Withdrawal = require('./withdrawal.model');
const CrashRound = require('./crash-round.model');
const CasinoFinance = require('./casino-finance.model'); // ДОБАВЛЯЕМ

module.exports = {
  User,
  Game,
  Transaction,
  Deposit,
  Withdrawal,
  CrashRound,
  CasinoFinance // ДОБАВЛЯЕМ
};