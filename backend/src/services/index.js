// backend/src/services/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const gameService = require('./game.service');
const userService = require('./user.service');
const adminService = require('./admin.service');
const paymentService = require('./payment.service');
const withdrawalService = require('./withdrawal.service');
const financeService = require('./finance.service');
const casinoFinanceService = require('./casino-finance.service');
const referralService = require('./referral.service');
const crashService = require('./crash.service');
const authService = require('./auth.service');
const eventService = require('./event.service'); // Добавляем сервис событий

module.exports = {
  gameService,
  userService,
  adminService,
  paymentService,
  withdrawalService,
  financeService,
  casinoFinanceService,
  referralService,
  crashService,
  authService,
  eventService // Добавляем сервис событий
};
