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

// Поиск пользователя по username
router.get('/search', 
  userController.searchUserByUsername
);

module.exports = router;