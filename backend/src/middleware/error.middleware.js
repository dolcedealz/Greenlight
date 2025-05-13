// error.middleware.js

/**
 * Middleware для обработки ошибок запросов
 * @param {Error} err - Объект ошибки
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function errorMiddleware(err, req, res, next) {
    console.error('Ошибка:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Внутренняя ошибка сервера';
    
    res.status(statusCode).json({
      success: false,
      message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  module.exports = errorMiddleware;