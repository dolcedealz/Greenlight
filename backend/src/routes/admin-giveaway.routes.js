// backend/src/routes/admin-giveaway.routes.js
const express = require('express');
const router = express.Router();
const adminGiveawayController = require('../controllers/admin-giveaway.controller');
const { adminAuthMiddleware } = require('../middleware/auth.middleware');

// Применяем админскую авторизацию ко всем маршрутам
router.use(adminAuthMiddleware);

// Управление призами
router.get('/prizes', adminGiveawayController.getAllPrizes);
router.post('/prizes', adminGiveawayController.createPrize);
router.put('/prizes/:prizeId', adminGiveawayController.updatePrize);
router.delete('/prizes/:prizeId', adminGiveawayController.deletePrize);

// Управление розыгрышами
router.get('/giveaways', adminGiveawayController.getAllGiveaways);
router.post('/giveaways', adminGiveawayController.createGiveaway);
router.put('/giveaways/:giveawayId', adminGiveawayController.updateGiveaway);
router.post('/giveaways/:giveawayId/activate', adminGiveawayController.activateGiveaway);
router.post('/giveaways/:giveawayId/cancel', adminGiveawayController.cancelGiveaway);
router.post('/giveaways/:giveawayId/conduct', adminGiveawayController.conductGiveaway);

// Участники розыгрыша
router.get('/giveaways/:giveawayId/participants', adminGiveawayController.getGiveawayParticipants);

// Статистика
router.get('/stats', adminGiveawayController.getGiveawayStats);

module.exports = router;