// backend/src/routes/auth.routes.js
const express = require('express');
const { authController } = require('../controllers');
const { telegramAuthMiddleware, authLimit } = require('../middleware');

const router = express.Router();

/**
 * CB5=B8D8:0F8O ?>;L7>20B5;O G5@57 Telegram WebApp
 * POST /api/auth/telegram
 * 
 * Body:
 * - initData (string, required) - 0==K5 8=8F80;870F88 >B Telegram WebApp
 * - referralCode (string, optional) -  5D5@0;L=K9 :>4
 */
router.post('/telegram', authLimit, authController.authenticateWithTelegram);

/**
 * 1=>2;5=85 JWT B>:5=0
 * POST /api/auth/refresh
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
router.post('/refresh', authController.refreshToken);

/**
 * >;CG5=85 8=D>@<0F88 > B5:CI5< ?>;L7>20B5;5
 * GET /api/auth/me
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
router.get('/me', telegramAuthMiddleware, authController.getCurrentUser);

/**
 * 0;840F8O Telegram 40==KE (4;O >B;04:8)
 * POST /api/auth/validate
 * 
 * Body:
 * - initData (string, required) - 0==K5 4;O 20;840F88
 */
router.post('/validate', authController.validateTelegramData);

/**
 * Health check 4;O auth A5@28A0
 * GET /api/auth/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'auth',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;