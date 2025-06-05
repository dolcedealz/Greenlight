// backend/src/controllers/pvp.controller.js
const { pvpService } = require('../services');
const { validationMiddleware } = require('../middleware');

/**
 * Создать вызов на дуэль
 */
const createChallenge = async (req, res) => {
  try {
    const {
      opponentId,
      opponentUsername,
      amount,
      gameType,
      format,
      winsRequired,
      chatId,
      chatType,
      messageId
    } = req.body;

    // Валидация входных данных
    if (!opponentId || !opponentUsername || !amount || !chatId || messageId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют обязательные поля',
        required: ['opponentId', 'opponentUsername', 'amount', 'chatId', 'messageId']
      });
    }

    if (typeof amount !== 'number' || amount < 1 || amount > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Сумма ставки должна быть от 1 до 1000 USDT'
      });
    }

    const challengeData = {
      challengerId: req.user.telegramId,
      challengerUsername: req.user.username,
      opponentId,
      opponentUsername,
      amount,
      gameType: gameType || '🎲',
      format: format || 'bo1',
      winsRequired: winsRequired || 1,
      chatId,
      chatType: chatType || 'private',
      messageId
    };

    const result = await pvpService.createChallenge(challengeData);
    res.status(201).json(result);

  } catch (error) {
    console.error('Ошибка создания вызова:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка создания вызова'
    });
  }
};

/**
 * Ответить на вызов (принять или отклонить)
 */
const respondToChallenge = async (req, res) => {
  try {
    const { duelId } = req.params;
    const { action } = req.body;

    if (!duelId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют обязательные поля'
      });
    }

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Действие должно быть accept или decline'
      });
    }

    const result = await pvpService.respondToChallenge(duelId, req.user.telegramId, action);
    res.json(result);

  } catch (error) {
    console.error('Ошибка ответа на вызов:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка ответа на вызов'
    });
  }
};

/**
 * Получить состояние игровой сессии
 */
const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID сессии'
      });
    }

    const result = await pvpService.getSession(sessionId, req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка получения сессии:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка получения сессии'
    });
  }
};

/**
 * Присоединиться к игровой сессии
 */
const joinSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID сессии'
      });
    }

    const result = await pvpService.joinSession(sessionId, req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка присоединения к сессии:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка присоединения к сессии'
    });
  }
};

/**
 * Подтвердить готовность к игре
 */
const setReady = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { ready = true } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID сессии'
      });
    }

    const result = await pvpService.setReady(sessionId, req.user.telegramId, ready);
    res.json(result);

  } catch (error) {
    console.error('Ошибка установки готовности:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка установки готовности'
    });
  }
};

/**
 * Запустить игру
 */
const startGame = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID сессии'
      });
    }

    const result = await pvpService.startGame(sessionId, req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка запуска игры:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка запуска игры'
    });
  }
};

/**
 * Получить активные дуэли пользователя
 */
const getActiveDuels = async (req, res) => {
  try {
    const result = await pvpService.getActiveDuels(req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка получения активных дуэлей:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения активных дуэлей'
    });
  }
};

/**
 * Получить историю PvP игр пользователя
 */
const getHistory = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 20, 100); // Максимум 100

    const result = await pvpService.getHistory(req.user.telegramId, parsedLimit);
    res.json(result);

  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения истории'
    });
  }
};

/**
 * Получить статистику PvP игр пользователя
 */
const getStats = async (req, res) => {
  try {
    const result = await pvpService.getStats(req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики'
    });
  }
};

/**
 * Отменить свой вызов на дуэль
 */
const cancelChallenge = async (req, res) => {
  try {
    const { duelId } = req.params;

    if (!duelId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID дуэли'
      });
    }

    const result = await pvpService.cancelChallenge(duelId, req.user.telegramId);
    res.json(result);

  } catch (error) {
    console.error('Ошибка отмены вызова:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка отмены вызова'
    });
  }
};

/**
 * Предложить реванш
 */
const createRematch = async (req, res) => {
  try {
    const { duelId } = req.params;

    if (!duelId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID дуэли'
      });
    }

    const result = await pvpService.createRematch(duelId, req.user.telegramId);
    res.status(201).json(result);

  } catch (error) {
    console.error('Ошибка создания реванша:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка создания реванша'
    });
  }
};

/**
 * Получить ожидающие дуэли для пользователя
 */
const getPendingDuels = async (req, res) => {
  try {
    const result = await pvpService.getActiveDuels(req.user.telegramId);
    
    // Фильтруем только pending дуэли
    const pendingDuels = result.data.filter(duel => duel.status === 'pending');
    
    res.json({
      success: true,
      data: pendingDuels
    });

  } catch (error) {
    console.error('Ошибка получения ожидающих дуэлей:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения ожидающих дуэлей'
    });
  }
};

/**
 * Валидировать возможность создания вызова
 */
const validateChallenge = async (req, res) => {
  try {
    const { opponentId, amount } = req.body;

    if (!opponentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют обязательные поля'
      });
    }

    // Используем валидацию из сервиса
    await pvpService.validateChallenge(req.user.telegramId, opponentId, amount);

    res.json({
      success: true,
      message: 'Вызов можно создать'
    });

  } catch (error) {
    console.error('Ошибка валидации вызова:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка валидации вызова'
    });
  }
};

/**
 * Получить таблицу лидеров PvP
 */
const getLeaderboard = async (req, res) => {
  try {
    const { limit = 10, period = 'all' } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50); // Максимум 50

    // TODO: Реализовать таблицу лидеров
    // Пока возвращаем заглушку
    res.json({
      success: true,
      data: [],
      message: 'Таблица лидеров в разработке'
    });

  } catch (error) {
    console.error('Ошибка получения таблицы лидеров:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения таблицы лидеров'
    });
  }
};

/**
 * Сохранить результат раунда
 */
const saveRound = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const roundData = req.body;
    
    const result = await pvpService.saveRound(sessionId, roundData);
    res.json(result);
    
  } catch (error) {
    console.error('Ошибка сохранения раунда:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка сохранения раунда'
    });
  }
};

/**
 * Завершить дуэль
 */
const finishDuel = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { winnerId } = req.body;
    
    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан победитель'
      });
    }
    
    const result = await pvpService.finishDuel(sessionId, winnerId);
    res.json(result);
    
  } catch (error) {
    console.error('Ошибка завершения дуэли:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ошибка завершения дуэли'
    });
  }
};

module.exports = {
  createChallenge,
  respondToChallenge,
  getSession,
  joinSession,
  setReady,
  startGame,
  saveRound,
  finishDuel,
  getActiveDuels,
  getHistory,
  getStats,
  cancelChallenge,
  createRematch,
  getPendingDuels,
  validateChallenge,
  getLeaderboard
};