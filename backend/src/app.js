// backend/src/app.js - PRODUCTION OPTIMIZED VERSION
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const routes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const { errorMiddleware, notFoundMiddleware } = require('./middleware');
const { createLogger } = require('./utils/logger');

const logger = createLogger('APP');
const app = express();

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Enable gzip compression
  app.use(compression({
    level: 6, // Compression level (1-9)
    threshold: 1024, // Only compress files bigger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression for all requests
      return compression.filter(req, res);
    }
  }));
  
  // Trust proxy for production environments
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with enhanced logging
const corsOptions = {
  origin: function (origin, callback) {
    logger.info(`CORS request from origin: ${origin}`);
    
    // Разрешенные домены для продакшена
    const allowedOrigins = [
      'https://greenlight-frontend.onrender.com',
      'https://www.greenlight-casino.eu',
      'https://greenlight-casino.eu',
      'https://greenlight-casino.eu/',
      'https://www.greenlight-casino.eu/'
    ];
    
    if (process.env.NODE_ENV !== 'production') {
      // В development режиме разрешаем все
      logger.info('Development mode: allowing all origins');
      callback(null, true);
      return;
    }
    
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) {
      logger.info('No origin provided, allowing request');
      callback(null, true);
      return;
    }
    
    // Проверяем, разрешен ли домен
    if (allowedOrigins.includes(origin)) {
      logger.info(`Origin ${origin} is allowed`);
      callback(null, true);
    } else {
      logger.warn(`Origin ${origin} is not allowed by CORS policy`);
      logger.warn(`Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Telegram-Data', 'X-Telegram-User']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request start (only in development or for errors)
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type')
    });
  }
  
  // Capture response details
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Always log errors and slow requests
    if (res.statusCode >= 400 || duration > 5000) {
      logger.request(req, res, duration);
    } else if (process.env.NODE_ENV !== 'production') {
      logger.request(req, res, duration);
    }
  });
  
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
        bet: 'POST /api/events/:eventId/bet',
        userBets: 'GET /api/events/user/bets',
        getEvent: 'GET /api/events/:eventId'
      }
    }
  });
});

// 404 handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);

// Запуск сервиса мониторинга балансов
try {
  const { balanceMonitoringService } = require('./services');
  
  // Проверяем, что сервис загружен успешно
  if (balanceMonitoringService) {
    // Запускаем мониторинг только в продакшене или при явном указании
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BALANCE_MONITORING === 'true') {
      balanceMonitoringService.startMonitoring();
      logger.info('✅ Сервис мониторинга балансов запущен');
    } else {
      logger.info('ℹ️ Сервис мониторинга балансов отключен (не продакшен)');
    }
  } else {
    logger.warn('⚠️ Сервис мониторинга балансов недоступен (отсутствует node-cron)');
  }
} catch (error) {
  logger.error('❌ Ошибка запуска сервиса мониторинга балансов:', error);
}

module.exports = app;
