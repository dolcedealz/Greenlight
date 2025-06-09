// backend/src/routes/monitoring.routes.js
const express = require('express');
const { adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// Безопасная загрузка контроллера мониторинга
let monitoringController;
try {
  monitoringController = require('../controllers/monitoring.controller');
} catch (error) {
  console.error('Ошибка загрузки monitoring controller:', error.message);
  // Создаем заглушку контроллера
  monitoringController = {
    checkBalances: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    getMonitoringStats: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    getNotifications: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    startMonitoring: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    stopMonitoring: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    updateSettings: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    getCryptoBotBalance: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' }),
    getSystemBalance: (req, res) => res.status(503).json({ success: false, message: 'Сервис мониторинга временно недоступен' })
  };
}

/**
 * Маршруты для мониторинга балансов
 * Все маршруты требуют аутентификации администратора
 */

// Ручная проверка балансов
router.post('/check-balances', adminAuthMiddleware, monitoringController.checkBalances);

// Получение статистики мониторинга
router.get('/stats', adminAuthMiddleware, monitoringController.getMonitoringStats);

// Получение уведомлений
router.get('/notifications', adminAuthMiddleware, monitoringController.getNotifications);

// Управление автоматическим мониторингом
router.post('/start', adminAuthMiddleware, monitoringController.startMonitoring);
router.post('/stop', adminAuthMiddleware, monitoringController.stopMonitoring);

// Обновление настроек мониторинга
router.put('/settings', adminAuthMiddleware, monitoringController.updateSettings);

// Получение балансов
router.get('/cryptobot-balance', adminAuthMiddleware, monitoringController.getCryptoBotBalance);
router.get('/system-balance', adminAuthMiddleware, monitoringController.getSystemBalance);

module.exports = router;