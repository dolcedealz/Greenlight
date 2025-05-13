// validation.middleware.js

/**
 * Middleware для валидации данных запроса
 */

/**
 * Валидация данных для игры "Монетка"
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function validateCoinFlip(req, res, next) {
    const { betAmount, selectedSide } = req.body;
    
    // Проверяем сумму ставки
    if (!betAmount || isNaN(betAmount) || parseFloat(betAmount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректную сумму ставки'
      });
    }
    
    // Проверяем выбранную сторону
    if (!selectedSide || (selectedSide !== 'heads' && selectedSide !== 'tails')) {
      return res.status(400).json({
        success: false,
        message: 'Выберите "heads" или "tails"'
      });
    }
    
    next();
  }
  
  /**
   * Валидация данных для аутентификации Telegram
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   * @param {Function} next - Функция next
   */
  function validateTelegramAuth(req, res, next) {
    const { user } = req.body;
    
    if (!user || !user.id) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны данные пользователя Telegram'
      });
    }
    
    next();
  }
  
  module.exports = {
    validateCoinFlip,
    validateTelegramAuth
  };