// game.routes.js
const express = require('express');
const { gameController } = require('../controllers');
const { telegramAuthMiddleware, validateCoinFlip } = require('../middleware');

const router = express.Router();

// Маршруты для игры "Монетка"
router.post('/coin/play', 
  telegramAuthMiddleware, 
  validateCoinFlip, 
  gameController.playCoinFlip
);

// Маршруты для получения истории игр
router.get('/history', 
  telegramAuthMiddleware, 
  gameController.getUserGames
);

// Маршруты для получения статистики игр
router.get('/stats', 
  telegramAuthMiddleware, 
  gameController.getUserGameStats
);

module.exports = router;