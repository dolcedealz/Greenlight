const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

// Импортируем контроллер
const promocodeController = require('../controllers/promocode.controller');

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
  (req, res, next) => {
    console.log('Промокод роут - активация:', req.body);
    promocodeController.activatePromocode(req, res, next);
  }
);

/**
 * @route GET /api/promocodes/user
 * @desc Получить промокоды пользователя
 * @access Private (требует авторизации)
 */
router.get('/user',
  authenticateToken,
  (req, res, next) => {
    console.log('Промокод роут - получение пользовательских промокодов');
    promocodeController.getUserPromocodes(req, res, next);
  }
);

/**
 * @route GET /api/promocodes/:code/validate
 * @desc Валидировать промокод (без активации)
 * @access Private (требует авторизации)
 */
router.get('/:code/validate',
  authenticateToken,
  validatePromocodeCode,
  (req, res, next) => {
    console.log('Промокод роут - валидация:', req.params.code);
    promocodeController.validatePromocode(req, res, next);
  }
);

/**
 * @route GET /api/promocodes/available
 * @desc Получить доступные промокоды
 * @access Public (но может требовать авторизации в зависимости от настроек)
 */
router.get('/available',
  validatePromocodeType,
  (req, res, next) => {
    console.log('Промокод роут - доступные промокоды:', req.query);
    promocodeController.getAvailablePromocodes(req, res, next);
  }
);

module.exports = router;