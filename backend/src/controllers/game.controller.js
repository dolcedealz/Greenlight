// backend/src/controllers/game.controller.js
const { gameService } = require('../services');

/**
 * Контроллер для управления играми
 */
class GameController {
  /**
   * Играть в монетку
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async playCoinFlip(req, res) {
    try {
      const { betAmount, selectedSide, clientSeed } = req.body;
      
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Данные игры
      const gameData = {
        betAmount: parseFloat(betAmount),
        selectedSide,
        clientSeed
      };
      
      // Играем в монетку
      const result = await gameService.playCoinFlip(userData, gameData);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error(`Ошибка в playCoinFlip: ${error.message}`, error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
 * Играть в слоты
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 */
async playSlots(req, res) {
  try {
    const { betAmount } = req.body;
    
    // Получаем информацию о пользователе из запроса
    const userData = {
      userId: req.user._id,
      telegramId: req.user.telegramId
    };
    
    // Данные игры
    const gameData = {
      betAmount: parseFloat(betAmount)
    };
    
    // Играем в слоты
    const result = await gameService.playSlots(userData, gameData);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(`Ошибка в playSlots: ${error.message}`, error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

  /**
   * Играть в мины
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async playMines(req, res) {
    try {
      console.log('Запрос на начало игры в мины:', req.body);
      const { betAmount, minesCount, clientSeed } = req.body;
      
      // Базовая валидация
      if (betAmount === undefined || minesCount === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Не указаны обязательные параметры: betAmount, minesCount'
        });
      }
      
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Данные игры с безопасным преобразованием типов
      const gameData = {
        betAmount: parseFloat(betAmount) || 0,
        minesCount: parseInt(minesCount, 10) || 5,
        clientSeed: clientSeed || `mines_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      };
      
      // Дополнительная валидация после преобразования
      if (gameData.betAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Ставка должна быть положительным числом'
        });
      }
      
      if (gameData.minesCount < 1 || gameData.minesCount > 24) {
        return res.status(400).json({
          success: false,
          message: 'Количество мин должно быть от 1 до 24'
        });
      }
      
      console.log('Начало игры в мины с параметрами:', gameData);
      
      // Играем в мины
      const result = await gameService.playMines(userData, gameData);
      
      console.log('Игра в мины успешно создана:', result);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error(`Ошибка в playMines: ${error.message}`, error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Завершить игру в мины
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async completeMinesGame(req, res) {
    try {
      console.log('Запрос на действие в игре мины:', req.body);
      const { gameId, row, col, cashout } = req.body;
      
      // Валидация GameId
      if (!gameId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID игры'
        });
      }
      
      // Проверка параметров хода
      if (!cashout && (row === undefined || col === undefined)) {
        return res.status(400).json({
          success: false, 
          message: 'Для хода необходимо указать координаты ячейки (row, col)'
        });
      }
      
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Данные игры с безопасной обработкой null/undefined значений
      const gameData = {
        gameId,
        cashout: Boolean(cashout)
      };
      
      // Добавляем координаты только если это не кешаут
      if (!cashout) {
        // Безопасное преобразование к числу с проверкой границ
        const rowNum = parseInt(row, 10);
        const colNum = parseInt(col, 10);
        
        if (isNaN(rowNum) || isNaN(colNum) || rowNum < 0 || rowNum > 4 || colNum < 0 || colNum > 4) {
          return res.status(400).json({
            success: false,
            message: 'Координаты ячейки должны быть числами от 0 до 4'
          });
        }
        
        gameData.row = rowNum;
        gameData.col = colNum;
      }
      
      console.log('Действие в игре мины с параметрами:', gameData);
      
      // Завершаем игру
      const result = await gameService.completeMinesGame(userData, gameData);
      
      console.log('Результат действия в игре мины:', result);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error(`Ошибка в completeMinesGame: ${error.message}`, error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить историю игр пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserGames(req, res) {
    try {
      const { gameType, limit, skip, sort } = req.query;
      
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Параметры запроса с безопасными значениями по умолчанию
      const params = {
        gameType,
        limit: limit ? parseInt(limit, 10) : 20,
        skip: skip ? parseInt(skip, 10) : 0,
        sort: sort || '-createdAt'
      };
      
      // Получаем историю игр
      const games = await gameService.getUserGames(userData, params);
      
      res.status(200).json({
        success: true,
        data: games
      });
    } catch (error) {
      console.error(`Ошибка в getUserGames: ${error.message}`, error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить статистику игр пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserGameStats(req, res) {
    try {
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Получаем статистику
      const stats = await gameService.getUserGameStats(userData);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error(`Ошибка в getUserGameStats: ${error.message}`, error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Разместить ставку в Crash
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async placeCrashBet(req, res) {
    try {
      const { amount, autoCashOut } = req.body;
      
      // Валидация
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректную сумму ставки'
        });
      }
      
      if (autoCashOut && autoCashOut < 1.01) {
        return res.status(400).json({
          success: false,
          message: 'Автовывод должен быть не менее 1.01x'
        });
      }
      
      // Получаем информацию о пользователе
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Данные игры
      const gameData = {
        betAmount: parseFloat(amount),
        autoCashOut: parseFloat(autoCashOut) || 0
      };
      
      console.log(`CRASH BET: Пользователь ${userData.userId} ставит ${gameData.betAmount} USDT`);
      
      // Размещаем ставку
      const result = await gameService.placeCrashBet(userData, gameData);
      
      res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('CRASH: Ошибка размещения ставки:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Вывести ставку (кешаут)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async cashOutCrash(req, res) {
    try {
      const { gameId } = req.body;
      
      if (!gameId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID игры'
        });
      }
      
      // Получаем информацию о пользователе
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Данные для кешаута
      const gameData = {
        gameId
      };
      
      console.log(`CRASH CASHOUT: Пользователь ${userData.userId} выводит ставку`);
      
      // Выводим ставку
      const result = await gameService.cashOutCrash(userData, gameData);
      
      res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('CRASH: Ошибка вывода ставки:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить текущее состояние Crash игры
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getCrashState(req, res) {
    try {
      // Правильно вызываем асинхронный метод
      const state = await gameService.getCurrentCrashState();
      
      res.status(200).json({
        success: true,
        data: state
      });
      
    } catch (error) {
      console.error('CRASH: Ошибка получения состояния:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения состояния игры'
      });
    }
  }
  
  /**
   * Получить историю Crash игр
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getCrashHistory(req, res) {
    try {
      const { limit = 20 } = req.query;
      
      const history = await gameService.getCrashHistory(parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: history
      });
      
    } catch (error) {
      console.error('CRASH: Ошибка получения истории:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения истории'
      });
    }
  }
  
  /**
   * Получить статистику пользователя в Crash
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getCrashUserStats(req, res) {
    try {
      const userId = req.user._id;
      
      const { Game } = require('../models');
      
      // Получаем статистику
      const stats = await Game.aggregate([
        {
          $match: {
            user: userId,
            gameType: 'crash',
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            totalBet: { $sum: '$bet' },
            totalWin: { 
              $sum: { 
                $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] 
              } 
            },
            totalProfit: { $sum: '$profit' },
            wins: { $sum: { $cond: ['$win', 1, 0] } },
            losses: { $sum: { $cond: ['$win', 0, 1] } },
            avgMultiplier: { 
              $avg: { 
                $cond: ['$win', '$multiplier', null] 
              } 
            },
            bestMultiplier: { 
              $max: { 
                $cond: ['$win', '$multiplier', 0] 
              } 
            }
          }
        }
      ]);
      
      const userStats = stats[0] || {
        totalGames: 0,
        totalBet: 0,
        totalWin: 0,
        totalProfit: 0,
        wins: 0,
        losses: 0,
        avgMultiplier: 0,
        bestMultiplier: 0
      };
      
      // Добавляем процент побед
      userStats.winRate = userStats.totalGames > 0 
        ? (userStats.wins / userStats.totalGames * 100).toFixed(2)
        : 0;
      
      res.status(200).json({
        success: true,
        data: userStats
      });
      
    } catch (error) {
      console.error('CRASH: Ошибка получения статистики:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка получения статистики'
      });
    }
  }
}

module.exports = new GameController();
