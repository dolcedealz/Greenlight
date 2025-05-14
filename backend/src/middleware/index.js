// backend/src/middleware/index.js
const { telegramAuthMiddleware, adminAuthMiddleware } = require('./auth.middleware');
const { validateCoinFlip, validateTelegramAuth, validateMinesPlay, validateMinesComplete } = require('./validation.middleware');
const errorMiddleware = require('./error.middleware');

module.exports = {
  telegramAuthMiddleware,
  adminAuthMiddleware,
  validateCoinFlip,
  validateTelegramAuth,
  validateMinesPlay,
  validateMinesComplete,
  errorMiddleware
};