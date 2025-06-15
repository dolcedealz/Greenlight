// backend/src/routes/giveaway.routes.js
const express = require('express');
const router = express.Router();
const { giveawayController } = require('../controllers');
const { telegramAuthMiddleware } = require('../middleware/auth.middleware');

// Получить активные розыгрыши
router.get('/active', telegramAuthMiddleware, giveawayController.getActiveGiveaways);

// Участие в розыгрыше
router.post('/:giveawayId/participate', telegramAuthMiddleware, giveawayController.participateInGiveaway);

// Проверить статус участия
router.get('/:giveawayId/participation-status', telegramAuthMiddleware, giveawayController.checkUserParticipation);

// История участия пользователя
router.get('/my-participations', telegramAuthMiddleware, giveawayController.getUserParticipationHistory);

module.exports = router;