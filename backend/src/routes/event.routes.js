// backend/src/routes/event.routes.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const { eventController } = require('../controllers');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware');

const router = express.Router();

console.log('EVENT ROUTES: Регистрация маршрутов событий');

// === ВАЖНО: СПЕЦИФИЧНЫЕ МАРШРУТЫ ИДУТ ПЕРЕД ПАРАМЕТРИЗОВАННЫМИ ===

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

// === МАРШРУТЫ ДЛЯ СТАТИСТИКИ ===
router.get('/stats/general', 
  eventController.getStatistics
);

// === АДМИНСКИЕ МАРШРУТЫ ===
router.get('/admin/all', 
  adminAuthMiddleware, 
  eventController.getAllEvents
);

router.post('/admin/create', 
  adminAuthMiddleware, 
  eventController.createEvent
);

router.get('/admin/:eventId', 
  adminAuthMiddleware, 
  eventController.getEventById
);

router.put('/admin/:eventId/finish', 
  adminAuthMiddleware, 
  eventController.finishEvent
);

// === ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ ДЛЯ СТАВОК ===

// Получить ставки пользователя - ИСПРАВЛЕННЫЙ МАРШРУТ
router.get('/user/bets', 
  telegramAuthMiddleware, 
  eventController.getUserBets
);

// === МАРШРУТЫ С ПАРАМЕТРОМ eventId ===

// Разместить ставку на событие
router.post('/:eventId/bet', 
  telegramAuthMiddleware, 
  eventController.placeBet
);

// Получить событие по ID (ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ)
router.get('/:eventId', 
  telegramAuthMiddleware, 
  eventController.getEventById
);

console.log('EVENT ROUTES: Маршруты событий зарегистрированы');

module.exports = router;
