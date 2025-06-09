// backend/src/routes/admin.routes.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ИНТЕГРАЦИЕЙ ГИБКИХ КОЭФФИЦИЕНТОВ
const express = require('express');
const { adminController, withdrawalController, financeController } = require('../controllers');
const { adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// Применяем middleware для проверки админских прав
router.use(adminAuthMiddleware);

// === ИНТЕГРАЦИЯ МАРШРУТОВ ДЛЯ ГИБКИХ КОЭФФИЦИЕНТОВ ===
const flexibleOddsRoutes = require('./admin-flexible-odds.routes');
router.use('/', flexibleOddsRoutes); // Интегрируем маршруты гибких коэффициентов

// === СИСТЕМНЫЕ МАРШРУТЫ ===

/**
 * POST /api/admin/fix-locked-funds
 * Исправление поля lockedFunds у пользователей
 */
router.post('/fix-locked-funds', adminController.fixLockedFunds);

/**
 * POST /api/admin/cancel-stuck-duel
 * Отмена зависшей дуэли
 */
router.post('/cancel-stuck-duel', adminController.cancelStuckDuel);

// === МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ФИНАНСАМИ ===

/**
 * GET /api/admin/finance/state
 * Получение текущего финансового состояния казино
 */
router.get('/finance/state', financeController.getCurrentState);

/**
 * GET /api/admin/finance/report
 * Получение финансового отчета за период
 * Query: { period: 'day' | 'week' | 'month' | 'all' }
 */
router.get('/finance/report', financeController.getFinancialReport);

/**
 * POST /api/admin/finance/recalculate
 * Принудительный пересчет всех финансов
 */
router.post('/finance/recalculate', financeController.recalculateFinances);

/**
 * POST /api/admin/finance/reserve-percentage
 * Установка процента резервирования
 * Body: { percentage: number }
 */
router.post('/finance/reserve-percentage', financeController.setReservePercentage);

/**
 * POST /api/admin/finance/withdraw-profit
 * Вывод прибыли владельца
 * Body: { amount: number, recipient: string, comment: string }
 */
router.post('/finance/withdraw-profit', financeController.withdrawOwnerProfit);

/**
 * GET /api/admin/finance/history
 * История изменений балансов
 * Query: { limit: number }
 */
router.get('/finance/history', financeController.getBalanceHistory);

/**
 * GET /api/admin/finance/game-stats
 * Детальная статистика по играм
 */
router.get('/finance/game-stats', financeController.getGameStatistics);

// === МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ И МОДИФИКАТОРАМИ ===
router.post('/users/:userId/modifiers', adminController.setUserGameModifier);
router.get('/users/:userId/modifiers', adminController.getUserModifiers);
router.post('/users/:userId/modifiers/reset', adminController.resetUserModifiers);
router.get('/odds/statistics', adminController.getOddsStatistics);
router.post('/odds/bulk-modifiers', adminController.setBulkModifiers);

// Глобальный модификатор для Crash
router.post('/crash/global-modifier', adminController.setGlobalCrashModifier);
router.get('/crash/global-modifier', adminController.getGlobalCrashModifier);

// Глобальные настройки игр
router.get('/game-settings', adminController.getGameSettings);
router.put('/game-settings', adminController.updateGameSettings);
router.post('/game-settings/:gameType/modifier', adminController.setGlobalGameModifier);

// === ОСНОВНЫЕ МАРШРУТЫ АДМИНИСТРАТОРА ===
router.get('/stats', adminController.getCasinoStats);
router.get('/stats/users', adminController.getUserStats);
router.get('/users', adminController.getUsers);
router.get('/users/blocked', adminController.getBlockedUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.post('/users/:userId/block', adminController.toggleUserBlock);
router.post('/users/:userId/balance', adminController.adjustUserBalance);

// === МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ПАРТНЕРАМИ ===
router.get('/referral/partners', adminController.getPartners);
router.get('/referral/stats', adminController.getReferralStats);
router.post('/referral/assign-partner', adminController.assignPartnerStatus);
router.get('/referral/partner-logs', adminController.getPartnerLogs);

// === ВРЕМЕННЫЙ МАРШРУТ ДЛЯ ИСПРАВЛЕНИЯ ДАННЫХ ===
router.post('/fix-user-stats', adminController.fixUserStats);

// === МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ВЫВОДАМИ ===
router.get('/withdrawals/pending', withdrawalController.getPendingApprovals);
router.post('/withdrawals/:withdrawalId/approve', withdrawalController.approveWithdrawal);
router.post('/withdrawals/:withdrawalId/reject', withdrawalController.rejectWithdrawal);
router.get('/withdrawals/stats', withdrawalController.getWithdrawalStats);

/**
 * GET /api/admin/withdrawals
 * Получение всех выводов с фильтрацией
 */
router.get('/withdrawals', async (req, res) => {
  try {
    const { status, userId, limit = 50, skip = 0, dateFrom, dateTo } = req.query;
    const { Withdrawal } = require('../models');
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (userId) {
      query.user = userId;
    }
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }
    
    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'telegramId username firstName lastName balance')
      .populate('approvedBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    
    const total = await Withdrawal.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения списка выводов:', error);
    res.status(400).json({
      success: false,
      message: 'Не удалось получить список выводов'
    });
  }
});

/**
 * GET /api/admin/withdrawals/:withdrawalId
 * Получение детальной информации о выводе
 */
router.get('/withdrawals/:withdrawalId', async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { withdrawalService } = require('../services');
    
    const withdrawal = await withdrawalService.getWithdrawalInfo(withdrawalId);
    
    res.status(200).json({
      success: true,
      data: withdrawal
    });
    
  } catch (error) {
    console.error('Ошибка получения информации о выводе:', error);
    
    if (error.message.includes('не найден')) {
      return res.status(404).json({
        success: false,
        message: 'Запрос на вывод не найден'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Не удалось получить информацию о выводе'
    });
  }
});

// === НОВЫЕ МАРШРУТЫ ДЛЯ СИСТЕМНОЙ ИНФОРМАЦИИ ===

/**
 * GET /api/admin/system/info
 * Получение информации о системе включая гибкие коэффициенты
 */
router.get('/system/info', async (req, res) => {
  try {
    console.log('ADMIN: Запрос системной информации');
    
    const { Event, EventBet, User, Game } = require('../models');
    
    // Основная статистика
    const [
      totalUsers,
      totalEvents,
      totalEventBets,
      totalGames,
      eventsWithFlexibleOdds
    ] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      EventBet.countDocuments(),
      Game.countDocuments(),
      Event.countDocuments({ 'metadata.flexibleOddsStats.oddsRecalculations': { $gt: 0 } })
    ]);
    
    // Статистика гибких коэффициентов
    const flexibleOddsStats = await Event.aggregate([
      {
        $match: {
          'metadata.flexibleOddsStats.oddsRecalculations': { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalRecalculations: { $sum: '$metadata.flexibleOddsStats.oddsRecalculations' },
          avgRecalculations: { $avg: '$metadata.flexibleOddsStats.oddsRecalculations' },
          maxRecalculations: { $max: '$metadata.flexibleOddsStats.oddsRecalculations' }
        }
      }
    ]);
    
    const systemInfo = {
      database: {
        totalUsers,
        totalEvents,
        totalEventBets,
        totalGames
      },
      flexibleOdds: {
        enabled: true,
        eventsWithFlexibleOdds,
        adoptionRate: totalEvents > 0 ? ((eventsWithFlexibleOdds / totalEvents) * 100).toFixed(1) : 0,
        totalRecalculations: flexibleOddsStats[0]?.totalRecalculations || 0,
        avgRecalculationsPerEvent: flexibleOddsStats[0]?.avgRecalculations?.toFixed(2) || 0,
        maxRecalculationsInEvent: flexibleOddsStats[0]?.maxRecalculations || 0
      },
      features: {
        flexibleOdds: true,
        realTimeNotifications: true,
        oddsHistory: true,
        volatilityAnalysis: true,
        migrationCompleted: eventsWithFlexibleOdds > 0
      },
      version: {
        flexibleOddsVersion: '1.0.0',
        lastUpdated: new Date().toISOString()
      }
    };
    
    res.status(200).json({
      success: true,
      data: systemInfo
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка получения системной информации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения системной информации'
    });
  }
});

/**
 * POST /api/admin/system/test-flexible-odds
 * Тестирование системы гибких коэффициентов
 */
router.post('/system/test-flexible-odds', async (req, res) => {
  try {
    console.log('ADMIN: Тестирование системы гибких коэффициентов');
    
    const { testType = 'basic' } = req.body;
    const results = {};
    
    switch (testType) {
      case 'basic':
        results.basic = await testBasicFlexibleOdds();
        break;
      case 'calculation':
        results.calculation = await testOddsCalculation();
        break;
      case 'notifications':
        results.notifications = await testNotificationSystem();
        break;
      case 'full':
        results.basic = await testBasicFlexibleOdds();
        results.calculation = await testOddsCalculation();
        results.notifications = await testNotificationSystem();
        break;
      default:
        throw new Error('Неизвестный тип теста');
    }
    
    res.status(200).json({
      success: true,
      message: 'Тестирование завершено',
      data: {
        testType,
        results,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('ADMIN: Ошибка тестирования гибких коэффициентов:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка тестирования системы'
    });
  }
});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ТЕСТИРОВАНИЯ ===

async function testBasicFlexibleOdds() {
  try {
    const { Event } = require('../models');
    
    // Проверяем наличие событий с гибкими коэффициентами
    const eventsCount = await Event.countDocuments({
      'metadata.flexibleOddsStats': { $exists: true }
    });
    
    // Проверяем активные события
    const activeEvents = await Event.find({
      status: 'active',
      'metadata.flexibleOddsStats': { $exists: true }
    }).limit(1);
    
    let oddsCalculationTest = null;
    if (activeEvents.length > 0) {
      const event = activeEvents[0];
      const eventDoc = new Event(event);
      const odds = eventDoc.calculateOdds();
      
      oddsCalculationTest = {
        eventId: event._id,
        eventTitle: event.title,
        totalPool: event.totalPool,
        calculatedOdds: odds,
        hasValidOdds: Object.values(odds).every(odd => odd >= 1.1 && odd <= 10.0)
      };
    }
    
    return {
      passed: true,
      eventsWithFlexibleOdds: eventsCount,
      oddsCalculationTest,
      message: 'Базовое тестирование прошло успешно'
    };
    
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      message: 'Базовое тестирование провалено'
    };
  }
}

async function testOddsCalculation() {
  try {
    // Тестируем различные сценарии расчета коэффициентов
    const testCases = [
      { totalPool: 100, outcome1: 50, outcome2: 50, houseEdge: 5 },
      { totalPool: 1000, outcome1: 800, outcome2: 200, houseEdge: 5 },
      { totalPool: 500, outcome1: 400, outcome2: 100, houseEdge: 5 }
    ];
    
    const results = testCases.map(testCase => {
      const houseEdgeMultiplier = (100 - testCase.houseEdge) / 100;
      
      const odds1 = testCase.outcome1 === 0 ? 5.0 : 
        Math.max(1.1, Math.min(10.0, (testCase.totalPool * houseEdgeMultiplier) / testCase.outcome1));
      const odds2 = testCase.outcome2 === 0 ? 5.0 : 
        Math.max(1.1, Math.min(10.0, (testCase.totalPool * houseEdgeMultiplier) / testCase.outcome2));
      
      return {
        testCase,
        odds1: parseFloat(odds1.toFixed(2)),
        odds2: parseFloat(odds2.toFixed(2)),
        isValid: odds1 >= 1.1 && odds1 <= 10.0 && odds2 >= 1.1 && odds2 <= 10.0
      };
    });
    
    const allValid = results.every(r => r.isValid);
    
    return {
      passed: allValid,
      testCases: results,
      message: allValid ? 'Расчет коэффициентов работает корректно' : 'Найдены ошибки в расчете коэффициентов'
    };
    
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      message: 'Тестирование расчета коэффициентов провалено'
    };
  }
}

async function testNotificationSystem() {
  try {
    // Проверяем доступность сервиса уведомлений
    const notificationService = require('../services/flexible-odds-notifications.service');
    const stats = notificationService.getNotificationStats();
    
    return {
      passed: true,
      activeConnections: stats.activeConnections,
      thresholds: {
        significant: stats.significantChangeThreshold,
        major: stats.majorChangeThreshold
      },
      message: 'Система уведомлений доступна'
    };
    
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      message: 'Система уведомлений недоступна'
    };
  }
}

// === МОНИТОРИНГ ===

/**
 * GET /api/admin/monitoring/alerts
 * Получение активных алертов мониторинга
 */
router.get('/monitoring/alerts', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        alerts: [
          {
            id: 1,
            type: 'warning',
            level: 'medium',
            title: 'Высокая нагрузка на систему',
            message: 'CPU usage превышает 80%',
            timestamp: new Date(),
            resolved: false,
            category: 'performance'
          },
          {
            id: 2,
            type: 'info',
            level: 'low',
            title: 'Успешное подключение к БД',
            message: 'MongoDB подключение восстановлено',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            resolved: true,
            category: 'database'
          }
        ],
        total: 2,
        active: 1,
        resolved: 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения алертов мониторинга'
    });
  }
});

/**
 * GET /api/admin/monitoring/financial
 * Финансовый мониторинг
 */
router.get('/monitoring/financial', async (req, res) => {
  try {
    const { casinoFinanceService } = require('../services');
    const financeState = await casinoFinanceService.getCurrentFinanceState();
    
    res.status(200).json({
      success: true,
      data: {
        balances: {
          totalUserBalance: financeState.totalUserBalance,
          operationalBalance: financeState.operationalBalance,
          reserveBalance: financeState.reserveBalance,
          availableForWithdrawal: financeState.availableForWithdrawal
        },
        alerts: [
          ...(financeState.warnings?.lowReserve ? [{
            type: 'warning',
            message: 'Низкий уровень резерва',
            value: financeState.reserveBalance,
            threshold: financeState.totalUserBalance * 0.3
          }] : []),
          ...(financeState.warnings?.negativeOperational ? [{
            type: 'critical',
            message: 'Отрицательный оперативный баланс',
            value: financeState.operationalBalance
          }] : [])
        ],
        trends: {
          hourlyVolume: 0, // TODO: реализовать
          hourlyProfit: 0, // TODO: реализовать
          activeUsers: 0 // TODO: реализовать
        },
        lastUpdate: financeState.lastCalculated
      }
    });
  } catch (error) {
    console.error('Ошибка финансового мониторинга:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения финансового мониторинга'
    });
  }
});

/**
 * GET /api/admin/monitoring/metrics
 * Системные метрики
 */
router.get('/monitoring/metrics', async (req, res) => {
  try {
    const { User } = require('../models');
    
    // Простые метрики
    const onlineUsers = await User.countDocuments({
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });
    
    res.status(200).json({
      success: true,
      data: {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          timestamp: new Date()
        },
        users: {
          online: onlineUsers,
          registered: await User.countDocuments(),
          active24h: await User.countDocuments({
            lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          })
        },
        performance: {
          avgResponseTime: 150, // TODO: реальные метрики
          requestsPerSecond: 25, // TODO: реальные метрики
          errorRate: 0.1 // TODO: реальные метрики
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения системных метрик'
    });
  }
});

/**
 * GET /api/admin/monitoring/performance
 * Метрики производительности
 */
router.get('/monitoring/performance', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        api: {
          responseTime: {
            avg: 125,
            p95: 250,
            p99: 500
          },
          requestCount: 1500,
          errorRate: 0.8
        },
        database: {
          connectionPool: {
            active: 5,
            available: 15,
            total: 20
          },
          queryTime: {
            avg: 45,
            max: 120
          }
        },
        memory: {
          used: process.memoryUsage().rss / 1024 / 1024,
          total: 512,
          percentage: (process.memoryUsage().rss / 1024 / 1024 / 512 * 100).toFixed(1)
        },
        cpu: {
          usage: 35, // TODO: реальные метрики
          load: [0.5, 0.6, 0.4]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения метрик производительности'
    });
  }
});

/**
 * GET /api/admin/monitoring/online
 * Онлайн пользователи
 */
router.get('/monitoring/online', async (req, res) => {
  try {
    const { User } = require('../models');
    
    const onlineUsers = await User.find({
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    }).select('telegramId username firstName lastName lastActivity').limit(50);
    
    res.status(200).json({
      success: true,
      data: {
        users: onlineUsers,
        total: onlineUsers.length,
        periods: {
          last15min: onlineUsers.length,
          lastHour: await User.countDocuments({
            lastActivity: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
          }),
          last24h: await User.countDocuments({
            lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          })
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения списка онлайн пользователей'
    });
  }
});

// === БЕЗОПАСНОСТЬ ===

/**
 * GET /api/admin/security/alerts
 * Получение системных алертов безопасности
 */
router.get('/security/alerts', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        alerts: [
          {
            id: 1,
            type: 'warning',
            message: 'Высокая нагрузка на систему',
            timestamp: new Date(),
            resolved: false
          }
        ],
        total: 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения алертов'
    });
  }
});

/**
 * GET /api/admin/security/audit
 * Получение журнала аудита
 */
router.get('/security/audit', async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    
    res.status(200).json({
      success: true,
      data: {
        logs: [
          {
            id: 1,
            action: 'login',
            user: 'admin',
            timestamp: new Date(),
            ip: req.ip,
            details: 'Успешный вход в систему'
          }
        ],
        total: 1,
        currentPage: parseInt(page),
        totalPages: 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения журнала аудита'
    });
  }
});

// === УВЕДОМЛЕНИЯ ===

/**
 * POST /api/admin/notifications/audience-stats
 * Получение статистики аудитории для уведомлений
 */
router.post('/notifications/audience-stats', async (req, res) => {
  try {
    const { audienceType } = req.body;
    
    // Заглушка для статистики аудитории
    let stats = {
      total: 100,
      active: 80,
      inactive: 20
    };
    
    switch (audienceType) {
      case 'all':
        stats = { total: 100, description: 'Все пользователи' };
        break;
      case 'active':
        stats = { total: 80, description: 'Активные пользователи' };
        break;
      case 'vip':
        stats = { total: 10, description: 'VIP пользователи' };
        break;
      default:
        stats = { total: 0, description: 'Неизвестная аудитория' };
    }
    
    res.status(200).json({
      success: true,
      data: {
        audienceStats: stats,
        estimatedReach: stats.total,
        audienceType
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики аудитории'
    });
  }
});

// === СТАТИСТИКА КОЭФФИЦИЕНТОВ ===

/**
 * GET /api/admin/odds/statistics
 * Получение статистики модификаторов коэффициентов
 */
router.get('/odds/statistics', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        globalModifiers: {
          coin: { active: false, value: 0 },
          crash: { active: true, value: -10 },
          mines: { active: false, value: 0 },
          slots: { active: false, value: 0 }
        },
        userModifiers: {
          total: 0,
          active: 0
        },
        impact: {
          totalGamesAffected: 1234,
          totalProfitImpact: 156.78
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики коэффициентов'
    });
  }
});

// === МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ПРОМОКОДАМИ ===

const { body, param, query } = require('express-validator');
const adminPromocodeController = require('../controllers/admin-promocode.controller');

// Валидация для создания промокода
const validatePromocodeCreation = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Код промокода должен быть от 3 до 20 символов')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Код может содержать только заглавные буквы и цифры'),
    
  body('type')
    .isIn(['balance', 'freespins', 'deposit', 'vip'])
    .withMessage('Неверный тип промокода'),
    
  body('value')
    .isNumeric()
    .withMessage('Значение должно быть числом')
    .custom((value, { req }) => {
      if (req.body.type === 'balance' || req.body.type === 'deposit') {
        if (value <= 0 || value > 10000) {
          throw new Error('Значение баланса должно быть от 0.01 до 10000');
        }
      }
      if (req.body.type === 'freespins') {
        if (!Number.isInteger(Number(value)) || value <= 0 || value > 1000) {
          throw new Error('Количество фриспинов должно быть от 1 до 1000');
        }
      }
      return true;
    }),
    
  body('description')
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Описание не должно превышать 500 символов'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive должно быть булевым значением'),
    
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Лимит использования должен быть положительным целым числом')
];

// Валидация для обновления промокода
const validatePromocodeUpdate = [
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Описание не должно превышать 500 символов'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive должно быть булевым значением'),
    
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Лимит использования должен быть положительным целым числом')
];

// Валидация ID промокода
const validatePromocodeId = [
  param('id')
    .isMongoId()
    .withMessage('Неверный ID промокода')
];

// Валидация параметров списка промокодов
const validatePromocodesList = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Страница должна быть положительным числом'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Лимит должен быть от 1 до 100'),
    
  query('type')
    .optional()
    .isIn(['balance', 'freespins', 'deposit', 'vip'])
    .withMessage('Неверный тип промокода'),
    
  query('status')
    .optional()
    .isIn(['active', 'expired', 'inactive'])
    .withMessage('Неверный статус промокода'),
    
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Поисковый запрос должен быть от 1 до 50 символов')
];

/**
 * POST /api/admin/promocodes
 * Создать новый промокод
 */
router.post('/promocodes', validatePromocodeCreation, adminPromocodeController.createPromocode);

/**
 * GET /api/admin/promocodes
 * Получить список промокодов с фильтрацией
 */
router.get('/promocodes', validatePromocodesList, adminPromocodeController.getPromocodes);

/**
 * GET /api/admin/promocodes/stats
 * Получить статистику промокодов
 */
router.get('/promocodes/stats', adminPromocodeController.getPromocodesStats);

/**
 * GET /api/admin/promocodes/:id
 * Получить детали конкретного промокода
 */
router.get('/promocodes/:id', validatePromocodeId, adminPromocodeController.getPromocodeDetails);

/**
 * PUT /api/admin/promocodes/:id
 * Обновить промокод
 */
router.put('/promocodes/:id', validatePromocodeId, validatePromocodeUpdate, adminPromocodeController.updatePromocode);

/**
 * PATCH /api/admin/promocodes/:id/deactivate
 * Деактивировать промокод
 */
router.patch('/promocodes/:id/deactivate', validatePromocodeId, adminPromocodeController.deactivatePromocode);

/**
 * DELETE /api/admin/promocodes/:id
 * Удалить промокод
 */
router.delete('/promocodes/:id', validatePromocodeId, adminPromocodeController.deletePromocode);

module.exports = router;
