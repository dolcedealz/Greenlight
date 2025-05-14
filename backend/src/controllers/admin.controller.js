// admin.controller.js
const { User } = require('../models');
const oddsService = require('../services/odds.service');

class AdminController {
  /**
   * Устанавливает базовый шанс выигрыша для игры
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async setBaseWinChance(req, res) {
    try {
      const { gameType, winChance } = req.body;
      
      // Валидация входных данных
      if (!gameType) {
        return res.status(400).json({
          success: false,
          message: 'Не указан тип игры'
        });
      }
      
      // Проверяем, что шанс в допустимых пределах (0-1)
      const winChanceNum = parseFloat(winChance);
      if (isNaN(winChanceNum) || winChanceNum < 0 || winChanceNum > 1) {
        return res.status(400).json({
          success: false,
          message: 'Шанс выигрыша должен быть числом от 0 до 1'
        });
      }
      
      // Устанавливаем новый базовый шанс
      oddsService.setBaseWinChance(gameType, winChanceNum);
      
      res.status(200).json({
        success: true,
        message: `Базовый шанс выигрыша для ${gameType} установлен на ${winChanceNum * 100}%`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Устанавливает персональный модификатор шанса выигрыша для пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async setUserWinChanceModifier(req, res) {
    try {
      const { userId, gameType, modifierPercent } = req.body;
      
      // Валидация входных данных
      if (!userId || !gameType) {
        return res.status(400).json({
          success: false,
          message: 'Не указаны обязательные параметры: userId, gameType'
        });
      }
      
      // Проверяем, что модификатор - число
      const modifierNum = parseFloat(modifierPercent);
      if (isNaN(modifierNum)) {
        return res.status(400).json({
          success: false,
          message: 'Модификатор должен быть числом'
        });
      }
      
      // Устанавливаем модификатор для пользователя
      const user = await oddsService.setUserWinChanceModifier(userId, gameType, modifierNum);
      
      res.status(200).json({
        success: true,
        message: `Персональный модификатор шанса выигрыша для пользователя установлен`,
        data: {
          userId: user._id,
          gameType,
          modifierPercent: modifierNum,
          effectiveWinChance: await oddsService.getUserWinChance(user, gameType)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получает текущие настройки шансов выигрыша
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getWinChanceSettings(req, res) {
    try {
      res.status(200).json({
        success: true,
        data: {
          gameSettings: oddsService.gameSettings
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получает персональный модификатор шанса выигрыша пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserWinChanceModifier(req, res) {
    try {
      const { userId, gameType } = req.query;
      
      // Валидация входных данных
      if (!userId || !gameType) {
        return res.status(400).json({
          success: false,
          message: 'Не указаны обязательные параметры: userId, gameType'
        });
      }
      
      // Находим пользователя
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }
      
      // Получаем модификатор и эффективный шанс
      let modifier = 0;
      if (user.gameSettings && 
          user.gameSettings[gameType] && 
          user.gameSettings[gameType].winChanceModifier !== undefined) {
        modifier = user.gameSettings[gameType].winChanceModifier;
      }
      
      const effectiveWinChance = await oddsService.getUserWinChance(user, gameType);
      
      res.status(200).json({
        success: true,
        data: {
          userId: user._id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          gameType,
          modifierPercent: modifier,
          baseWinChance: oddsService.gameSettings[gameType].baseWinChance,
          effectiveWinChance
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AdminController();