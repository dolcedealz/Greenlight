// backend/src/routes/admin.routes.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ФИНАНСАМИ
const express = require('express');
const { adminController, withdrawalController, financeController } = require('../controllers');
const { adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// Применяем middleware для проверки админских прав
router.use(adminAuthMiddleware);

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

// === СУЩЕСТВУЮЩИЕ МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ ===
router.post('/win-chance/base', adminController.setBaseWinChance);
router.post('/win-chance/user', adminController.setUserWinChanceModifier);
router.get('/win-chance/settings', adminController.getWinChanceSettings);
router.get('/win-chance/user', adminController.getUserWinChanceModifier);

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

module.exports = router;