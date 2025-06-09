const express = require('express');
const { body, param, query } = require('express-validator');
const adminPromocodeController = require('../controllers/admin-promocode.controller');
const router = express.Router();

// NOTE: Auth middleware is applied at the parent router level (/admin)

// Валидация для создания промокода
const validatePromocodeCreation = [
  body('code')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Код промокода должен быть от 3 до 20 символов')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Код может содержать только заглавные буквы и цифры'),
    
  body('type')
    .isIn(['balance', 'freespins', 'deposit', 'vip'])
    .withMessage('Неверный тип промокода'),
    
  body('value')
    .isNumeric()
    .isFloat({ min: 0.01 })
    .withMessage('Значение должно быть положительным числом'),
    
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Лимит использования должен быть положительным целым числом'),
    
  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Срок действия должен быть от 1 до 365 дней'),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Описание не должно превышать 500 символов'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive должно быть булевым значением'),
    
  body('createdBy')
    .optional()
    .isNumeric()
    .withMessage('createdBy должно быть числом')
];

// Валидация для обновления промокода
const validatePromocodeUpdate = [
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Описание не должно превышать 500 символов'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive должно быть булевым значением'),
    
  body('usageLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Лимит использования должен быть положительным целым числом')
];

// Валидация ID промокода
const validatePromocodeId = [
  param('id')
    .isMongoId()
    .withMessage('Неверный ID промокода')
];

// Валидация параметров списка промокодов
const validatePromocodesList = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Страница должна быть положительным числом'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Лимит должен быть от 1 до 100'),
    
  query('type')
    .optional()
    .isIn(['balance', 'freespins', 'deposit', 'vip'])
    .withMessage('Неверный тип промокода'),
    
  query('status')
    .optional()
    .isIn(['active', 'expired', 'inactive'])
    .withMessage('Неверный статус промокода'),
    
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Поисковый запрос должен быть от 1 до 50 символов')
];

/**
 * @route POST /api/admin/promocodes
 * @desc Создать новый промокод
 * @access Private (только админы)
 */
router.post('/',
  validatePromocodeCreation,
  adminPromocodeController.createPromocode
);

/**
 * @route GET /api/admin/promocodes
 * @desc Получить список промокодов с фильтрацией
 * @access Private (только админы)
 */
router.get('/',
  validatePromocodesList,
  adminPromocodeController.getPromocodes
);

/**
 * @route GET /api/admin/promocodes/stats
 * @desc Получить статистику промокодов
 * @access Private (только админы)
 */
router.get('/stats',
  adminPromocodeController.getPromocodesStats
);

/**
 * @route GET /api/admin/promocodes/:id
 * @desc Получить детали конкретного промокода
 * @access Private (только админы)
 */
router.get('/:id',
  validatePromocodeId,
  adminPromocodeController.getPromocodeDetails
);

/**
 * @route PUT /api/admin/promocodes/:id
 * @desc Обновить промокод
 * @access Private (только админы)
 */
router.put('/:id',
  validatePromocodeId,
  validatePromocodeUpdate,
  adminPromocodeController.updatePromocode
);

/**
 * @route PATCH /api/admin/promocodes/:id/deactivate
 * @desc Деактивировать промокод
 * @access Private (только админы)
 */
router.patch('/:id/deactivate',
  validatePromocodeId,
  adminPromocodeController.deactivatePromocode
);

/**
 * @route DELETE /api/admin/promocodes/:id
 * @desc Удалить промокод (только если не использовался)
 * @access Private (только админы)
 */
router.delete('/:id',
  validatePromocodeId,
  adminPromocodeController.deletePromocode
);

module.exports = router;