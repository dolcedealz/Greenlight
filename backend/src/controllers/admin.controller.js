// backend/src/controllers/admin.controller.js
const { userService, casinoFinanceService, oddsService } = require('../services');
const { User, Game, Transaction, Deposit, Withdrawal } = require('../models');
const mongoose = require('mongoose');

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Подсчитываем статистику пользователей
      const [
        totalUsers,
        activeToday,
        activeWeek,
        blocked,
        adminUsers,
        newUsersToday,
        newUsersWeek,
        playedToday,
        usersWithDeposits,
        totalUserBalancesResult,
        totalWageredResult,
        totalWonResult
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ 
          lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        User.countDocuments({ 
          lastActivity: { $gte: weekAgo }
        }),
        User.countDocuments({ isBlocked: true }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ 
          createdAt: { $gte: today }
        }),
        User.countDocuments({ 
          createdAt: { $gte: weekAgo }
        }),
        User.countDocuments({ 
          lastActivity: { $gte: today },
          totalGames: { $gt: 0 }
        }),
        User.countDocuments({ 
          'deposits.0': { $exists: true }
        }),
        User.aggregate([
          { $group: { _id: null, total: { $sum: '$balance' } } }
        ]),
        User.aggregate([
          { $group: { _id: null, total: { $sum: '$totalWagered' } } }
        ]),
        User.aggregate([
          { $group: { _id: null, total: { $sum: '$totalWon' } } }
        ])
      ]);

      const totalUserBalances = totalUserBalancesResult[0]?.total || 0;
      const totalWagered = totalWageredResult[0]?.total || 0;
      const totalWon = totalWonResult[0]?.total || 0;

      const stats = {
        totalUsers,
        activeToday,
        blocked,
        adminUsers,
        newUsersToday,
        newUsersWeek,
        playedToday,
        usersWithDeposits,
        totalUserBalances,
        totalWagered,
        totalWon
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
   * Получить список заблокированных пользователей
   */
  async getBlockedUsers(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const users = await User.find({ isBlocked: true })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-gameSettings.coin.winChanceModifier');

      const total = await User.countDocuments({ isBlocked: true });

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
      console.error('Ошибка получения заблокированных пользователей:', error);
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

      const session = await mongoose.startSession();
      
      let result;
      try {
        result = await session.withTransaction(async () => {
          // АТОМАРНАЯ корректировка баланса с валидацией
          const user = await User.findOneAndUpdate(
            { _id: userId },
            [
              {
                $set: {
                  balanceBefore: '$balance', // Сохраняем старый баланс
                  balance: {
                    $cond: {
                      if: { $gte: [{ $add: ['$balance', amount] }, 0] },
                      then: { $add: ['$balance', amount] },
                      else: { $error: { code: 'NegativeBalance', msg: 'Админская корректировка не может создать отрицательный баланс' } }
                    }
                  },
                  lastActivity: new Date()
                }
              }
            ],
            { 
              new: true,
              session,
              runValidators: true
            }
          );
          
          if (!user) {
            throw new Error('Пользователь не найден');
          }
          
          // Создаем транзакцию в той же сессии
          const transaction = await Transaction.create([{
            user: user._id,
            type: amount > 0 ? 'admin_credit' : 'admin_debit',
            amount: amount,
            description: `Административная корректировка: ${reason}`,
            balanceBefore: user.balanceBefore,
            balanceAfter: user.balance,
            metadata: {
              adminId: req.user._id,
              adminUsername: req.user.username,
              reason: reason,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            }
          }], { session });
          
          return { user, transaction: transaction[0] };
        });
      } finally {
        await session.endSession();
      }

      res.json({
        success: true,
        data: {
          userId: result.user._id,
          oldBalance: result.user.balanceBefore,
          newBalance: result.user.balance,
          adjustment: amount,
          transactionId: result.transaction._id
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
   * Получить список партнеров
   */
  async getPartners(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      // Получаем партнеров (у кого partnerLevel не 'none')
      const partners = await User.find({
        partnerLevel: { $ne: 'none' }
      })
      .select('telegramId username firstName lastName partnerLevel partnerMeta referralStats')
      .sort({ 'partnerMeta.assignedAt': -1 })
      .limit(parseInt(limit))
      .skip(skip);

      const total = await User.countDocuments({
        partnerLevel: { $ne: 'none' }
      });

      // Статистика по уровням
      const summary = await User.aggregate([
        { $match: { partnerLevel: { $ne: 'none' } } },
        { $group: { _id: '$partnerLevel', count: { $sum: 1 } } }
      ]);

      res.json({
        success: true,
        data: {
          partners,
          summary,
          pagination: {
            offset: skip,
            limit: parseInt(limit),
            hasMore: skip + partners.length < total
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения партнеров:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить статистику реферальной программы
   */
  async getReferralStats(req, res) {
    try {
      // Статистика партнеров
      const partnersStats = await User.aggregate([
        { $match: { partnerLevel: { $ne: 'none' } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalBalance: { $sum: '$referralStats.referralBalance' },
            byLevel: {
              $push: {
                level: '$partnerLevel',
                earned: '$referralStats.totalEarned'
              }
            }
          }
        }
      ]);

      const byLevelStats = await User.aggregate([
        { $match: { partnerLevel: { $ne: 'none' } } },
        {
          $group: {
            _id: '$partnerLevel',
            count: { $sum: 1 },
            totalEarned: { $sum: '$referralStats.totalEarned' }
          }
        }
      ]);

      // Статистика рефералов
      const referralsStats = await User.aggregate([
        { $match: { referrer: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  { $gte: ['$lastActivity', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            },
            withDeposits: {
              $sum: {
                $cond: [{ $gt: ['$totalWagered', 0] }, 1, 0]
              }
            }
          }
        }
      ]);

      const stats = {
        partners: {
          total: partnersStats[0]?.total || 0,
          totalBalance: partnersStats[0]?.totalBalance || 0,
          byLevel: byLevelStats
        },
        referrals: {
          total: referralsStats[0]?.total || 0,
          active: referralsStats[0]?.active || 0,
          withDeposits: referralsStats[0]?.withDeposits || 0,
          conversionRate: referralsStats[0]?.total > 0 
            ? ((referralsStats[0]?.withDeposits || 0) / referralsStats[0]?.total * 100).toFixed(1)
            : 0
        },
        finance: {
          totalReferralPayments: 0, // TODO: implement
          pendingPayouts: 0 // TODO: implement
        }
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Ошибка получения статистики реферальной программы:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Назначить партнерский статус
   */
  async assignPartnerStatus(req, res) {
    try {
      const { userId, newLevel, reason, metadata } = req.body;

      if (!userId || !newLevel || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо указать userId, newLevel и reason'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Пользователь не найден'
        });
      }

      const previousLevel = user.partnerLevel;
      
      // Обновляем партнерский статус
      user.partnerLevel = newLevel;
      user.partnerMeta = {
        assignedBy: req.user._id,
        assignedAt: new Date(),
        previousLevel: previousLevel
      };

      await user.save();

      // Создаем лог изменения (можно добавить модель PartnerLog позже)
      console.log(`Партнерский статус изменен: ${user.username} (${userId}) - ${previousLevel} → ${newLevel} по причине: ${reason}`);

      const action = previousLevel === 'none' ? 'assign' : 
                    newLevel === 'none' ? 'remove' : 'change';

      res.json({
        success: true,
        data: {
          action,
          user: {
            username: user.username,
            previousLevel,
            newLevel,
            commissionPercent: {
              'partner_bronze': 20,
              'partner_silver': 30,
              'partner_gold': 40
            }[newLevel] || 0
          },
          admin: {
            username: req.user.username
          }
        }
      });
    } catch (error) {
      console.error('Ошибка назначения партнерского статуса:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * ВРЕМЕННЫЙ МЕТОД: Исправить статистику всех пользователей
   */
  async fixUserStats(req, res) {
    try {
      console.log('🔄 Начинаем исправление статистики пользователей...');
      
      const users = await User.find({}).select('_id username totalGames totalWagered totalWon');
      console.log(`📊 Найдено ${users.length} пользователей`);
      
      let updated = 0;
      let processed = 0;
      
      for (const user of users) {
        processed++;
        
        // Подсчитываем реальную статистику из коллекции Game
        const [
          totalGamesResult,
          totalWageredResult,
          totalWonResult
        ] = await Promise.all([
          Game.countDocuments({ user: user._id }),
          Game.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: null, total: { $sum: '$bet' } } }
          ]),
          Game.aggregate([
            { $match: { user: user._id } },
            { 
              $group: { 
                _id: null, 
                total: { 
                  $sum: { 
                    $cond: [
                      '$win', 
                      { $add: ['$bet', { $ifNull: ['$profit', 0] }] }, 
                      0
                    ] 
                  } 
                } 
              } 
            }
          ])
        ]);

        const actualTotalGames = totalGamesResult;
        const actualTotalWagered = totalWageredResult[0]?.total || 0;
        const actualTotalWon = totalWonResult[0]?.total || 0;

        // Проверяем, нужно ли обновление
        let needsUpdate = false;
        const updates = {};

        if (user.totalGames !== actualTotalGames) {
          updates.totalGames = actualTotalGames;
          needsUpdate = true;
        }

        if (Math.abs(user.totalWagered - actualTotalWagered) > 0.01) {
          updates.totalWagered = actualTotalWagered;
          needsUpdate = true;
        }

        if (Math.abs(user.totalWon - actualTotalWon) > 0.01) {
          updates.totalWon = actualTotalWon;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await User.updateOne({ _id: user._id }, { $set: updates });
          console.log(`✅ ${user.username || user._id}: игр ${user.totalGames}→${actualTotalGames}, ставок ${user.totalWagered.toFixed(2)}→${actualTotalWagered.toFixed(2)}, выигрышей ${user.totalWon.toFixed(2)}→${actualTotalWon.toFixed(2)}`);
          updated++;
        }

        // Отправляем прогресс каждые 50 пользователей
        if (processed % 50 === 0) {
          console.log(`📈 Обработано ${processed}/${users.length} пользователей...`);
        }
      }
      
      console.log(`📊 Исправление завершено: обновлено ${updated}/${users.length} пользователей`);
      
      res.json({
        success: true,
        data: {
          totalUsers: users.length,
          updated,
          skipped: users.length - updated,
          message: `Исправлено ${updated} пользователей из ${users.length}`
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка исправления статистики:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Получить логи партнерских изменений
   */
  async getPartnerLogs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      // Пока возвращаем пустой список, позже можно добавить модель PartnerLog
      res.json({
        success: true,
        data: {
          logs: [],
          pagination: {
            offset: skip,
            limit: parseInt(limit),
            hasMore: false
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения логов партнеров:', error);
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

      // Получаем детальную статистику по играм
      const gameStats = await Game.aggregate([
        { $match: { user: user._id } },
        { 
          $group: {
            _id: '$gameType',
            totalGames: { $sum: 1 },
            totalBet: { $sum: '$bet' },
            totalWon: { 
              $sum: { 
                $cond: [
                  '$win', 
                  { $add: ['$bet', { $ifNull: ['$profit', 0] }] }, 
                  0
                ] 
              } 
            },
            winCount: { $sum: { $cond: ['$win', 1, 0] } },
            lossCount: { $sum: { $cond: [{ $not: '$win' }, 1, 0] } },
            avgBet: { $avg: '$bet' },
            maxBet: { $max: '$bet' },
            minBet: { $min: '$bet' }
          }
        }
      ]);

      // Подсчитываем общую статистику пользователя из игр
      const totalGamesFromDB = await Game.countDocuments({ user: user._id });
      const totalWageredFromDB = await Game.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, total: { $sum: '$bet' } } }
      ]);
      const totalWonFromDB = await Game.aggregate([
        { $match: { user: user._id } },
        { 
          $group: { 
            _id: null, 
            total: { 
              $sum: { 
                $cond: [
                  '$win', 
                  { $add: ['$bet', { $ifNull: ['$profit', 0] }] }, 
                  0
                ] 
              } 
            } 
          } 
        }
      ]);

      // Обновляем данные пользователя если они отличаются
      const actualTotalWagered = totalWageredFromDB[0]?.total || 0;
      const actualTotalWon = totalWonFromDB[0]?.total || 0;

      let userUpdated = false;
      if (user.totalGames !== totalGamesFromDB) {
        user.totalGames = totalGamesFromDB;
        userUpdated = true;
      }
      if (Math.abs(user.totalWagered - actualTotalWagered) > 0.01) {
        user.totalWagered = actualTotalWagered;
        userUpdated = true;
      }
      if (Math.abs(user.totalWon - actualTotalWon) > 0.01) {
        user.totalWon = actualTotalWon;
        userUpdated = true;
      }

      if (userUpdated) {
        await user.save();
        console.log(`Обновлены данные пользователя ${user.username}: игр ${totalGamesFromDB}, ставок ${actualTotalWagered}, выигрышей ${actualTotalWon}`);
      }

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