const express = require('express');
const router = express.Router();

const duelController = require('../controllers/duel.controller');
const { duelAuthMiddleware } = require('../middleware/auth.middleware');
const { createRateLimit } = require('../middleware/rateLimiting.middleware');

// Применяем специальную аутентификацию для дуэлей
router.use(duelAuthMiddleware);

// Middleware для валидации
function validateCreateInvitation(req, res, next) {
  const { gameType, format, amount, targetUsername } = req.body;
  
  const validGameTypes = ['🎲', '🎯', '⚽', '🏀', '🎳', '🎰'];
  if (!gameType || !validGameTypes.includes(gameType)) {
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый тип игры'
    });
  }
  
  const validFormats = ['bo1', 'bo3', 'bo5', 'bo7'];
  if (format && !validFormats.includes(format)) {
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый формат дуэли'
    });
  }
  
  if (!amount || isNaN(amount) || amount < 1 || amount > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Ставка должна быть от 1 до 1000 USDT'
    });
  }
  
  if (targetUsername && (typeof targetUsername !== 'string' || targetUsername.length > 32)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректное имя пользователя'
    });
  }
  
  next();
}

function validateCreateDuel(req, res, next) {
  const { gameType, format, amount, chatId, chatType, opponentId, opponentUsername } = req.body;
  
  const validGameTypes = ['🎲', '🎯', '⚽', '🏀', '🎳', '🎰'];
  if (!gameType || !validGameTypes.includes(gameType)) {
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый тип игры'
    });
  }
  
  const validFormats = ['bo1', 'bo3', 'bo5', 'bo7'];
  if (format && !validFormats.includes(format)) {
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый формат дуэли'
    });
  }
  
  if (!amount || isNaN(amount) || amount < 1 || amount > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Ставка должна быть от 1 до 1000 USDT'
    });
  }
  
  if (!chatId) {
    return res.status(400).json({
      success: false,
      message: 'ID чата обязателен'
    });
  }
  
  const validChatTypes = ['private', 'group', 'supergroup', 'channel'];
  if (!chatType || !validChatTypes.includes(chatType)) {
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый тип чата'
    });
  }
  
  if (opponentId && typeof opponentId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID противника'
    });
  }
  
  if (opponentUsername && (typeof opponentUsername !== 'string' || opponentUsername.length > 32)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректное имя противника'
    });
  }
  
  next();
}

function validateMakeMove(req, res, next) {
  const { result, messageId } = req.body;
  
  if (!result || isNaN(result) || result < 1 || result > 64) {
    return res.status(400).json({
      success: false,
      message: 'Результат должен быть числом от 1 до 64'
    });
  }
  
  if (messageId && isNaN(messageId)) {
    return res.status(400).json({
      success: false,
      message: 'ID сообщения должен быть числом'
    });
  }
  
  next();
}

function validateSessionId(req, res, next) {
  const { sessionId } = req.params;
  
  if (!sessionId || sessionId.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID сессии'
    });
  }
  
  next();
}

function validateInviteId(req, res, next) {
  const { inviteId } = req.params;
  
  if (!inviteId || inviteId.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID приглашения'
    });
  }
  
  next();
}

function validateUserId(req, res, next) {
  const { userId } = req.params;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID пользователя'
    });
  }
  
  next();
}

// === РОУТЫ ДЛЯ ПРИГЛАШЕНИЙ ===

// Создание приглашения на дуэль (для inline режима)
router.post('/invitation', 
  createRateLimit('general'), // используем общий лимит
  validateCreateInvitation,
  duelController.createInvitation
);

// Принятие приглашения
router.post('/invitation/:inviteId/accept',
  createRateLimit('general'),
  validateInviteId,
  duelController.acceptInvitation
);

// Отклонение приглашения
router.post('/invitation/:inviteId/decline',
  createRateLimit('general'),
  validateInviteId,
  duelController.declineInvitation
);

// === РОУТЫ ДЛЯ ДУЭЛЕЙ ===

// Создание дуэли напрямую (для групповых чатов)
router.post('/',
  createRateLimit('general'),
  validateCreateDuel,
  duelController.createDuel
);

router.post('/create',
  createRateLimit('general'),
  validateCreateDuel,
  duelController.createDuel
);

// Принятие дуэли
router.post('/:sessionId/accept',
  createRateLimit('general'),
  validateSessionId,
  duelController.acceptDuel
);

// Отклонение дуэли
router.post('/:sessionId/decline',
  createRateLimit('general'),
  validateSessionId,
  duelController.declineDuel
);

// Присоединение к открытой дуэли
router.post('/:sessionId/join',
  createRateLimit('general'),
  validateSessionId,
  duelController.joinDuel
);

// Начало игры
router.post('/:sessionId/start',
  createRateLimit('general'),
  validateSessionId,
  duelController.startGame
);

// Сделать ход в дуэли
router.post('/:sessionId/move',
  createRateLimit('general'), // используем общий лимит
  validateSessionId,
  validateMakeMove,
  duelController.makeMove
);

// Сохранение результата раунда
router.post('/:sessionId/rounds',
  createRateLimit('general'),
  validateSessionId,
  duelController.saveRound
);

// Завершение дуэли
router.post('/:sessionId/finish',
  createRateLimit('general'),
  validateSessionId,
  duelController.finishDuel
);

// Получение информации о дуэли
router.get('/:sessionId',
  validateSessionId,
  duelController.getDuel
);

// Отмена дуэли
router.post('/:sessionId/cancel',
  createRateLimit('general'),
  validateSessionId,
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
  validateUserId,
  duelController.getUserHistoryById
);

// Получение статистики дуэлей пользователя
router.get('/user/stats',
  duelController.getDuelStats
);

// Получение статистики конкретного пользователя
router.get('/stats/:userId',
  validateUserId,
  duelController.getUserStatsById
);

// === ПУБЛИЧНЫЕ РОУТЫ ===

// Получение открытых дуэлей (для общего просмотра)
router.get('/public/open',
  createRateLimit('general'),
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
  
  if (error.name === 'MongoError' && error.code === 11000) {
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