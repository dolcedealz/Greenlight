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
const eventService = require('./event.service');
const duelService = require('./duel.service');
const oddsService = require('./odds.service');

// Безопасная загрузка сервиса мониторинга
let balanceMonitoringService;
try {
  balanceMonitoringService = require('./balance-monitoring.service');
} catch (error) {
  console.error('Ошибка загрузки balance monitoring service:', error.message);
  balanceMonitoringService = null;
}

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
  eventService,
  duelService,
  oddsService,
  balanceMonitoringService
};
