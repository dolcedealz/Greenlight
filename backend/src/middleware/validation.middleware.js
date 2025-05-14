// backend/src/middleware/validation.middleware.js

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
 * Валидация данных для начала игры в мины
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function validateMinesPlay(req, res, next) {
  const { betAmount, minesCount } = req.body;
  
  // Проверяем сумму ставки
  if (!betAmount || isNaN(betAmount) || parseFloat(betAmount) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Укажите корректную сумму ставки'
    });
  }
  
  // Допустимые значения для количества мин
  const allowedMinesCounts = [3, 5, 7, 9, 12, 15, 18, 21, 23];
  
  // Проверяем количество мин
  if (!minesCount || isNaN(minesCount) || !allowedMinesCounts.includes(parseInt(minesCount, 10))) {
    return res.status(400).json({
      success: false,
      message: 'Укажите корректное количество мин (3, 5, 7, 9, 12, 15, 18, 21, 23)'
    });
  }
  
  next();
}

/**
 * Валидация данных для завершения игры в мины
 * @param {Object} req - Запрос Express
 * @param {Object} res - Ответ Express
 * @param {Function} next - Функция next
 */
function validateMinesComplete(req, res, next) {
  const { gameId, cashout } = req.body;
  
  // Проверяем ID игры
  if (!gameId) {
    return res.status(400).json({
      success: false,
      message: 'Не указан ID игры'
    });
  }
  
  // Если не кешаут, проверяем координаты ячейки
  if (!cashout) {
    const { row, col } = req.body;
    
    if (row === undefined || col === undefined || row === null || col === null) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны координаты ячейки'
      });
    }
    
    // Проверяем, что координаты в пределах игрового поля
    if (isNaN(row) || isNaN(col) || row < 0 || row > 4 || col < 0 || col > 4) {
      return res.status(400).json({
        success: false,
        message: 'Некорректные координаты ячейки'
      });
    }
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
  validateMinesPlay,
  validateMinesComplete,
  validateTelegramAuth
};