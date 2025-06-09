// backend/src/routes/monitoring.routes.js
const express = require('express');
const { monitoringController } = require('../controllers');
const { authMiddleware } = require('../middleware');

const router = express.Router();

/**
 * Маршруты для мониторинга балансов
 * Все маршруты требуют аутентификации администратора
 */

// Ручная проверка балансов
router.post('/check-balances', authMiddleware.requireAdmin, monitoringController.checkBalances);

// Получение статистики мониторинга
router.get('/stats', authMiddleware.requireAdmin, monitoringController.getMonitoringStats);

// Получение уведомлений
router.get('/notifications', authMiddleware.requireAdmin, monitoringController.getNotifications);

// Управление автоматическим мониторингом
router.post('/start', authMiddleware.requireAdmin, monitoringController.startMonitoring);
router.post('/stop', authMiddleware.requireAdmin, monitoringController.stopMonitoring);

// Обновление настроек мониторинга
router.put('/settings', authMiddleware.requireAdmin, monitoringController.updateSettings);

// Получение балансов
router.get('/cryptobot-balance', authMiddleware.requireAdmin, monitoringController.getCryptoBotBalance);
router.get('/system-balance', authMiddleware.requireAdmin, monitoringController.getSystemBalance);

module.exports = router;