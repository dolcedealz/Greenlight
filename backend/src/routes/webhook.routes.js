// backend/src/routes/webhook.routes.js
const express = require('express');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

/**
 * Middleware для логирования webhook запросов
 */
const logWebhookRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  const contentLength = req.get('Content-Length') || 0;
  
  console.log(`[${timestamp}] WEBHOOK: ${method} ${url} - IP: ${ip} - Size: ${contentLength}b - UA: ${userAgent}`);
  
  // Логируем тело запроса (только для отладки)
  if (process.env.NODE_ENV === 'development') {
    console.log('Webhook Body:', JSON.stringify(req.body, null, 2));
  }
  
  next();
};

/**
 * Middleware для обработки raw body (если понадобится для верификации подписей)
 */
const captureRawBody = (req, res, next) => {
  req.rawBody = '';
  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });
  req.on('end', function() {
    next();
  });
};

// Применяем логирование ко всем webhook маршрутам
router.use(logWebhookRequest);

/**
 * POST /webhooks/cryptobot
 * Webhook от CryptoBot для уведомлений о платежах
 * Этот endpoint указан в настройках CryptoBot API
 */
router.post('/cryptobot', paymentController.processWebhook);

/**
 * GET /webhooks/cryptobot
 * Проверка доступности webhook endpoint (для тестирования)
 */
router.get('/cryptobot', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CryptoBot webhook endpoint активен',
    timestamp: new Date().toISOString(),
    endpoint: '/webhooks/cryptobot',
    methods: ['POST'],
    description: 'Этот endpoint принимает уведомления о платежах от CryptoBot'
  });
});

/**
 * POST /webhooks/test
 * Тестовый webhook для проверки системы (только в development режиме)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', (req, res) => {
    console.log('Тестовый webhook получен:', req.body);
    
    res.status(200).json({
      success: true,
      message: 'Тестовый webhook обработан',
      receivedData: req.body,
      timestamp: new Date().toISOString()
    });
  });
  
  router.get('/test', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Тестовый webhook endpoint (только для development)',
      usage: 'POST /webhooks/test с любыми данными для тестирования'
    });
  });
}

/**
 * GET /webhooks/health
 * Проверка состояния всех webhook endpoints
 */
router.get('/health', (req, res) => {
  const endpoints = [
    {
      path: '/webhooks/cryptobot',
      status: 'активен',
      description: 'Webhook для CryptoBot платежей'
    }
  ];
  
  if (process.env.NODE_ENV === 'development') {
    endpoints.push({
      path: '/webhooks/test',
      status: 'активен',
      description: 'Тестовый webhook (только development)'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Webhook система работает',
    timestamp: new Date().toISOString(),
    endpoints
  });
});

/**
 * Обработка неподдерживаемых webhook маршрутов
 */
router.use('*', (req, res) => {
  console.warn(`Неизвестный webhook запрос: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    message: `Webhook ${req.method} ${req.originalUrl} не найден`,
    availableWebhooks: [
      'POST /webhooks/cryptobot - CryptoBot платежи',
      'GET /webhooks/health - статус webhook системы',
      ...(process.env.NODE_ENV === 'development' ? ['POST /webhooks/test - тестовый webhook'] : [])
    ]
  });
});

/**
 * Обработка ошибок в webhook маршрутах
 */
router.use((error, req, res, next) => {
  console.error('Ошибка в webhook:', error);
  
  // Всегда возвращаем 200 для webhook'ов, чтобы внешние сервисы не повторяли запросы
  res.status(200).json({
    success: true,
    message: 'Webhook получен, ошибка записана в логи',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;