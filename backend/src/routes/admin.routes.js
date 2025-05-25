// backend/src/routes/admin.routes.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const { adminController, withdrawalController } = require('../controllers');
const { adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// Применяем middleware для проверки админских прав
router.use(adminAuthMiddleware);

// === СУЩЕСТВУЮЩИЕ МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ШАНСАМИ ===
router.post('/win-chance/base', adminController.setBaseWinChance);
router.post('/win-chance/user', adminController.setUserWinChanceModifier);
router.get('/win-chance/settings', adminController.getWinChanceSettings);
router.get('/win-chance/user', adminController.getUserWinChanceModifier);

// === НОВЫЕ МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ВЫВОДАМИ ===

/**
 * GET /api/admin/withdrawals/pending
 * Получение списка выводов, требующих одобрения администратора
 */
router.get('/withdrawals/pending', withdrawalController.getPendingApprovals);

/**
 * POST /api/admin/withdrawals/:withdrawalId/approve
 * Одобрение запроса на вывод
 */
router.post('/withdrawals/:withdrawalId/approve', withdrawalController.approveWithdrawal);

/**
 * POST /api/admin/withdrawals/:withdrawalId/reject
 * Отклонение запроса на вывод
 * Body: { reason: "Причина отклонения" }
 */
router.post('/withdrawals/:withdrawalId/reject', withdrawalController.rejectWithdrawal);

/**
 * GET /api/admin/withdrawals/stats
 * Получение общей статистики по выводам
 * Query: { userId?: string } - опционально для статистики конкретного пользователя
 */
router.get('/withdrawals/stats', withdrawalController.getWithdrawalStats);

/**
 * GET /api/admin/withdrawals
 * Получение всех выводов с фильтрацией
 * Query параметры:
 * - status: фильтр по статусу
 * - userId: фильтр по пользователю
 * - limit: количество записей
 * - skip: смещение для пагинации
 * - dateFrom: начальная дата
 * - dateTo: конечная дата
 */
router.get('/withdrawals', async (req, res) => {
  try {
    const { status, userId, limit = 50, skip = 0, dateFrom, dateTo } = req.query;
    const { Withdrawal } = require('../models');
    
    // Строим условия запроса
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
    
    // Получаем выводы
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
 * Получение детальной информации о выводе (для администратора)
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