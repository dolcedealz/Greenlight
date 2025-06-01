// app.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ДОПОЛНИТЕЛЬНЫМ ЛОГИРОВАНИЕМ
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const { errorMiddleware } = require('./middleware');

const app = express();

// Настройка middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Расширенное логирование запросов
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Подключение webhook маршрутов (БЕЗ префикса /api)
app.use('/webhooks', webhookRoutes);

// Подключение основных маршрутов API
app.use('/api', routes);

// Базовый маршрут
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Greenlight Casino API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      api: '/api/*',
      webhooks: '/webhooks/*',
      health: '/api/health',
      events: {
        active: 'GET /api/events/active',
        featured: 'GET /api/events/featured',
        bet: 'POST /api/events/bet',
        userBets: 'GET /api/events/user/bets'
      }
    }
  });
});

// Обработка несуществующих маршрутов
app.use((req, res, next) => {
  const error = new Error(`Маршрут не найден: ${req.method} ${req.path}`);
  error.statusCode = 404;
  console.error('404 - Маршрут не найден:', req.method, req.path);
  next(error);
});

// Middleware для обработки ошибок
app.use(errorMiddleware);

module.exports = app;
