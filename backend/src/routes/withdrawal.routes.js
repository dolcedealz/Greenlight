// backend/src/routes/withdrawal.routes.js
const express = require('express');
const { withdrawalController } = require('../controllers');
const { telegramAuthMiddleware } = require('../middleware');

const router = express.Router();

/**
 * Middleware для валидации данных вывода
 */
const validateWithdrawalData = (req, res, next) => {
  const { amount, recipient, recipientType } = req.body;
  
  if (!amount) {
    return res.status(400).json({
      success: false,
      message: 'Не указана сумма вывода'
    });
  }
  
  if (!recipient) {
    return res.status(400).json({
      success: false,
      message: 'Не указан получатель'
    });
  }
  
  if (!recipientType) {
    return res.status(400).json({
      success: false,
      message: 'Не указан тип получателя'
    });
  }
  
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Сумма должна быть положительным числом'
    });
  }
  
  if (numAmount < 1) {
    return res.status(400).json({
      success: false,
      message: 'Минимальная сумма вывода: 1 USDT'
    });
  }
  
  if (numAmount > 10000) {
    return res.status(400).json({
      success: false,
      message: 'Максимальная сумма вывода: 10000 USDT'
    });
  }
  
  next();
};

/**
 * Middleware для проверки ID вывода в параметрах
 */
const validateWithdrawalId = (req, res, next) => {
  const { withdrawalId } = req.params;
  
  if (!withdrawalId) {
    return res.status(400).json({
      success: false,
      message: 'Не указан ID запроса на вывод'
    });
  }
  
  // Проверяем, что это валидный ObjectId для MongoDB
  if (!/^[0-9a-fA-F]{24}$/.test(withdrawalId)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный ID запроса на вывод'
    });
  }
  
  next();
};

/**
 * Middleware для логирования запросов к API выводов
 */
const logWithdrawalRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] WITHDRAWAL API: ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);
  
  next();
};

// Применяем логирование ко всем маршрутам
router.use(logWithdrawalRequest);

// =================
// ЗАЩИЩЕННЫЕ МАРШРУТЫ (требуют аутентификации)
// =================

// Применяем middleware аутентификации ко всем маршрутам
router.use(telegramAuthMiddleware);

/**
 * POST /api/withdrawals
 * Создание нового запроса на вывод
 */
router.post('/', 
  validateWithdrawalData,
  withdrawalController.createWithdrawal
);

/**
 * GET /api/withdrawals
 * Получение истории выводов текущего пользователя
 * Query параметры:
 * - limit: количество записей (по умолчанию 20, максимум 100)
 * - skip: количество пропущенных записей (для пагинации)
 * - status: фильтр по статусу (pending, approved, processing, completed, rejected, failed)
 */
router.get('/', withdrawalController.getUserWithdrawals);

/**
 * GET /api/withdrawals/:withdrawalId
 * Получение информации о конкретном выводе
 */
router.get('/:withdrawalId', 
  validateWithdrawalId,
  withdrawalController.getWithdrawalInfo
);

/**
 * GET /api/withdrawals/:withdrawalId/status
 * Проверка статуса вывода (для polling с фронтенда)
 */
router.get('/:withdrawalId/status', 
  validateWithdrawalId,
  withdrawalController.checkWithdrawalStatus
);

/**
 * DELETE /api/withdrawals/:withdrawalId
 * Отмена запроса на вывод (только для pending статуса)
 */
router.delete('/:withdrawalId', 
  validateWithdrawalId,
  withdrawalController.cancelWithdrawal
);

// =================
// МАРШРУТЫ ДЛЯ СТАТИСТИКИ
// =================

/**
 * GET /api/withdrawals/stats
 * Статистика выводов пользователя
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user._id;
    const { Withdrawal } = require('../models');
    
    const stats = await Withdrawal.aggregate([
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
    console.error('Ошибка получения статистики выводов:', error);
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
 * Middleware для обработки ошибок в маршрутах выводов
 */
router.use((error, req, res, next) => {
  console.error('Ошибка в Withdrawal API:', error);
  
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
      'POST /api/withdrawals - создание запроса на вывод',
      'GET /api/withdrawals - история выводов',
      'GET /api/withdrawals/:id - информация о выводе',
      'GET /api/withdrawals/:id/status - статус вывода',
      'DELETE /api/withdrawals/:id - отмена вывода',
      'GET /api/withdrawals/stats/summary - статистика выводов'
    ]
  });
});

module.exports = router;