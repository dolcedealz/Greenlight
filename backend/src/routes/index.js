// index.js
const express = require('express');
const gameRoutes = require('./game.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const router = express.Router();

// Префиксы для маршрутов
router.use('/games', gameRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
// Маршрут для проверки работоспособности API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API работает',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;