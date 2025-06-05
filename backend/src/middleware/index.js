// backend/src/middleware/index.js
const { telegramAuthMiddleware, universalAuthMiddleware, adminAuthMiddleware } = require('./auth.middleware');
const { validateCoinFlip, validateTelegramAuth, validateMinesPlay, validateMinesComplete } = require('./validation.middleware');
const errorMiddleware = require('./error.middleware');
const { bettingLimit, generalLimit, adminLimit, authLimit, createRateLimit } = require('./rateLimiting.middleware');
const { validatePlaceBet, validateCreateEvent, validateFinishEvent, validateObjectId, sanitizeStrings } = require('./eventValidation.middleware');

module.exports = {
  telegramAuthMiddleware,
  universalAuthMiddleware,
  adminAuthMiddleware,
  authMiddleware: telegramAuthMiddleware, // Alias for auth middleware
  validateCoinFlip,
  validateTelegramAuth,
  validateMinesPlay,
  validateMinesComplete,
  errorMiddleware,
  
  // Rate limiting middleware
  bettingLimit,
  generalLimit,
  adminLimit,
  authLimit,
  createRateLimit,
  
  // Event validation middleware
  validatePlaceBet,
  validateCreateEvent,
  validateFinishEvent,
  validateObjectId,
  sanitizeStrings
};