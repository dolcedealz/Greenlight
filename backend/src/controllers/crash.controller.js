// backend/src/controllers/crash.controller.js
const crashService = require('../services/crash.service');

/**
 * Контроллер для управления краш игрой
 */
class CrashController {
  /**
   * Размещение ставки в краш игре
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async placeBet(req, res) {
    try {
      const { betAmount, autoCashOut = 0 } = req.body;
      const userId = req.user._id;
      
      // Валидация входных данных
      if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректную сумму ставки'
        });
      }
      
      if (betAmount < 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Минимальная ставка: 0.01 USDT'
        });
      }
      
      if (betAmount > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Максимальная ставка: 1000 USDT'
        });
      }
      
      if (autoCashOut < 0) {
        return res.status(400).json({
          success: false,
          message: 'Автовывод не может быть отрицательным'
        });
      }
      
      if (autoCashOut > 0 && autoCashOut < 1.01) {
        return res.status(400).json({
          success: false,
          message: 'Минимальный автовывод: 1.01x'
        });
      }
      
      console.log(`CRASH BET: Пользователь ${userId} ставит ${betAmount} USDT (автовывод: ${autoCashOut}x)`);
      
      // Размещаем ставку через сервис
      const result = await crashService.placeBet(userId, parseFloat(betAmount), parseFloat(autoCashOut));
      
      res.status(200).json({
        success: true,
        message: 'Ставка размещена',
        data: {
          ...result,
          balanceAfter: result.balanceAfter || result.newBalance
        }
      });
      
    } catch (error) {
      console.error('CRASH CONTROLLER: Ошибка размещения ставки:', error);
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Ручной вывод ставки
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async cashOut(req, res) {
    try {
      const userId = req.user._id;
      
      console.log(`CRASH CASHOUT: Пользователь ${userId} делает ручной вывод`);
      
      // Выводим ставку через сервис
      const result = await crashService.manualCashOut(userId);
      
      res.status(200).json({
        success: true,
        message: 'Ставка выведена',
        data: result
      });
      
    } catch (error) {
      console.error('CRASH CONTROLLER: Ошибка вывода ставки:', error);
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получение текущего состояния игры
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getGameState(req, res) {
    try {
      // Теперь правильно обрабатываем асинхронный метод
      const gameState = await crashService.getCurrentGameStateAsync();
      
      res.status(200).json({
        success: true,
        data: gameState
      });
      
    } catch (error) {
      console.error('CRASH CONTROLLER: Ошибка получения состояния игры:', error);
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получение истории раундов
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getGameHistory(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      // Валидация лимита
      const parsedLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
      
      const history = await crashService.getGameHistory(parsedLimit);
      
      res.status(200).json({
        success: true,
        data: history || [] // Возвращаем историю напрямую как массив
      });
      
    } catch (error) {
      console.error('CRASH CONTROLLER: Ошибка получения истории:', error);
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получение статистики краш игры для пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserStats(req, res) {
    try {
      const userId = req.user._id;
      const { Game } = require('../models');
      
      // Получаем статистику пользователя по краш играм
      const stats = await Game.aggregate([
        {
          $match: {
            user: userId,
            gameType: 'crash'
          }
        },
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            totalBet: { $sum: '$bet' },
            totalWin: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
            winCount: { $sum: { $cond: ['$win', 1, 0] } },
            maxMultiplier: { $max: '$multiplier' },
            avgMultiplier: { $avg: '$multiplier' }
          }
        }
      ]);
      
      const userStats = stats[0] || {
        totalGames: 0,
        totalBet: 0,
        totalWin: 0,
        winCount: 0,
        maxMultiplier: 0,
        avgMultiplier: 0
      };
      
      // Добавляем рассчитанные поля
      userStats.winRate = userStats.totalGames > 0 
        ? (userStats.winCount / userStats.totalGames) * 100 
        : 0;
      userStats.profitLoss = userStats.totalWin - userStats.totalBet;
      
      res.status(200).json({
        success: true,
        data: userStats
      });
      
    } catch (error) {
      console.error('CRASH CONTROLLER: Ошибка получения статистики:', error);
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new CrashController();
