// index.js
const { telegramAuthMiddleware, adminAuthMiddleware } = require('./auth.middleware');
const { validateCoinFlip, validateTelegramAuth } = require('./validation.middleware');
const errorMiddleware = require('./error.middleware');

module.exports = {
  telegramAuthMiddleware,
  adminAuthMiddleware,
  validateCoinFlip,
  validateTelegramAuth,
  errorMiddleware
};