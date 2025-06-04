// backend/src/middleware/eventValidation.middleware.js
// Валидация для endpoints событий

const mongoose = require('mongoose');

/**
 * Валидация для размещения ставки
 */
const validatePlaceBet = (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { outcomeId, amount } = req.body;
    
    const errors = [];
    
    // Валидация eventId
    if (!eventId) {
      errors.push('ID события обязательно');
    } else if (!mongoose.Types.ObjectId.isValid(eventId)) {
      errors.push('Некорректный формат ID события');
    }
    
    // Валидация outcomeId
    if (!outcomeId) {
      errors.push('ID исхода обязательно');
    } else if (typeof outcomeId !== 'string' || outcomeId.length < 1 || outcomeId.length > 100) {
      errors.push('ID исхода должен быть строкой от 1 до 100 символов');
    }
    
    // Валидация amount
    if (amount === undefined || amount === null) {
      errors.push('Сумма ставки обязательна');
    } else {
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount)) {
        errors.push('Сумма ставки должна быть числом');
      } else if (numAmount <= 0) {
        errors.push('Сумма ставки должна быть положительной');
      } else if (numAmount > 10000) {
        errors.push('Сумма ставки не может превышать 10,000 USDT');
      } else if (!Number.isFinite(numAmount)) {
        errors.push('Сумма ставки должна быть конечным числом');
      } else {
        // Проверяем количество десятичных знаков (максимум 2)
        const decimalPart = amount.toString().split('.')[1];
        if (decimalPart && decimalPart.length > 2) {
          errors.push('Сумма ставки не может иметь более 2 десятичных знаков');
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors
      });
    }
    
    // Нормализуем amount
    req.body.amount = parseFloat(amount);
    
    next();
  } catch (error) {
    console.error('Ошибка валидации ставки:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка валидации'
    });
  }
};

/**
 * Валидация для создания события (админ)
 */
const validateCreateEvent = (req, res, next) => {
  try {
    const { title, description, outcomes, startTime, endTime, bettingEndsAt, minBet, maxBet, houseEdge } = req.body;
    
    const errors = [];
    
    // Валидация title
    if (!title) {
      errors.push('Название события обязательно');
    } else if (typeof title !== 'string') {
      errors.push('Название события должно быть строкой');
    } else if (title.length < 5 || title.length > 200) {
      errors.push('Название события должно быть от 5 до 200 символов');
    } else if (!/^[a-zA-Zа-яА-Я0-9\s\-\?\!\.\,\:\;]+$/.test(title)) {
      errors.push('Название события содержит недопустимые символы');
    }
    
    // Валидация description
    if (!description) {
      errors.push('Описание события обязательно');
    } else if (typeof description !== 'string') {
      errors.push('Описание события должно быть строкой');
    } else if (description.length < 10 || description.length > 1000) {
      errors.push('Описание события должно быть от 10 до 1000 символов');
    }
    
    // Валидация outcomes
    if (!outcomes) {
      errors.push('Исходы события обязательны');
    } else if (!Array.isArray(outcomes)) {
      errors.push('Исходы должны быть массивом');
    } else if (outcomes.length !== 2) {
      errors.push('Событие должно иметь ровно 2 исхода');
    } else {
      outcomes.forEach((outcome, index) => {
        if (!outcome.name) {
          errors.push(`Название исхода ${index + 1} обязательно`);
        } else if (typeof outcome.name !== 'string') {
          errors.push(`Название исхода ${index + 1} должно быть строкой`);
        } else if (outcome.name.length < 2 || outcome.name.length > 100) {
          errors.push(`Название исхода ${index + 1} должно быть от 2 до 100 символов`);
        }
      });
      
      // Проверяем уникальность названий исходов
      const outcomeNames = outcomes.map(o => o.name).filter(Boolean);
      if (new Set(outcomeNames).size !== outcomeNames.length) {
        errors.push('Названия исходов должны быть уникальными');
      }
    }
    
    // Валидация временных параметров
    const now = new Date();
    
    if (!startTime) {
      errors.push('Время начала события обязательно');
    } else {
      const start = new Date(startTime);
      if (isNaN(start.getTime())) {
        errors.push('Некорректный формат времени начала');
      } else if (start < now) {
        errors.push('Время начала не может быть в прошлом');
      }
    }
    
    if (!endTime) {
      errors.push('Время окончания события обязательно');
    } else {
      const end = new Date(endTime);
      if (isNaN(end.getTime())) {
        errors.push('Некорректный формат времени окончания');
      } else if (startTime && end <= new Date(startTime)) {
        errors.push('Время окончания должно быть после времени начала');
      }
    }
    
    if (!bettingEndsAt) {
      errors.push('Время окончания приема ставок обязательно');
    } else {
      const bettingEnd = new Date(bettingEndsAt);
      if (isNaN(bettingEnd.getTime())) {
        errors.push('Некорректный формат времени окончания ставок');
      } else if (bettingEnd < now) {
        errors.push('Время окончания ставок не может быть в прошлом');
      } else if (endTime && bettingEnd > new Date(endTime)) {
        errors.push('Прием ставок должен закончиться до окончания события');
      }
    }
    
    // Валидация финансовых параметров
    if (minBet !== undefined) {
      const minBetNum = parseFloat(minBet);
      if (isNaN(minBetNum) || minBetNum < 0.01 || minBetNum > 100) {
        errors.push('Минимальная ставка должна быть от 0.01 до 100 USDT');
      }
    }
    
    if (maxBet !== undefined) {
      const maxBetNum = parseFloat(maxBet);
      if (isNaN(maxBetNum) || maxBetNum < 1 || maxBetNum > 10000) {
        errors.push('Максимальная ставка должна быть от 1 до 10,000 USDT');
      } else if (minBet && maxBetNum <= parseFloat(minBet)) {
        errors.push('Максимальная ставка должна быть больше минимальной');
      }
    }
    
    if (houseEdge !== undefined) {
      const houseEdgeNum = parseFloat(houseEdge);
      if (isNaN(houseEdgeNum) || houseEdgeNum < 0 || houseEdgeNum > 20) {
        errors.push('Комиссия казино должна быть от 0% до 20%');
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors
      });
    }
    
    next();
  } catch (error) {
    console.error('Ошибка валидации создания события:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка валидации'
    });
  }
};

/**
 * Валидация для завершения события (админ)
 */
const validateFinishEvent = (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { winningOutcomeId } = req.body;
    
    const errors = [];
    
    // Валидация eventId
    if (!eventId) {
      errors.push('ID события обязательно');
    } else if (!mongoose.Types.ObjectId.isValid(eventId)) {
      errors.push('Некорректный формат ID события');
    }
    
    // Валидация winningOutcomeId
    if (!winningOutcomeId) {
      errors.push('ID выигрышного исхода обязательно');
    } else if (typeof winningOutcomeId !== 'string' || winningOutcomeId.length < 1) {
      errors.push('ID выигрышного исхода должен быть непустой строкой');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors
      });
    }
    
    next();
  } catch (error) {
    console.error('Ошибка валидации завершения события:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка валидации'
    });
  }
};

/**
 * Валидация ObjectId параметра
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    try {
      const id = req.params[paramName];
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: `Параметр ${paramName} обязателен`
        });
      }
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: `Некорректный формат ${paramName}`
        });
      }
      
      next();
    } catch (error) {
      console.error(`Ошибка валидации ${paramName}:`, error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка валидации'
      });
    }
  };
};

/**
 * Санитизация строк (базовая защита от XSS)
 */
const sanitizeStrings = (req, res, next) => {
  try {
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Удаляем <script> теги
        .replace(/<[^>]*>/g, '') // Удаляем HTML теги
        .replace(/javascript:/gi, '') // Удаляем javascript: протокол
        .replace(/on\w+\s*=/gi, '') // Удаляем event handlers
        .trim();
    };
    
    const sanitizeObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      } else if (typeof obj === 'string') {
        return sanitizeString(obj);
      }
      return obj;
    };
    
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    next();
  } catch (error) {
    console.error('Ошибка санитизации:', error);
    next(); // Продолжаем выполнение даже при ошибке санитизации
  }
};

module.exports = {
  validatePlaceBet,
  validateCreateEvent,
  validateFinishEvent,
  validateObjectId,
  sanitizeStrings
};