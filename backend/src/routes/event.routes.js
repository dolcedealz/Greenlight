// backend/src/routes/event.routes.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const { eventController } = require('../controllers');
const { 
  telegramAuthMiddleware, 
  adminAuthMiddleware, 
  bettingLimit, 
  generalLimit, 
  adminLimit,
  validatePlaceBet,
  validateCreateEvent,
  validateFinishEvent,
  validateObjectId,
  sanitizeStrings
} = require('../middleware');

const router = express.Router();

console.log('EVENT ROUTES: Регистрация маршрутов событий');

// === ВАЖНО: СПЕЦИФИЧНЫЕ МАРШРУТЫ ИДУТ ПЕРЕД ПАРАМЕТРИЗОВАННЫМИ ===

// Получить активные события
router.get('/active', 
  generalLimit,
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
  adminLimit,
  sanitizeStrings,
  validateCreateEvent,
  adminAuthMiddleware, 
  eventController.createEvent
);

router.get('/admin/:eventId', 
  adminLimit,
  validateObjectId('eventId'),
  adminAuthMiddleware, 
  eventController.getEventByIdAdmin
);

router.put('/admin/:eventId/finish', 
  adminLimit,
  sanitizeStrings,
  validateFinishEvent,
  adminAuthMiddleware, 
  eventController.finishEvent
);

// Установить событие как главное
router.patch('/admin/:eventId/featured', 
  adminLimit,
  validateObjectId('eventId'),
  adminAuthMiddleware, 
  eventController.setFeaturedEvent
);

// Убрать главное событие
router.patch('/admin/featured/unset', 
  adminLimit,
  adminAuthMiddleware, 
  eventController.unsetFeaturedEvent
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
  bettingLimit,
  sanitizeStrings,
  validatePlaceBet,
  telegramAuthMiddleware, 
  eventController.placeBet
);

// Получить событие по ID (ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ)
router.get('/:eventId', 
  validateObjectId('eventId'),
  telegramAuthMiddleware, 
  eventController.getEventById
);

console.log('EVENT ROUTES: Маршруты событий зарегистрированы');

module.exports = router;
