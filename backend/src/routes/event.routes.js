// backend/src/routes/event.routes.js
const express = require('express');
const { eventController } = require('../controllers');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// === ПУБЛИЧНЫЕ МАРШРУТЫ (для пользователей) ===

// Получить активные события
router.get('/active', eventController.getActiveEvents);

// Получить главное событие
router.get('/featured', eventController.getFeaturedEvent);

// Получить событие по ID
router.get('/:eventId', eventController.getEventById);

// Разместить ставку (требует аутентификации)
router.post('/bet', telegramAuthMiddleware, eventController.placeBet);

// Получить ставки пользователя (требует аутентификации)
router.get('/user/bets', telegramAuthMiddleware, eventController.getUserBets);

// Получить общую статистику
router.get('/stats/general', eventController.getStatistics);

// === АДМИНСКИЕ МАРШРУТЫ ===

// Получить все события (админ)
router.get('/admin/all', adminAuthMiddleware, eventController.getAllEvents);

// Создать событие (админ)
router.post('/admin/create', adminAuthMiddleware, eventController.createEvent);

// Завершить событие (админ)
router.put('/admin/:eventId/finish', adminAuthMiddleware, eventController.finishEvent);

module.exports = router;
