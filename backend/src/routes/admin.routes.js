// admin.routes.js
const express = require('express');
const { adminController } = require('../controllers');
const { adminAuthMiddleware } = require('../middleware');

const router = express.Router();

// Применяем middleware для проверки админских прав
router.use(adminAuthMiddleware);

// Маршруты для управления шансами выигрыша
router.post('/win-chance/base', adminController.setBaseWinChance);
router.post('/win-chance/user', adminController.setUserWinChanceModifier);
router.get('/win-chance/settings', adminController.getWinChanceSettings);
router.get('/win-chance/user', adminController.getUserWinChanceModifier);

module.exports = router;