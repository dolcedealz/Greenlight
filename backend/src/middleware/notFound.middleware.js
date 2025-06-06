// backend/src/middleware/notFound.middleware.js

/**
 * Middleware для обработки 404 ошибок
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function notFoundMiddleware(req, res, next) {
  return res.status(404).json({
    success: false,
    message: 'Маршрут не найден',
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
}

module.exports = notFoundMiddleware;