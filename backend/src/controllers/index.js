// backend/src/controllers/index.js
const gameController = require('./game.controller');
const userController = require('./user.controller');
const adminController = require('./admin.controller');
const paymentController = require('./payment.controller');
const withdrawalController = require('./withdrawal.controller'); // ДОБАВЛЯЕМ

module.exports = {
  gameController,
  userController,
  adminController,
  paymentController,
  withdrawalController // ДОБАВЛЯЕМ
};