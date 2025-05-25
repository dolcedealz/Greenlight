// bot/src/services/index.js
const apiService = require('./api.service');
const paymentService = require('./payment.service');
const notificationService = require('./notification.service');

module.exports = {
  api: apiService,
  payment: paymentService,
  notification: notificationService
};