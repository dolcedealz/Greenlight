// backend/src/controllers/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const gameController = require('./game.controller');
const userController = require('./user.controller');
const adminController = require('./admin.controller');
const paymentController = require('./payment.controller');
const withdrawalController = require('./withdrawal.controller');
const financeController = require('./finance.controller');
const referralController = require('./referral.controller');
const crashController = require('./crash.controller');
const authController = require('./auth.controller');
const eventController = require('./event.controller'); // Добавляем события
const giveawayController = require('./giveaway.controller');

// Безопасная загрузка контроллера мониторинга
let monitoringController;
try {
  monitoringController = require('./monitoring.controller');
} catch (error) {
  console.error('Ошибка загрузки monitoring controller:', error.message);
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

module.exports = {
  gameController,
  userController,
  adminController,
  paymentController,
  withdrawalController,
  financeController,
  referralController,
  crashController,
  authController,
  eventController, // Добавляем события
  giveawayController,
  monitoringController
};
