// backend/src/controllers/index.js
const gameController = require('./game.controller');
const userController = require('./user.controller');
const adminController = require('./admin.controller');
const paymentController = require('./payment.controller');
const withdrawalController = require('./withdrawal.controller');
const financeController = require('./finance.controller');
const referralController = require('./referral.controller');
const crashController = require('./crash.controller');
const authController = require('./auth.controller'); // ДОБАВЛЯЕМ
const pvpController = require('./pvp.controller'); // ДОБАВЛЯЕМ PvP

module.exports = {
  gameController,
  userController,
  adminController,
  paymentController,
  withdrawalController,
  financeController,
  referralController,
  crashController,
  authController,
  pvpController // ДОБАВЛЯЕМ PvP
};
