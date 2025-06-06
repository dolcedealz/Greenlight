// backend/src/controllers/admin.controller.js
const { userService, casinoFinanceService, oddsService } = require('../services');
const { User, Game, Transaction, Deposit, Withdrawal } = require('../models');

class AdminController {
  /**
   * Получить статистику казино
   */
  async getCasinoStats(req, res) {
    try {
      // Используем правильный метод из casino finance service
      const financeState = await casinoFinanceService.getCurrentFinanceState();
      
      // Подсчитываем дополнительную статистику
      const [totalUsers, totalGames, activeUsers] = await Promise.all([
        User.countDocuments({ isBlocked: false }),
        Game.countDocuments(),
        User.countDocuments({ 
          lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isBlocked: false 
        })
      ]);

      const stats = {
        totalUsers,
        activeUsers,
        totalGames,
        finance: {
          totalUserBalance: financeState.totalUserBalance,
          operationalBalance: financeState.operationalBalance,
          reserveBalance: financeState.reserveBalance,
          availableForWithdrawal: financeState.availableForWithdrawal,
          totalCommissions: financeState.totalCommissions,
          totalBets: financeState.totalBets,
          totalWins: financeState.totalWins,
          gameStats: financeState.gameStats
        }
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить статистику пользователей
   */
  async getUserStats(req, res) {
    try {
      // Подсчитываем статистику пользователей
      const [
        totalUsers,
        activeToday,
        activeWeek,
        withDeposits,
        blocked,
        averageBalanceResult
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ 
          lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        User.countDocuments({ 
          lastActivity: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        User.countDocuments({ 
          'deposits.0': { $exists: true }
        }),
        User.countDocuments({ isBlocked: true }),
        User.aggregate([
          { $match: { isBlocked: false } },
          { $group: { _id: null, average: { $avg: '$balance' } } }
        ])
      ]);

      const averageBalance = averageBalanceResult[0]?.average || 0;

      const stats = {
        totalUsers,
        activeToday,
        activeWeek,
        withDeposits,
        blocked,
        averageBalance
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Ошибка получения статистики пользователей:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить список всех пользователей
   */
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      
      const query = {};
      if (search) {
        query.$or = [
          { username: new RegExp(search, 'i') },
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') }
        ];
      }

      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-gameSettings.coin.winChanceModifier'); // Скрываем чувствительные данные

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Заблокировать/разблокировать пользователя
   */
  async toggleUserBlock(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }

      user.isBlocked = !user.isBlocked;
      await user.save();

      res.json({
        success: true,
        data: {
          userId: user._id,
          isBlocked: user.isBlocked
        }
      });
    } catch (error) {
      console.error('Ошибка блокировки пользователя:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Изменить баланс пользователя
   */
  async adjustUserBalance(req, res) {
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;

      if (!amount || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать сумму и причину'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }

      const oldBalance = user.balance;
      user.balance += amount;
      
      if (user.balance < 0) {
        user.balance = 0;
      }

      await user.save();

      // Создаем транзакцию
      await Transaction.create({
        user: user._id,
        type: amount > 0 ? 'admin_credit' : 'admin_debit',
        amount: amount,
        description: `Административная корректировка: ${reason}`,
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        metadata: {
          adminId: req.user._id,
          reason: reason
        }
      });

      res.json({
        success: true,
        data: {
          userId: user._id,
          oldBalance,
          newBalance: user.balance,
          adjustment: amount
        }
      });
    } catch (error) {
      console.error('Ошибка изменения баланса:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить детали пользователя
   */
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId).populate('referrer', 'username firstName lastName');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }

      // Получаем статистику по играм
      const gameStats = await Game.aggregate([
        { $match: { user: user._id } },
        { 
          $group: {
            _id: '$gameType',
            totalGames: { $sum: 1 },
            totalBet: { $sum: '$bet' },
            totalWin: { $sum: { $cond: ['$win', '$bet', 0] } },
            winCount: { $sum: { $cond: ['$win', 1, 0] } }
          }
        }
      ]);

      // Получаем последние транзакции
      const recentTransactions = await Transaction.find({ user: user._id })
        .sort({ createdAt: -1 })
        .limit(10);

      res.json({
        success: true,
        data: {
          user,
          gameStats,
          recentTransactions
        }
      });
    } catch (error) {
      console.error('Ошибка получения деталей пользователя:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ========== НОВЫЕ МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ ==========

  /**
   * Установить модификатор игры для пользователя
   */
  async setUserGameModifier(req, res) {
    try {
      const { userId } = req.params;
      const { gameType, modifierType, value } = req.body;

      // Валидация
      if (!gameType || !modifierType || value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать gameType, modifierType и value'
        });
      }

      const user = await oddsService.setUserGameModifier(userId, gameType, modifierType, value);

      res.json({
        success: true,
        data: {
          userId: user._id,
          gameSettings: user.gameSettings
        }
      });
    } catch (error) {
      console.error('Ошибка установки модификатора:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить модификаторы пользователя
   */
  async getUserModifiers(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }

      res.json({
        success: true,
        data: {
          userId: user._id,
          username: user.username,
          gameSettings: user.gameSettings || {}
        }
      });
    } catch (error) {
      console.error('Ошибка получения модификаторов:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Сбросить все модификаторы пользователя
   */
  async resetUserModifiers(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await oddsService.resetUserModifiers(userId);

      res.json({
        success: true,
        data: {
          userId: user._id,
          gameSettings: user.gameSettings
        }
      });
    } catch (error) {
      console.error('Ошибка сброса модификаторов:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить статистику по модификаторам
   */
  async getOddsStatistics(req, res) {
    try {
      const stats = await oddsService.getOddsStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Ошибка получения статистики модификаторов:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Массовая установка модификаторов
   */
  async setBulkModifiers(req, res) {
    try {
      const { userIds, gameType, modifierType, value } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать массив userIds'
        });
      }

      const results = [];
      for (const userId of userIds) {
        try {
          const user = await oddsService.setUserGameModifier(userId, gameType, modifierType, value);
          results.push({
            userId: user._id,
            success: true
          });
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: {
          processed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results
        }
      });
    } catch (error) {
      console.error('Ошибка массовой установки модификаторов:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Установить глобальный модификатор для Crash
   */
  async setGlobalCrashModifier(req, res) {
    try {
      const { modifier } = req.body;
      
      if (modifier === undefined || modifier === null) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать значение модификатора'
        });
      }

      const crashService = require('../services/crash.service');
      const result = crashService.setGlobalCrashModifier(modifier);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Ошибка установки глобального модификатора Crash:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить глобальный модификатор для Crash
   */
  async getGlobalCrashModifier(req, res) {
    try {
      const crashService = require('../services/crash.service');
      const result = crashService.getGlobalCrashModifier();
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Ошибка получения глобального модификатора Crash:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить глобальные настройки игр
   */
  async getGameSettings(req, res) {
    try {
      const { GameSettings } = require('../models');
      const settings = await GameSettings.getSettings();
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Ошибка получения настроек игр:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Обновить глобальные настройки игр
   */
  async updateGameSettings(req, res) {
    try {
      const { GameSettings } = require('../models');
      const { modifierMode, globalModifiers } = req.body;
      
      const updates = {};
      if (modifierMode) updates.modifierMode = modifierMode;
      if (globalModifiers) updates.globalModifiers = globalModifiers;
      
      const settings = await GameSettings.updateSettings(updates, req.user._id);
      
      // Если обновляется модификатор Crash, обновляем его в сервисе
      if (globalModifiers?.crash?.crashModifier !== undefined) {
        const crashService = require('../services/crash.service');
        crashService.setGlobalCrashModifier(globalModifiers.crash.crashModifier);
      }
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Ошибка обновления настроек игр:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Установить глобальный модификатор для конкретной игры
   */
  async setGlobalGameModifier(req, res) {
    try {
      const { gameType } = req.params;
      const { modifier, enabled } = req.body;
      
      const { GameSettings } = require('../models');
      
      const validGameTypes = ['coin', 'slots', 'mines', 'crash'];
      if (!validGameTypes.includes(gameType)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный тип игры'
        });
      }
      
      const modifierField = {
        coin: 'winChanceModifier',
        slots: 'rtpModifier',
        mines: 'mineChanceModifier',
        crash: 'crashModifier'
      }[gameType];
      
      const updates = {
        [`globalModifiers.${gameType}.${modifierField}`]: modifier,
        [`globalModifiers.${gameType}.enabled`]: enabled
      };
      
      const settings = await GameSettings.updateSettings(updates, req.user._id);
      
      // Для Crash обновляем сервис
      if (gameType === 'crash') {
        const crashService = require('../services/crash.service');
        crashService.setGlobalCrashModifier(modifier);
      }
      
      res.json({
        success: true,
        data: {
          gameType,
          modifier,
          enabled,
          settings
        }
      });
    } catch (error) {
      console.error('Ошибка установки глобального модификатора:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AdminController();