// index.js
const express = require('express');
const gameRoutes = require('./game.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const paymentRoutes = require('./payment.routes');
const router = express.Router();

// Префиксы для маршрутов
router.use('/games', gameRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);

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
      payments: 'активен'
    }
  });
});

module.exports = router;