// user.routes.js
const express = require('express');
const { userController } = require('../controllers');
const { telegramAuthMiddleware, universalAuthMiddleware, validateTelegramAuth } = require('../middleware');

const router = express.Router();

// Аутентификация через Telegram
router.post('/auth', 
  validateTelegramAuth, 
  userController.authWithTelegram
);

// Получение профиля пользователя (WebApp + Bot)
router.get('/profile', 
  universalAuthMiddleware, 
  userController.getUserProfile
);

// Получение баланса пользователя (WebApp + Bot)
router.get('/balance', 
  universalAuthMiddleware, 
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