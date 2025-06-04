// user.controller.js
const { userService } = require('../services');

/**
 * Контроллер для управления пользователями
 */
class UserController {
  /**
   * Аутентификация пользователя через Telegram данные
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async authWithTelegram(req, res) {
    try {
      const { user: telegramUser, referralCode } = req.body;
      
      // Проверяем, что есть данные пользователя
      if (!telegramUser || !telegramUser.id) {
        return res.status(400).json({
          success: false,
          message: 'Не указаны данные пользователя Telegram'
        });
      }
      
      // Создаем или обновляем пользователя
      const user = await userService.createOrUpdateUser(telegramUser, referralCode);
      
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            balance: user.balance,
            referralCode: user.referralCode,
            referralCount: user.referralStats.totalReferrals
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить профиль пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserProfile(req, res) {
    try {
      // Пользователь уже должен быть в req.user после middleware
      const user = req.user;
      
      res.status(200).json({
        success: true,
        data: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          balance: user.balance,
          referralCode: user.referralCode,
          referralCount: user.referralStats.totalReferrals,
          referralEarnings: user.referralStats.totalEarned,
          totalWagered: user.totalWagered,
          totalWon: user.totalWon,
          profitLoss: user.totalWon - user.totalWagered,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить баланс пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserBalance(req, res) {
    try {
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Получаем баланс
      const balance = await userService.getUserBalance(userData);
      
      res.status(200).json({
        success: true,
        data: {
          balance
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить транзакции пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getUserTransactions(req, res) {
    try {
      const { type, limit, skip, sort } = req.query;
      
      // Получаем информацию о пользователе из запроса
      const userData = {
        userId: req.user._id,
        telegramId: req.user.telegramId
      };
      
      // Получаем транзакции
      const transactions = await userService.getUserTransactions(userData, {
        type,
        limit,
        skip,
        sort
      });
      
      res.status(200).json({
        success: true,
        data: transactions
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UserController();