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
const PartnerLog = require('./partner-log.model');
const GameSettings = require('./game-settings.model');
const Event = require('./Event');
const EventBet = require('./EventBet');
const Duel = require('./duel.model');
const DuelRound = require('./duel-round.model');
const DuelInvitation = require('./duel-invitation.model');
const Promocode = require('./promocode.model');
const GiveawayPrize = require('./giveaway-prize.model');
const Giveaway = require('./giveaway.model');
const GiveawayParticipation = require('./giveaway-participation.model');

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
  PartnerLog,
  GameSettings,
  Event,
  EventBet,
  Duel,
  DuelRound,
  DuelInvitation,
  Promocode,
  GiveawayPrize,
  Giveaway,
  GiveawayParticipation
};
