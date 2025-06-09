// backend/src/routes/monitoring.routes.js
const express = require('express');
const { authMiddleware } = require('../middleware');

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