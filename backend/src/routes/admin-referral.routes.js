// backend/src/routes/admin-referral.routes.js
const express = require('express');
const router = express.Router();
const referralService = require('../services/referral.service');

/**
 * Получить список всех партнеров
 * GET /admin/referral/partners
 */
router.get('/partners', async (req, res) => {
  try {
    const { page = 1, limit = 10, level = null } = req.query;
    
    const options = {
      level: level,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sortBy: 'assignedAt',
      sortOrder: 'desc'
    };
    
    const result = await referralService.getAllPartners(options);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('ADMIN: Ошибка получения списка партнеров:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Назначить партнерский статус пользователю
 * POST /admin/referral/assign-partner
 */
router.post('/assign-partner', async (req, res) => {
  try {
    const { userId, newLevel, reason = '', metadata = {} } = req.body;
    
    if (!userId || !newLevel) {
      return res.status(400).json({
        success: false,
        message: 'Требуются параметры userId и newLevel'
      });
    }
    
    // Получаем ID админа из токена или используем временный ID
    // TODO: Добавить полноценную авторизацию админа
    let adminId = req.user?.id || req.body.adminId;
    
    // Временное решение: используем первого админа из базы
    if (!adminId) {
      const { User } = require('../models');
      const admin = await User.findOne({ role: 'admin' });
      adminId = admin?._id;
      
      if (!adminId) {
        return res.status(401).json({
          success: false,
          message: 'Не удалось определить администратора'
        });
      }
    }
    
    const result = await referralService.assignPartnerLevel(
      userId, 
      newLevel, 
      adminId, 
      reason, 
      metadata
    );
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('ADMIN: Ошибка назначения партнерского статуса:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Получить историю изменений партнерских статусов
 * GET /admin/referral/partner-logs
 */
router.get('/partner-logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userId = null, 
      action = null, 
      adminId = null,
      startDate = null,
      endDate = null
    } = req.query;
    
    const options = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      action: action,
      adminId: adminId,
      startDate: startDate,
      endDate: endDate
    };
    
    const result = await referralService.getPartnerLogs(userId, options);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('ADMIN: Ошибка получения логов партнеров:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Получить статистику партнерской программы
 * GET /admin/referral/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { period = null } = req.query;
    
    let periodStart = null;
    if (period) {
      const now = new Date();
      switch (period) {
        case 'today':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    
    const stats = await referralService.getSystemStatistics(periodStart);
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('ADMIN: Ошибка получения статистики партнеров:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Получить детальную информацию о партнере
 * GET /admin/referral/partner/:partnerId
 */
router.get('/partner/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { period = null } = req.query;
    
    let periodStart = null;
    if (period) {
      const now = new Date();
      switch (period) {
        case 'today':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }
    
    const partnerStats = await referralService.getPartnerStatistics(partnerId, periodStart);
    
    return res.json({
      success: true,
      data: partnerStats
    });
  } catch (error) {
    console.error('ADMIN: Ошибка получения информации о партнере:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Обнаружить подозрительную активность в реферальной системе
 * GET /admin/referral/fraud-detection
 */
router.get('/fraud-detection', async (req, res) => {
  try {
    const suspiciousPatterns = await referralService.detectFraudulentActivity();
    
    return res.json({
      success: true,
      data: {
        suspiciousPatterns: suspiciousPatterns,
        count: suspiciousPatterns.length
      }
    });
  } catch (error) {
    console.error('ADMIN: Ошибка обнаружения мошенничества:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;