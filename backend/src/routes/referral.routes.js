// backend/src/routes/referral.routes.js
const express = require('express');
const { referralController } = require('../controllers');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// =================
// ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ (требуют обычной аутентификации)
// =================

// Применяем middleware аутентификации ко всем маршрутам ниже
router.use(telegramAuthMiddleware);

/**
 * GET /api/referrals/stats
 * Получить статистику текущего пользователя как партнера
 * Query: { period: 'day' | 'week' | 'month' }
 */
router.get('/stats', referralController.getPartnerStats);

/**
 * POST /api/referrals/payout
 * Перевести реферальный баланс на основной
 * Body: { amount?: number } - если не указано, переводится весь баланс
 */
router.post('/payout', referralController.createPayout);

/**
 * GET /api/referrals/earnings
 * История начислений
 * Query: { limit: 50, skip: 0, type: 'game_loss' | 'registration_bonus' }
 */
router.get('/earnings', referralController.getEarningsHistory);

/**
 * GET /api/referrals/payouts
 * История выплат
 * Query: { limit: 20, skip: 0 }
 */
router.get('/payouts', referralController.getPayoutsHistory);

/**
 * GET /api/referrals/list
 * Список рефералов текущего пользователя
 * Query: { activeOnly: boolean, limit: 50, skip: 0 }
 */
router.get('/list', referralController.getReferrals);

// =================
// АДМИНСКИЕ МАРШРУТЫ (требуют админской аутентификации)
// =================

/**
 * GET /api/referrals/admin/stats
 * Общая статистика реферальной системы
 * Query: { period: 'day' | 'week' | 'month' | 'year' }
 */
router.get('/admin/stats', adminAuthMiddleware, referralController.getSystemStats);

/**
 * GET /api/referrals/admin/top-partners
 * Топ партнеров
 * Query: { limit: 10, period?: date }
 */
router.get('/admin/top-partners', adminAuthMiddleware, referralController.getTopPartners);

/**
 * GET /api/referrals/admin/partner/:partnerId
 * Детальная статистика партнера
 * Query: { period: 'day' | 'week' | 'month' }
 */
router.get('/admin/partner/:partnerId', adminAuthMiddleware, referralController.getPartnerStats);

/**
 * GET /api/referrals/admin/fraud
 * Обнаружение подозрительной активности
 */
router.get('/admin/fraud', adminAuthMiddleware, referralController.detectFraud);

/**
 * POST /api/referrals/admin/payouts/:payoutId/approve
 * Одобрить выплату партнеру
 */
router.post('/admin/payouts/:payoutId/approve', adminAuthMiddleware, referralController.approvePayout);

/**
 * PUT /api/referrals/admin/partner/:partnerId/level
 * Изменить уровень партнера вручную
 * Body: { level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip' }
 */
router.put('/admin/partner/:partnerId/level', adminAuthMiddleware, referralController.updatePartnerLevel);

/**
 * GET /api/referrals/admin/earnings
 * Все начисления в системе
 * Query: { limit: 100, skip: 0, partnerId?: string, referralId?: string }
 */
router.get('/admin/earnings', adminAuthMiddleware, async (req, res) => {
  try {
    const { limit = 100, skip = 0, partnerId, referralId } = req.query;
    const { ReferralEarning } = require('../models');
    
    const query = { status: 'credited' };
    if (partnerId) query.partner = partnerId;
    if (referralId) query.referral = referralId;
    
    const earnings = await ReferralEarning.find(query)
      .populate('partner', 'telegramId username firstName lastName')
      .populate('referral', 'telegramId username firstName lastName')
      .populate('game', 'gameType bet profit')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    
    const total = await ReferralEarning.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        earnings,
        total,
        totalAmount: earnings.reduce((sum, e) => sum + e.calculation.earnedAmount, 0)
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/referrals/admin/payouts
 * Все выплаты в системе
 * Query: { limit: 50, skip: 0, status?: string }
 */
router.get('/admin/payouts', adminAuthMiddleware, async (req, res) => {
  try {
    const { limit = 50, skip = 0, status } = req.query;
    const { ReferralPayout } = require('../models');
    
    const query = {};
    if (status) query.status = status;
    
    const payouts = await ReferralPayout.find(query)
      .populate('partner', 'telegramId username firstName lastName referralStats')
      .populate('processing.approvedBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    
    const total = await ReferralPayout.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        payouts,
        total
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// =================
// ОБРАБОТКА ОШИБОК
// =================

/**
 * Middleware для обработки ошибок в реферальных маршрутах
 */
router.use((error, req, res, next) => {
  console.error('Ошибка в Referral API:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  let statusCode = 500;
  let message = 'Внутренняя ошибка сервера';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Ошибка валидации данных';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Некорректный формат данных';
  } else if (error.message.includes('не найден')) {
    statusCode = 404;
    message = error.message;
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    })
  });
});

module.exports = router;