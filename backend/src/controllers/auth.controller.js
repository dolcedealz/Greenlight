// backend/src/controllers/auth.controller.js
const authService = require('../services/auth.service');

/**
 * Контроллер аутентификации для Telegram Mini App
 */
class AuthController {
  /**
   * Аутентификация пользователя через Telegram WebApp
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async authenticateWithTelegram(req, res) {
    try {
      const { user, initData, referralCode } = req.body;

      // Поддерживаем оба формата - новый (user) и старый (initData)
      if (!user && !initData) {
        return res.status(400).json({
          success: false,
          message: 'Отсутствуют данные инициализации Telegram'
        });
      }

      console.log('AUTH CONTROLLER: Получен запрос на аутентификацию');

      let result;
      
      if (user) {
        // Новый формат - прямой объект пользователя
        result = await authService.authenticateUserDirect(user, referralCode);
      } else {
        // Старый формат - initData
        result = await authService.authenticateUser(initData, referralCode);
      }

      if (!result.success) {
        return res.status(401).json({
          success: false,
          message: result.error
        });
      }

      // Возвращаем успешный результат
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token
        },
        message: 'Аутентификация успешна'
      });

    } catch (error) {
      console.error('AUTH CONTROLLER: Ошибка аутентификации:', error);
      
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }

  /**
   * Обновление токена пользователя
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async refreshToken(req, res) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Отсутствует токен авторизации'
        });
      }

      const token = authHeader.substring(7);
      const decoded = authService.validateJWT(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Невалидный токен'
        });
      }

      // Находим пользователя
      const { User } = require('../models');
      const user = await User.findById(decoded.userId);

      if (!user || user.isBlocked) {
        return res.status(401).json({
          success: false,
          message: 'Пользователь не найден или заблокирован'
        });
      }

      // Обновляем время последней активности
      user.lastActivity = new Date();
      await user.save();

      // Создаем новый токен
      const newToken = authService.generateJWT(user);

      res.status(200).json({
        success: true,
        data: {
          token: newToken,
          user: {
            id: user._id,
            telegramId: user.telegramId,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            balance: user.balance,
            totalWagered: user.totalWagered,
            totalWon: user.totalWon,
            referralCode: user.referralCode,
            isAdmin: authService.isAdmin(user),
            lastActivity: user.lastActivity
          }
        },
        message: 'Токен обновлен'
      });

    } catch (error) {
      console.error('AUTH CONTROLLER: Ошибка обновления токена:', error);
      
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }

  /**
   * Получение информации о текущем пользователе
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getCurrentUser(req, res) {
    try {
      // Пользователь уже установлен в middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Пользователь не авторизован'
        });
      }

      // Обновляем время последней активности
      user.lastActivity = new Date();
      await user.save();

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
            totalWagered: user.totalWagered,
            totalWon: user.totalWon,
            referralCode: user.referralCode,
            isAdmin: authService.isAdmin(user),
            registeredAt: user.registeredAt,
            lastActivity: user.lastActivity,
            settings: user.settings
          }
        }
      });

    } catch (error) {
      console.error('AUTH CONTROLLER: Ошибка получения пользователя:', error);
      
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }

  /**
   * Валидация Telegram WebApp данных (для отладки)
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async validateTelegramData(req, res) {
    try {
      const { initData } = req.body;

      if (!initData) {
        return res.status(400).json({
          success: false,
          message: 'Отсутствуют данные для валидации'
        });
      }

      const telegramData = authService.validateTelegramWebAppData(
        initData,
        process.env.TELEGRAM_BOT_TOKEN
      );

      if (!telegramData) {
        return res.status(400).json({
          success: false,
          message: 'Невалидные данные Telegram'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          userData: telegramData
        },
        message: 'Данные Telegram валидны'
      });

    } catch (error) {
      console.error('AUTH CONTROLLER: Ошибка валидации данных:', error);
      
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
}

module.exports = new AuthController();