// backend/src/routes/event.routes.js
const express = require('express');
const { eventController } = require('../controllers');
const { telegramAuthMiddleware } = require('../middleware');

const router = express.Router();

/**
 * Middleware для логирования запросов к событиям
 */
const logEventRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] EVENTS API: ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);
  
  next();
};

// Применяем логирование ко всем маршрутам
router.use(logEventRequest);

// =================
// ПУБЛИЧНЫЕ МАРШРУТЫ (без аутентификации)
// =================

/**
 * GET /api/events/featured
 * Получение события для главной страницы
 */
router.get('/featured', eventController.getFeaturedEvent);

/**
 * GET /api/events/active
 * Получение списка активных событий
 * Query параметры:
 * - limit: количество событий (по умолчанию 4)
 */
router.get('/active', eventController.getActiveEvents);

/**
 * GET /api/events/:eventId
 * Получение события по ID
 */
router.get('/:eventId', eventController.getEventById);

// =================
// ЗАЩИЩЕННЫЕ МАРШРУТЫ (требуют аутентификации)
// =================

// Применяем middleware аутентификации
router.use(telegramAuthMiddleware);

/**
 * POST /api/events/:eventId/bet
 * Размещение ставки на событие
 * Body:
 * - outcomeId: ID исхода
 * - betAmount: сумма ставки
 */
router.post('/:eventId/bet', async (req, res) => {
  // Добавляем eventId из параметров в body для удобства
  req.body.eventId = req.params.eventId;
  return eventController.placeBet(req, res);
});

/**
 * GET /api/events/user/bets
 * Получение ставок текущего пользователя
 * Query параметры:
 * - limit: количество записей (по умолчанию 20)
 * - skip: количество пропущенных записей
 * - status: фильтр по статусу (active, won, lost)
 */
router.get('/user/bets', eventController.getUserBets);

/**
 * GET /api/events/stats/general
 * Получение общей статистики событий
 */
router.get('/stats/general', eventController.getStatistics);

// =================
// АДМИНСКИЕ МАРШРУТЫ
// =================

/**
 * POST /api/events/admin/create
 * Создание нового события (только админ)
 * Body:
 * - title: название события
 * - description: описание
 * - outcomes: массив из 2 исходов [{name: string}, {name: string}]
 * - startTime: время начала (ISO string)
 * - endTime: время окончания (ISO string)
 * - bettingEndsAt: время окончания приема ставок (ISO string)
 * - category: категория события
 * - featured: показывать на главной (boolean)
 * - minBet: минимальная ставка
 * - maxBet: максимальная ставка
 * - initialOdds: начальные коэффициенты
 */
router.post('/admin/create', eventController.createEvent);

/**
 * PUT /api/events/admin/:eventId/finish
 * Завершение события (только админ)
 * Body:
 * - winningOutcomeId: ID выигрышного исхода
 */
router.put('/admin/:eventId/finish', eventController.finishEvent);

/**
 * GET /api/events/admin/all
 * Получение всех событий для администратора
 * Query параметры:
 * - status: фильтр по статусу
 * - limit: количество записей
 * - skip: количество пропущенных записей
 */
router.get('/admin/all', eventController.getAllEvents);

// =================
// ОБРАБОТКА ОШИБОК
// =================

/**
 * Middleware для обработки ошибок в маршрутах событий
 */
router.use((error, req, res, next) => {
  console.error('Ошибка в Events API:', error);
  
  // Если ответ уже отправлен, передаем ошибку дальше
  if (res.headersSent) {
    return next(error);
  }
  
  // Определяем статус ошибки
  let statusCode = 500;
  let message = 'Внутренняя ошибка сервера';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Ошибка валидации данных';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Некорректный формат ID';
  } else if (error.message.includes('не найден')) {
    statusCode = 404;
    message = error.message;
  } else if (error.message.includes('Недостаточно прав')) {
    statusCode = 403;
    message = error.message;
  } else if (error.message.includes('Недостаточно средств')) {
    statusCode = 400;
    message = error.message;
  }
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    })
  });
});

/**
 * Обработка несуществующих маршрутов
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Маршрут ${req.method} ${req.originalUrl} не найден`,
    availableEndpoints: [
      'GET /api/events/featured - главное событие',
      'GET /api/events/active - активные события',
      'GET /api/events/:id - событие по ID',
      'POST /api/events/:id/bet - разместить ставку',
      'GET /api/events/user/bets - ставки пользователя',
      'POST /api/events/admin/create - создать событие (админ)',
      'PUT /api/events/admin/:id/finish - завершить событие (админ)'
    ]
  });
});

module.exports = router;
