const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const duelController = require('../controllers/duel.controller');
const { duelAuthMiddleware } = require('../middleware/auth.middleware');
const rateLimitingMiddleware = require('../middleware/rateLimiting.middleware');

// Применяем специальную аутентификацию для дуэлей
router.use(duelAuthMiddleware);

// Валидационные правила
const createInvitationValidation = [
  body('gameType')
    .isIn(['🎲', '🎯', '⚽', '🏀', '🎳', '🎰'])
    .withMessage('Неподдерживаемый тип игры'),
  body('format')
    .optional()
    .isIn(['bo1', 'bo3', 'bo5', 'bo7'])
    .withMessage('Неподдерживаемый формат дуэли'),
  body('amount')
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Ставка должна быть от 1 до 1000 USDT'),
  body('targetUsername')
    .optional()
    .isLength({ min: 1, max: 32 })
    .withMessage('Некорректное имя пользователя')
];

const createDuelValidation = [
  body('gameType')
    .isIn(['🎲', '🎯', '⚽', '🏀', '🎳', '🎰'])
    .withMessage('Неподдерживаемый тип игры'),
  body('format')
    .optional()
    .isIn(['bo1', 'bo3', 'bo5', 'bo7'])
    .withMessage('Неподдерживаемый формат дуэли'),
  body('amount')
    .isFloat({ min: 1, max: 1000 })
    .withMessage('Ставка должна быть от 1 до 1000 USDT'),
  body('chatId')
    .notEmpty()
    .withMessage('ID чата обязателен'),
  body('chatType')
    .isIn(['private', 'group', 'supergroup', 'channel'])
    .withMessage('Неподдерживаемый тип чата'),
  body('opponentId')
    .optional()
    .isString()
    .withMessage('Некорректный ID противника'),
  body('opponentUsername')
    .optional()
    .isLength({ min: 1, max: 32 })
    .withMessage('Некорректное имя противника')
];

const makeMoveValidation = [
  body('result')
    .isInt({ min: 1, max: 64 })
    .withMessage('Результат должен быть числом от 1 до 64'),
  body('messageId')
    .optional()
    .isInt()
    .withMessage('ID сообщения должен быть числом')
];

const sessionIdValidation = [
  param('sessionId')
    .isLength({ min: 10 })
    .withMessage('Некорректный ID сессии')
];

const inviteIdValidation = [
  param('inviteId')
    .isLength({ min: 10 })
    .withMessage('Некорректный ID приглашения')
];

// === РОУТЫ ДЛЯ ПРИГЛАШЕНИЙ ===

// Создание приглашения на дуэль (для inline режима)
router.post('/invitation', 
  rateLimitingMiddleware({ windowMs: 60000, max: 10 }), // 10 приглашений в минуту
  createInvitationValidation,
  duelController.createInvitation
);

// Принятие приглашения
router.post('/invitation/:inviteId/accept',
  rateLimitingMiddleware({ windowMs: 60000, max: 20 }),
  inviteIdValidation,
  duelController.acceptInvitation
);

// Отклонение приглашения
router.post('/invitation/:inviteId/decline',
  rateLimitingMiddleware({ windowMs: 60000, max: 20 }),
  inviteIdValidation,
  duelController.declineInvitation
);

// === РОУТЫ ДЛЯ ДУЭЛЕЙ ===

// Создание дуэли напрямую (для групповых чатов)
router.post('/',
  rateLimitingMiddleware({ windowMs: 60000, max: 15 }),
  createDuelValidation,
  duelController.createDuel
);

router.post('/create',
  rateLimitingMiddleware({ windowMs: 60000, max: 15 }),
  createDuelValidation,
  duelController.createDuel
);

// Принятие дуэли
router.post('/:sessionId/accept',
  rateLimitingMiddleware({ windowMs: 60000, max: 30 }),
  sessionIdValidation,
  duelController.acceptDuel
);

// Отклонение дуэли
router.post('/:sessionId/decline',
  rateLimitingMiddleware({ windowMs: 60000, max: 30 }),
  sessionIdValidation,
  duelController.declineDuel
);

// Присоединение к открытой дуэли
router.post('/:sessionId/join',
  rateLimitingMiddleware({ windowMs: 60000, max: 30 }),
  sessionIdValidation,
  duelController.joinDuel
);

// Начало игры
router.post('/:sessionId/start',
  rateLimitingMiddleware({ windowMs: 60000, max: 30 }),
  sessionIdValidation,
  duelController.startGame
);

// Сделать ход в дуэли
router.post('/:sessionId/move',
  rateLimitingMiddleware({ windowMs: 10000, max: 10 }), // 10 ходов в 10 секунд
  sessionIdValidation,
  makeMoveValidation,
  duelController.makeMove
);

// Сохранение результата раунда
router.post('/:sessionId/rounds',
  rateLimitingMiddleware({ windowMs: 10000, max: 20 }),
  sessionIdValidation,
  duelController.saveRound
);

// Завершение дуэли
router.post('/:sessionId/finish',
  rateLimitingMiddleware({ windowMs: 60000, max: 20 }),
  sessionIdValidation,
  duelController.finishDuel
);

// Получение информации о дуэли
router.get('/:sessionId',
  sessionIdValidation,
  duelController.getDuel
);

// Отмена дуэли
router.post('/:sessionId/cancel',
  rateLimitingMiddleware({ windowMs: 60000, max: 20 }),
  sessionIdValidation,
  duelController.cancelDuel
);

// === РОУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ===

// Получение активных дуэлей пользователя
router.get('/user/active',
  duelController.getActiveDuels
);

// Получение истории дуэлей пользователя
router.get('/user/history',
  duelController.getDuelHistory
);

// Получение истории дуэлей конкретного пользователя
router.get('/history/:userId',
  param('userId').isString().withMessage('Некорректный ID пользователя'),
  duelController.getUserHistoryById
);

// Получение статистики дуэлей пользователя
router.get('/user/stats',
  duelController.getDuelStats
);

// Получение статистики конкретного пользователя
router.get('/stats/:userId',
  param('userId').isString().withMessage('Некорректный ID пользователя'),
  duelController.getUserStatsById
);

// === ПУБЛИЧНЫЕ РОУТЫ ===

// Получение открытых дуэлей (для общего просмотра)
router.get('/public/open',
  rateLimitingMiddleware({ windowMs: 60000, max: 60 }),
  duelController.getOpenDuels
);

// === MIDDLEWARE ДЛЯ ОБРАБОТКИ ОШИБОК ===

router.use((error, req, res, next) => {
  console.error('Ошибка в роутах дуэлей:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации',
      errors: error.errors
    });
  }
  
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации данных',
      errors: error.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Конфликт данных',
      error: 'Дуэль с такими параметрами уже существует'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера'
  });
});

module.exports = router;