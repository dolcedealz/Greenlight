// user.routes.js
const express = require('express');
const { userController } = require('../controllers');
const { telegramAuthMiddleware, validateTelegramAuth } = require('../middleware');

const router = express.Router();

// Аутентификация через Telegram
router.post('/auth', 
  validateTelegramAuth, 
  userController.authWithTelegram
);

// Получение профиля пользователя
router.get('/profile', 
  telegramAuthMiddleware, 
  userController.getUserProfile
);

// Получение баланса пользователя
router.get('/balance', 
  telegramAuthMiddleware, 
  userController.getUserBalance
);

// Получение транзакций пользователя
router.get('/transactions', 
  telegramAuthMiddleware, 
  userController.getUserTransactions
);

module.exports = router;