// backend/src/controllers/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const gameController = require('./game.controller');
const userController = require('./user.controller');
const adminController = require('./admin.controller');
const paymentController = require('./payment.controller');
const withdrawalController = require('./withdrawal.controller');
const financeController = require('./finance.controller');
const referralController = require('./referral.controller');
const crashController = require('./crash.controller');
const authController = require('./auth.controller');
const eventController = require('./event.controller'); // Добавляем события
const monitoringController = require('./monitoring.controller');

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
  eventController, // Добавляем события
  monitoringController
};
