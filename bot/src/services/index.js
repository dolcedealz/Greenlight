// index.js
const apiService = require('./api.service');
const paymentService = require('./payment.service');

module.exports = {
  api: apiService,
  payment: paymentService
};