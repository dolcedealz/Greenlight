// backend/src/routes/event.routes.js
const express = require('express');
const { eventController } = require('../controllers');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// === ПУБЛИЧНЫЕ МАРШРУТЫ (для пользователей) ===

// Получить активные события
router.get('/active', 
  telegramAuthMiddleware, 
  eventController.getActiveEvents
);

// Получить главное событие
router.get('/featured', 
  telegramAuthMiddleware, 
  eventController.getFeaturedEvent
);

// Получить событие по ID
router.get('/:eventId', 
  telegramAuthMiddleware, 
  eventController.getEventById
);

// Разместить ставку на событие
router.post('/bet', 
  telegramAuthMiddleware, 
  eventController.placeBet
);

// Получить ставки пользователя
router.get('/user/bets', 
  telegramAuthMiddleware, 
  eventController.getUserBets
);

// === МАРШРУТЫ ДЛЯ СТАТИСТИКИ ===

// Получить общую статистику событий
router.get('/stats/general', 
  eventController.getStatistics
);

// === АДМИНСКИЕ МАРШРУТЫ ===

// Получить все события (только для админа)
router.get('/admin/all', 
  adminAuthMiddleware, 
  eventController.getAllEvents
);

// Создать новое событие (только для админа)
router.post('/admin/create', 
  adminAuthMiddleware, 
  eventController.createEvent
);

// Завершить событие (только для админа)
router.put('/admin/:eventId/finish', 
  adminAuthMiddleware, 
  eventController.finishEvent
);

module.exports = router;
