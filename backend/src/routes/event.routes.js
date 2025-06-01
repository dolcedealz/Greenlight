// backend/src/routes/event.routes.js - ОЧИЩЕННАЯ ВЕРСИЯ БЕЗ ОТЛАДОЧНЫХ ЭНДПОИНТОВ
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

// === МАРШРУТЫ ДЛЯ СТАТИСТИКИ (должны быть перед /:eventId) ===
router.get('/stats/general', 
  eventController.getStatistics
);

// === АДМИНСКИЕ МАРШРУТЫ (должны быть перед /:eventId) ===
router.get('/admin/all', 
  adminAuthMiddleware, 
  eventController.getAllEvents
);

router.post('/admin/create', 
  adminAuthMiddleware, 
  eventController.createEvent
);

router.put('/admin/:eventId/finish', 
  adminAuthMiddleware, 
  eventController.finishEvent
);

// === ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ ДЛЯ СТАВОК (должны быть перед /:eventId) ===

// Получить ставки пользователя
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

// Получить событие по ID (ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ!)
router.get('/:eventId', 
  telegramAuthMiddleware, 
  eventController.getEventById
);

console.log('EVENT ROUTES: Маршруты событий зарегистрированы');

module.exports = router;
