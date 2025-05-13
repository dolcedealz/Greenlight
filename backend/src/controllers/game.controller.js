// game.controller.js
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
      
      // Получаем историю игр
      const games = await gameService.getUserGames(userData, {
        gameType,
        limit,
        skip,
        sort
      });
      
      res.status(200).json({
        success: true,
        data: games
      });
    } catch (error) {
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
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new GameController();