// backend/src/models/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const User = require('./user.model');
const Game = require('./game.model');
const Transaction = require('./transaction.model');
const Deposit = require('./deposit.model');
const Withdrawal = require('./withdrawal.model');
const CrashRound = require('./crash-round.model');
const CasinoFinance = require('./casino-finance.model');
const ReferralEarning = require('./referral-earning.model');
const ReferralPayout = require('./referral-payout.model');
const GameSettings = require('./game-settings.model');
const PvPDuel = require('./pvp-duel.model');
const Event = require('./Event'); // Добавляем события
const EventBet = require('./EventBet'); // Добавляем ставки на события

module.exports = {
  User,
  Game,
  Transaction,
  Deposit,
  Withdrawal,
  CrashRound,
  CasinoFinance,
  ReferralEarning,
  ReferralPayout,
  GameSettings,
  PvPDuel,
  Event, // Добавляем события
  EventBet // Добавляем ставки на события
};
