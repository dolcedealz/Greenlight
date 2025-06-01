// backend/src/services/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const randomService = require('./random.service');
const gameService = require('./game.service');
const userService = require('./user.service');
const paymentService = require('./payment.service');
const withdrawalService = require('./withdrawal.service');
const oddsService = require('./odds.service');
const casinoFinanceService = require('./casino-finance.service');
const referralService = require('./referral.service');
const crashService = require('./crash.service');
const authService = require('./auth.service');
const pvpService = require('./pvp.service');
const eventService = require('./event.service'); // Добавляем события

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
  pvpService,
  eventService // Добавляем события
};
