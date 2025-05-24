// backend/src/routes/payment.routes.js
const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { telegramAuthMiddleware } = require('../middleware');

const router = express.Router();

/**
 * Middleware для валидации данных депозита
 */
const validateDepositData = (req, res, next) => {
  const { amount } = req.body;
  
  if (!amount) {
    return res.status(400).json({
      success: false,
      message: 'Не указана сумма депозита'
    });
  }
  
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Сумма должна быть положительным числом'
    });
  }
  
  if (numAmount < 0.01) {
    return res.status(400).json({
      success: false,
      message: 'Минимальная сумма депозита: 0.01 USDT'
    });
  }
  
  if (numAmount > 10000) {
    return res.status(400).json({
      success: false,
      message: 'Максимальная сумма депозита: 10000 USDT'
    });
  }
  
  next();
};

/**
 * Middleware для проверки ID депозита в параметрах
 */
const validateDepositId = (req, res, next) => {
  const { depositId } = req.params;
  
  if (!depositId) {
    return res.status(400).json({
      success: false,
      message: 'Не указан ID депозита'
    });
  }
  
  // Проверяем, что это валидный ObjectId для MongoDB
  if (!/^[0-9a-fA-F]{24}$/.test(depositId)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID депозита'
    });
  }
  
  next();
};

/**
 * Middleware для логирования запросов к платежным API
 */
const logPaymentRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] PAYMENT API: ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);
  
  next();
};

// Применяем логирование ко всем маршрутам
router.use(logPaymentRequest);

// =================
// ПУБЛИЧНЫЕ МАРШРУТЫ (без аутентификации)
// =================

/**
 * POST /api/payments/webhook/cryptobot
 * Обработка webhook от CryptoBot
 * Этот маршрут должен быть доступен без аутентификации
 */
router.post('/webhook/cryptobot', paymentController.processWebhook);

/**
 * GET /api/payments/health
 * Проверка работоспособности платежного API
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment API работает',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// =================
// ЗАЩИЩЕННЫЕ МАРШРУТЫ (требуют аутентификации)
// =================

// Применяем middleware аутентификации ко всем маршрутам ниже
router.use(telegramAuthMiddleware);

/**
 * POST /api/payments/deposits
 * Создание нового депозита
 */
router.post('/deposits', 
  validateDepositData,
  paymentController.createDeposit
);

/**
 * GET /api/payments/deposits
 * Получение истории депозитов текущего пользователя
 * Query параметры:
 * - limit: количество записей (по умолчанию 20, максимум 100)
 * - skip: количество пропущенных записей (для пагинации)
 * - status: фильтр по статусу (pending, paid, expired, failed)
 */
router.get('/deposits', paymentController.getUserDeposits);

/**
 * GET /api/payments/deposits/:depositId
 * Получение информации о конкретном депозите
 */
router.get('/deposits/:depositId', 
  validateDepositId,
  paymentController.getDepositInfo
);

/**
 * GET /api/payments/deposits/:depositId/status
 * Проверка статуса депозита (для polling с фронтенда)
 */
router.get('/deposits/:depositId/status', 
  validateDepositId,
  paymentController.checkDepositStatus
);

/**
 * DELETE /api/payments/deposits/:depositId
 * Отмена депозита (только для pending статуса)
 */
router.delete('/deposits/:depositId', 
  validateDepositId,
  paymentController.cancelDeposit
);

// =================
// МАРШРУТЫ ДЛЯ СТАТИСТИКИ (для будущего использования)
// =================

/**
 * GET /api/payments/stats
 * Статистика депозитов пользователя
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;
    const Deposit = require('../models/deposit.model');
    
    const stats = await Deposit.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    // Преобразуем результат в удобный формат
    const formattedStats = {
      total: {
        count: 0,
        amount: 0
      },
      byStatus: {}
    };
    
    stats.forEach(stat => {
      formattedStats.byStatus[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
      formattedStats.total.count += stat.count;
      formattedStats.total.amount += stat.totalAmount;
    });
    
    res.status(200).json({
      success: true,
      data: formattedStats
    });
    
  } catch (error) {
    console.error('Ошибка получения статистики депозитов:', error);
    res.status(400).json({
      success: false,
      message: 'Не удалось получить статистику'
    });
  }
});

// =================
// ОБРАБОТКА ОШИБОК
// =================

/**
 * Middleware для обработки ошибок в платежных маршрутах
 */
router.use((error, req, res, next) => {
  console.error('Ошибка в платежном API:', error);
  
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
    message = 'Некорректный формат данных';
  } else if (error.message.includes('не найден')) {
    statusCode = 404;
    message = error.message;
  } else if (error.message.includes('Доступ запрещен')) {
    statusCode = 403;
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
      'POST /api/payments/deposits - создание депозита',
      'GET /api/payments/deposits - история депозитов',
      'GET /api/payments/deposits/:id - информация о депозите',
      'GET /api/payments/deposits/:id/status - статус депозита',
      'DELETE /api/payments/deposits/:id - отмена депозита',
      'GET /api/payments/stats - статистика депозитов',
      'POST /api/payments/webhook/cryptobot - webhook от CryptoBot'
    ]
  });
});

module.exports = router;