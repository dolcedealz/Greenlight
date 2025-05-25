// backend/src/services/index.js
const randomService = require('./random.service');
const gameService = require('./game.service');
const userService = require('./user.service');
const paymentService = require('./payment.service');
const withdrawalService = require('./withdrawal.service'); // ДОБАВЛЯЕМ
const oddsService = require('./odds.service');

module.exports = {
  randomService,
  gameService,
  userService,
  paymentService,
  withdrawalService, // ДОБАВЛЯЕМ
  oddsService
};