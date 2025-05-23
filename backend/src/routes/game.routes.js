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

// Маршрут для игры "Слоты"
router.post('/slots/play', 
  telegramAuthMiddleware, 
  gameController.playSlots
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

// Отладочный маршрут для проверки расчета множителя
// Доступен без авторизации для упрощения тестирования
router.get('/debug/mines/multiplier', (req, res) => {
  const { minesCount = 5, revealed = 0, betAmount = 1 } = req.query;
  
  // Преобразуем параметры в числа
  const minesCountNum = parseInt(minesCount, 10);
  const revealedNum = parseInt(revealed, 10);
  const betAmountNum = parseFloat(betAmount);
  
  // Проверка корректности входных данных
  if (isNaN(minesCountNum) || isNaN(revealedNum) || isNaN(betAmountNum)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректные параметры запроса'
    });
  }
  
  if (minesCountNum < 1 || minesCountNum > 24) {
    return res.status(400).json({
      success: false,
      message: 'Количество мин должно быть от 1 до 24'
    });
  }
  
  // Расчет множителя по формуле
  const safeTotal = 25 - minesCountNum;
  const remainingCount = safeTotal - revealedNum;
  
  // Проверка, что не пытаемся открыть больше ячеек, чем доступно безопасных
  if (revealedNum >= safeTotal) {
    return res.status(400).json({
      success: false,
      message: 'Количество открытых ячеек не может быть больше или равно количеству безопасных ячеек'
    });
  }
  
  // Рассчитываем множитель
  const multiplier = (safeTotal / remainingCount) * 0.95;
  
  // Рассчитываем выигрыш для указанной ставки
  const winAmount = betAmountNum * multiplier;
  const profit = winAmount - betAmountNum;
  
  // Рассчитываем множитель для каждой возможной открытой ячейки
  const multiplierTable = [];
  for (let i = 0; i <= safeTotal; i++) {
    if (i === safeTotal) {
      multiplierTable.push({
        revealed: i,
        multiplier: safeTotal * 0.95,
        formula: `${safeTotal} * 0.95`
      });
    } else {
      const m = (safeTotal / (safeTotal - i)) * 0.95;
      multiplierTable.push({
        revealed: i,
        multiplier: m,
        formula: `(${safeTotal}/${safeTotal - i})*0.95`
      });
    }
  }
  
  res.json({
    success: true,
    data: {
      input: {
        minesCount: minesCountNum,
        revealed: revealedNum,
        betAmount: betAmountNum
      },
      calculation: {
        safeTotal,
        remainingCount,
        formula: `(${safeTotal}/${remainingCount})*0.95`,
        multiplier,
        winAmount,
        profit
      },
      multiplierTable
    }
  });
});

// Маршрут для проверки текущей игры в мины (получение состояния)
router.get('/debug/mines/active-game', telegramAuthMiddleware, async (req, res) => {
  try {
    // Импортируем модель Game
    const { Game } = require('../models');
    
    // Находим активную игру пользователя
    const activeGame = await Game.findOne({
      user: req.user._id,
      gameType: 'mines',
      status: 'active'
    });
    
    if (!activeGame) {
      return res.json({
        success: true,
        data: {
          hasActiveGame: false,
          message: 'У вас нет активной игры в мины'
        }
      });
    }
    
    // Рассчитываем текущий множитель
    const minesCount = activeGame.result.minesCount;
    const clickedCells = activeGame.result.clickedCells || [];
    const safeTotal = 25 - minesCount;
    const revealedCount = clickedCells.length;
    const remainingCount = safeTotal - revealedCount;
    const expectedMultiplier = remainingCount > 0 
      ? (safeTotal / remainingCount) * 0.95 
      : safeTotal * 0.95;
    
    // Проверяем соответствие множителя в БД и рассчитанного
    const multiplierMatch = Math.abs(activeGame.multiplier - expectedMultiplier) < 0.01;
    
    res.json({
      success: true,
      data: {
        hasActiveGame: true,
        gameId: activeGame._id,
        bet: activeGame.bet,
        multiplierInDB: activeGame.multiplier,
        expectedMultiplier,
        multiplierMatch,
        calculation: {
          minesCount,
          safeTotal,
          clickedCells,
          revealedCount,
          remainingCount,
          formula: `(${safeTotal}/${remainingCount})*0.95`
        },
        gameData: activeGame
      }
    });
  } catch (error) {
    console.error('Ошибка при получении активной игры:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Маршрут для исправления множителя в активной игре (только для разработки)
router.post('/debug/mines/fix-multiplier', telegramAuthMiddleware, async (req, res) => {
  try {
    // Проверяем, что мы находимся в режиме разработки
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'Этот маршрут доступен только в режиме разработки'
      });
    }
    
    // Импортируем модель Game
    const { Game } = require('../models');
    
    // Находим активную игру пользователя
    const activeGame = await Game.findOne({
      user: req.user._id,
      gameType: 'mines',
      status: 'active'
    });
    
    if (!activeGame) {
      return res.status(404).json({
        success: false,
        message: 'Активная игра не найдена'
      });
    }
    
    // Рассчитываем текущий множитель
    const minesCount = activeGame.result.minesCount;
    const clickedCells = activeGame.result.clickedCells || [];
    const safeTotal = 25 - minesCount;
    const revealedCount = clickedCells.length;
    const remainingCount = safeTotal - revealedCount;
    const correctMultiplier = remainingCount > 0 
      ? (safeTotal / remainingCount) * 0.95 
      : safeTotal * 0.95;
    
    // Сохраняем старый множитель для логирования
    const oldMultiplier = activeGame.multiplier;
    
    // Обновляем множитель
    activeGame.multiplier = correctMultiplier;
    await activeGame.save();
    
    res.json({
      success: true,
      data: {
        gameId: activeGame._id,
        oldMultiplier,
        newMultiplier: correctMultiplier,
        calculation: {
          minesCount,
          safeTotal,
          clickedCells,
          revealedCount,
          remainingCount,
          formula: `(${safeTotal}/${remainingCount})*0.95`
        }
      }
    });
  } catch (error) {
    console.error('Ошибка при исправлении множителя:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

module.exports = router;
