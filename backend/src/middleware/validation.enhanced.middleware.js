// Улучшенная валидация входных данных для предотвращения атак
const mongoose = require('mongoose');

/**
 * Валидация финансовых операций
 */
const validateFinancialAmount = (amount, options = {}) => {
  const { min = 0.01, max = 10000, allowNegative = false } = options;
  
  // Проверка типа
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    throw new Error('Сумма должна быть числом');
  }
  
  // Проверка на отрицательные значения
  if (!allowNegative && amount < 0) {
    throw new Error('Сумма не может быть отрицательной');
  }
  
  // Проверка диапазона
  if (Math.abs(amount) < min) {
    throw new Error(`Минимальная сумма: ${min} USDT`);
  }
  
  if (Math.abs(amount) > max) {
    throw new Error(`Максимальная сумма: ${max} USDT`);
  }
  
  // Проверка на слишком много десятичных знаков
  if (amount.toString().includes('.')) {
    const decimals = amount.toString().split('.')[1];
    if (decimals && decimals.length > 8) {
      throw new Error('Слишком много десятичных знаков');
    }
  }
  
  return true;
};

/**
 * Валидация MongoDB ObjectId
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new Error(`${fieldName} обязательно`);
  }
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Некорректный ${fieldName}`);
  }
  
  return true;
};

/**
 * Валидация Telegram ID
 */
const validateTelegramId = (telegramId) => {
  const id = parseInt(telegramId);
  
  if (!id || id <= 0 || id > 9999999999) {
    throw new Error('Некорректный Telegram ID');
  }
  
  return true;
};

/**
 * Валидация игровых параметров
 */
const validateGameParams = (gameType, params) => {
  switch (gameType) {
    case 'crash':
      if (params.autoCashOut !== undefined) {
        if (typeof params.autoCashOut !== 'number' || params.autoCashOut < 1.01 || params.autoCashOut > 1000) {
          throw new Error('Автовывод должен быть от 1.01x до 1000x');
        }
      }
      break;
      
    case 'mines':
      if (params.minesCount !== undefined) {
        if (!Number.isInteger(params.minesCount) || params.minesCount < 1 || params.minesCount > 24) {
          throw new Error('Количество мин должно быть от 1 до 24');
        }
      }
      if (params.cellsToOpen !== undefined) {
        if (!Number.isInteger(params.cellsToOpen) || params.cellsToOpen < 1 || params.cellsToOpen > 25) {
          throw new Error('Некорректное количество клеток для открытия');
        }
      }
      break;
      
    case 'slots':
      // Для слотов специальной валидации не требуется
      break;
      
    case 'coin':
      if (params.side !== undefined) {
        if (!['heads', 'tails'].includes(params.side)) {
          throw new Error('Сторона монеты должна быть heads или tails');
        }
      }
      break;
      
    default:
      throw new Error('Неизвестный тип игры');
  }
  
  return true;
};

/**
 * Санитизация строковых данных
 */
const sanitizeString = (str, maxLength = 255) => {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Удаляем опасные символы
  return str
    .replace(/[<>"/\\&]/g, '') // Удаляем HTML/JS символы
    .replace(/\$\{|\$\(/g, '') // Удаляем template injection
    .trim()
    .substring(0, maxLength);
};

/**
 * Middleware для валидации ставок
 */
const validateBetRequest = (req, res, next) => {
  try {
    const { betAmount, gameType } = req.body;
    
    // Валидация суммы ставки
    validateFinancialAmount(betAmount, { min: 0.1, max: 1000 });
    
    // Валидация типа игры
    if (!['crash', 'mines', 'slots', 'coin'].includes(gameType)) {
      throw new Error('Неизвестный тип игры');
    }
    
    // Валидация игровых параметров
    validateGameParams(gameType, req.body);
    
    // Санитизация строковых данных
    if (req.body.comment) {
      req.body.comment = sanitizeString(req.body.comment, 100);
    }
    
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Middleware для валидации финансовых операций
 */
const validateFinancialRequest = (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (amount !== undefined) {
      validateFinancialAmount(amount, { 
        min: 0.01, 
        max: 50000, 
        allowNegative: req.route.path.includes('admin') 
      });
    }
    
    // Валидация ID пользователя если есть
    if (req.params.userId) {
      validateObjectId(req.params.userId, 'ID пользователя');
    }
    
    // Санитизация комментариев
    if (req.body.reason) {
      req.body.reason = sanitizeString(req.body.reason, 200);
    }
    if (req.body.comment) {
      req.body.comment = sanitizeString(req.body.comment, 200);
    }
    
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Middleware для валидации withdrawal запросов
 */
const validateWithdrawalRequest = (req, res, next) => {
  try {
    const { amount, recipient, recipientType } = req.body;
    
    // Валидация суммы
    validateFinancialAmount(amount, { min: 10, max: 10000 });
    
    // Валидация получателя
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Получатель обязателен');
    }
    
    if (!['username', 'wallet'].includes(recipientType)) {
      throw new Error('Некорректный тип получателя');
    }
    
    if (recipientType === 'username') {
      const cleanRecipient = recipient.replace('@', '');
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanRecipient)) {
        throw new Error('Некорректный Telegram username');
      }
      req.body.recipient = cleanRecipient;
    } else if (recipientType === 'wallet') {
      if (recipient.length < 10 || recipient.length > 100) {
        throw new Error('Некорректный адрес кошелька');
      }
      req.body.recipient = sanitizeString(recipient, 100);
    }
    
    // Санитизация комментария
    if (req.body.comment) {
      req.body.comment = sanitizeString(req.body.comment, 100);
    }
    
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Общая валидация для защиты от инъекций
 */
const validateGeneral = (req, res, next) => {
  try {
    // Проверка размера payload
    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > 50000) { // 50KB максимум
      throw new Error('Слишком большой запрос');
    }
    
    // Санитизация всех строковых полей
    const sanitizeRecursive = (obj) => {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeString(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeRecursive(obj[key]);
          }
        }
      }
    };
    
    sanitizeRecursive(req.body);
    sanitizeRecursive(req.query);
    
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  validateFinancialAmount,
  validateObjectId,
  validateTelegramId,
  validateGameParams,
  sanitizeString,
  validateBetRequest,
  validateFinancialRequest,
  validateWithdrawalRequest,
  validateGeneral
};