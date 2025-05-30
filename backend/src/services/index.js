// backend/src/services/index.js
const randomService = require('./random.service');
const gameService = require('./game.service');
const userService = require('./user.service');
const paymentService = require('./payment.service');
const withdrawalService = require('./withdrawal.service');
const oddsService = require('./odds.service');
const casinoFinanceService = require('./casino-finance.service');
const referralService = require('./referral.service');
const crashService = require('./crash.service');
const authService = require('./auth.service'); // ДОБАВЛЯЕМ
const pvpService = require('./pvp.service'); // ДОБАВЛЯЕМ PvP

module.exports = {
  randomService,
  gameService,
  userService,
  paymentService,
  withdrawalService,
  oddsService,
  casinoFinanceService,
  referralService,
  crashService,
  authService,
  pvpService // ДОБАВЛЯЕМ PvP
};
