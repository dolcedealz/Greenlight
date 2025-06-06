const express = require('express');
const { body, param, query } = require('express-validator');
const promocodeController = require('../controllers/promocode.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

// Валидация для активации промокода
const validatePromocodeActivation = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Промокод должен быть от 3 до 20 символов')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Промокод может содержать только буквы и цифры')
];

// Валидация для получения промокода
const validatePromocodeCode = [
  param('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Неверный формат промокода')
];

// Валидация для фильтрации по типу
const validatePromocodeType = [
  query('type')
    .optional()
    .isIn(['balance', 'freespins', 'deposit', 'vip'])
    .withMessage('Неверный тип промокода')
];

/**
 * @route POST /api/promocodes/activate
 * @desc Активировать промокод
 * @access Private (требует авторизации)
 */
router.post('/activate', 
  authenticateToken,
  validatePromocodeActivation,
  promocodeController.activatePromocode
);

/**
 * @route GET /api/promocodes/user
 * @desc Получить промокоды пользователя
 * @access Private (требует авторизации)
 */
router.get('/user',
  authenticateToken,
  promocodeController.getUserPromocodes
);

/**
 * @route GET /api/promocodes/:code/validate
 * @desc Валидировать промокод (без активации)
 * @access Private (требует авторизации)
 */
router.get('/:code/validate',
  authenticateToken,
  validatePromocodeCode,
  promocodeController.validatePromocode
);

/**
 * @route GET /api/promocodes/available
 * @desc Получить доступные промокоды
 * @access Public (но может требовать авторизации в зависимости от настроек)
 */
router.get('/available',
  validatePromocodeType,
  promocodeController.getAvailablePromocodes
);

module.exports = router;