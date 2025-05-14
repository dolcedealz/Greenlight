// backend/src/routes/game.routes.js
const express = require('express');
const { gameController } = require('../controllers');
const { telegramAuthMiddleware, validateCoinFlip, validateMinesPlay, validateMinesComplete } = require('../middleware');

const router = express.Router();

// Маршруты для игры "Монетка"
router.post('/coin/play', 
  telegramAuthMiddleware, 
  validateCoinFlip, 
  gameController.playCoinFlip
);

// Маршруты для игры "Мины"
router.post('/mines/play', 
  telegramAuthMiddleware, 
  validateMinesPlay, 
  gameController.playMines
);

router.post('/mines/complete', 
  telegramAuthMiddleware, 
  validateMinesComplete, 
  gameController.completeMinesGame
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