// backend/src/middleware/error.middleware.js
const { createLogger } = require('../utils/logger');
const logger = createLogger('ERROR_MIDDLEWARE');

/**
 * Middleware для обработки ошибок запросов
 * @param {Error} err - Объект ошибки
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function errorMiddleware(err, req, res, next) {
  // Логируем ошибку с контекстом запроса
  logger.error('Request error occurred', {
    error: err,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.telegramId || 'anonymous',
    timestamp: new Date().toISOString()
  });
  
  // Определяем код статуса
  let statusCode = err.statusCode || err.status || 500;
  
  // Обработка специфичных типов ошибок
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'CastError') {
    statusCode = 400;
  } else if (err.code === 11000) {
    statusCode = 409; // Duplicate key error
  }
  
  // Формируем сообщение для пользователя
  let message;
  if (statusCode >= 400 && statusCode < 500) {
    // Клиентские ошибки - показываем пользователю
    message = err.message || 'Bad Request';
  } else {
    // Серверные ошибки - не раскрываем детали
    message = process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : err.message;
  }
  
  // Формируем ответ
  const response = {
    success: false,
    error: {
      message,
      type: err.name || 'Error',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  };
  
  // Добавляем дополнительную информацию для некоторых ошибок
  if (err.name === 'ValidationError' && err.errors) {
    response.error.validationErrors = Object.keys(err.errors).map(key => ({
      field: key,
      message: err.errors[key].message
    }));
  }
  
  res.status(statusCode).json(response);
}

/**
 * Middleware для обработки 404 ошибок
 */
function notFoundMiddleware(req, res) {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    success: false,
    error: {
      message: 'Маршрут не найден',
      type: 'NotFound'
    }
  });
}

module.exports = {
  errorMiddleware,
  notFoundMiddleware
};