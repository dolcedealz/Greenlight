// backend/src/controllers/auth.controller.js
const authService = require('../services/auth.service');

/**
 * >=B@>;;5@ 0CB5=B8D8:0F88 4;O Telegram Mini App
 */
class AuthController {
  /**
   * CB5=B8D8:0F8O ?>;L7>20B5;O G5@57 Telegram WebApp
   * @param {Object} req - 0?@>A Express
   * @param {Object} res - B25B Express
   */
  async authenticateWithTelegram(req, res) {
    try {
      const { initData, referralCode } = req.body;

      if (!initData) {
        return res.status(400).json({
          success: false,
          message: 'BACBAB2CNB 40==K5 8=8F80;870F88 Telegram'
        });
      }

      console.log('= AUTH CONTROLLER: >;CG5= 70?@>A =0 0CB5=B8D8:0F8N');

      // CB5=B8D8F8@C5< ?>;L7>20B5;O
      const result = await authService.authenticateUser(initData, referralCode);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          message: result.error
        });
      }

      // >72@0I05< CA?5H=K9 @57C;LB0B
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token
        },
        message: 'CB5=B8D8:0F8O CA?5H=0'
      });

    } catch (error) {
      console.error('L AUTH CONTROLLER: H81:0 0CB5=B8D8:0F88:', error);
      
      res.status(500).json({
        success: false,
        message: '=CB@5==OO >H81:0 A5@25@0'
      });
    }
  }

  /**
   * 1=>2;5=85 B>:5=0 ?>;L7>20B5;O
   * @param {Object} req - 0?@>A Express
   * @param {Object} res - B25B Express
   */
  async refreshToken(req, res) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'BACBAB2C5B B>:5= 02B>@870F88'
        });
      }

      const token = authHeader.substring(7);
      const decoded = authService.validateJWT(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: '520;84=K9 B>:5='
        });
      }

      // 0E>48< ?>;L7>20B5;O
      const { User } = require('../models');
      const user = await User.findById(decoded.userId);

      if (!user || user.isBlocked) {
        return res.status(401).json({
          success: false,
          message: '>;L7>20B5;L =5 =0945= 8;8 701;>:8@>20='
        });
      }

      // 1=>2;O5< 2@5<O ?>A;54=59 0:B82=>AB8
      user.lastActivity = new Date();
      await user.save();

      // !>7405< =>2K9 B>:5=
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
        message: '">:5= >1=>2;5='
      });

    } catch (error) {
      console.error('L AUTH CONTROLLER: H81:0 >1=>2;5=8O B>:5=0:', error);
      
      res.status(500).json({
        success: false,
        message: '=CB@5==OO >H81:0 A5@25@0'
      });
    }
  }

  /**
   * >;CG5=85 8=D>@<0F88 > B5:CI5< ?>;L7>20B5;5
   * @param {Object} req - 0?@>A Express
   * @param {Object} res - B25B Express
   */
  async getCurrentUser(req, res) {
    try {
      // >;L7>20B5;L C65 CAB0=>2;5= 2 middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: '>;L7>20B5;L =5 02B>@87>20='
        });
      }

      // 1=>2;O5< 2@5<O ?>A;54=59 0:B82=>AB8
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
      console.error('L AUTH CONTROLLER: H81:0 ?>;CG5=8O ?>;L7>20B5;O:', error);
      
      res.status(500).json({
        success: false,
        message: '=CB@5==OO >H81:0 A5@25@0'
      });
    }
  }

  /**
   * 0;840F8O Telegram WebApp 40==KE (4;O >B;04:8)
   * @param {Object} req - 0?@>A Express
   * @param {Object} res - B25B Express
   */
  async validateTelegramData(req, res) {
    try {
      const { initData } = req.body;

      if (!initData) {
        return res.status(400).json({
          success: false,
          message: 'BACBAB2CNB 40==K5 4;O 20;840F88'
        });
      }

      const telegramData = authService.validateTelegramWebAppData(
        initData,
        process.env.TELEGRAM_BOT_TOKEN
      );

      if (!telegramData) {
        return res.status(400).json({
          success: false,
          message: '520;84=K5 40==K5 Telegram'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          userData: telegramData
        },
        message: '0==K5 Telegram 20;84=K'
      });

    } catch (error) {
      console.error('L AUTH CONTROLLER: H81:0 20;840F88 40==KE:', error);
      
      res.status(500).json({
        success: false,
        message: '=CB@5==OO >H81:0 A5@25@0'
      });
    }
  }
}

module.exports = new AuthController();