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

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://greenlight-frontend.onrender.com'] 
    : true,
  credentials: true,
  optionsSuccessStatus: 200
}));

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

module.exports = app;
