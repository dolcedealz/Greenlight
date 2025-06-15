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
router.get('/', adminGiveawayController.getAllGiveaways);
router.post('/', adminGiveawayController.createGiveaway);
router.put('/:giveawayId', adminGiveawayController.updateGiveaway);
router.post('/:giveawayId/activate', adminGiveawayController.activateGiveaway);
router.post('/:giveawayId/cancel', adminGiveawayController.cancelGiveaway);
router.post('/:giveawayId/conduct', adminGiveawayController.conductGiveaway);

// Участники розыгрыша
router.get('/:giveawayId/participants', adminGiveawayController.getGiveawayParticipants);

// Статистика
router.get('/stats', adminGiveawayController.getGiveawayStats);

// Парсинг Telegram Gifts
router.post('/gifts/parse', adminGiveawayController.parseGiftFromUrl);
router.post('/gifts/create', adminGiveawayController.createPrizeFromGift);

module.exports = router;