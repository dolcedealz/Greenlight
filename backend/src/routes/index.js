// backend/src/routes/index.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const gameRoutes = require('./game.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const paymentRoutes = require('./payment.routes');
const withdrawalRoutes = require('./withdrawal.routes');
const referralRoutes = require('./referral.routes');
const authRoutes = require('./auth.routes');
const webhookRoutes = require('./webhook.routes');
const pvpRoutes = require('./pvp.routes');
const eventRoutes = require('./event.routes'); // Добавляем события

const router = express.Router();

// Префиксы для маршрутов
router.use('/games', gameRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/referrals', referralRoutes);
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/pvp', pvpRoutes);
router.use('/events', eventRoutes); // Добавляем события

// Маршрут для проверки работоспособности API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API работает',
    timestamp: new Date().toISOString(),
    services: {
      games: 'активен',
      users: 'активен', 
      admin: 'активен',
      payments: 'активен',
      withdrawals: 'активен',
      referrals: 'активен',
      auth: 'активен',
      pvp: 'активен',
      events: 'активен' // Добавляем события
    }
  });
});

module.exports = router;
