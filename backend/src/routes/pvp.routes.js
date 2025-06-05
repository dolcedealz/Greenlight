// backend/src/routes/pvp.routes.js
const express = require('express');
const { pvpController } = require('../controllers');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// Все PvP маршруты требуют аутентификации
router.use(authMiddleware);

/**
 * @route POST /api/pvp/challenge
 * @desc Создать вызов на дуэль
 * @access Private
 * @body {
 *   opponentId: string,
 *   opponentUsername: string,
 *   amount: number,
 *   chatId: string,
 *   chatType: string,
 *   messageId: number
 * }
 */
router.post('/challenge', pvpController.createChallenge);

/**
 * @route POST /api/pvp/respond/:duelId
 * @desc Принять или отклонить вызов на дуэль
 * @access Private
 * @params duelId: string
 * @body {
 *   action: 'accept' | 'decline'
 * }
 */
router.post('/respond/:duelId', pvpController.respondToChallenge);

/**
 * @route GET /api/pvp/session/:sessionId
 * @desc Получить состояние игровой сессии
 * @access Private
 * @params sessionId: string
 */
router.get('/session/:sessionId', pvpController.getSession);

/**
 * @route POST /api/pvp/join/:sessionId
 * @desc Присоединиться к игровой сессии
 * @access Private
 * @params sessionId: string
 */
router.post('/join/:sessionId', pvpController.joinSession);

/**
 * @route POST /api/pvp/ready/:sessionId
 * @desc Подтвердить готовность к игре
 * @access Private
 * @params sessionId: string
 * @body {
 *   ready: boolean
 * }
 */
router.post('/ready/:sessionId', pvpController.setReady);

/**
 * @route POST /api/pvp/start/:sessionId
 * @desc Запустить игру (когда оба готовы)
 * @access Private
 * @params sessionId: string
 */
router.post('/start/:sessionId', pvpController.startGame);

/**
 * @route POST /api/pvp/round/:sessionId
 * @desc Сохранить результат раунда эмодзи дуэли
 * @access Private
 * @params sessionId: string
 * @body {
 *   round: number,
 *   challengerResult: number,
 *   opponentResult: number,
 *   winnerId: string
 * }
 */
router.post('/round/:sessionId', pvpController.saveRound);

/**
 * @route POST /api/pvp/finish/:sessionId
 * @desc Завершить дуэль с победителем
 * @access Private
 * @params sessionId: string
 * @body {
 *   winnerId: string
 * }
 */
router.post('/finish/:sessionId', pvpController.finishDuel);

/**
 * @route GET /api/pvp/active
 * @desc Получить активные дуэли пользователя
 * @access Private
 */
router.get('/active', pvpController.getActiveDuels);

/**
 * @route GET /api/pvp/history
 * @desc Получить историю PvP игр пользователя
 * @access Private
 * @query {
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/history', pvpController.getHistory);

/**
 * @route GET /api/pvp/stats
 * @desc Получить статистику PvP игр пользователя
 * @access Private
 */
router.get('/stats', pvpController.getStats);

/**
 * @route POST /api/pvp/cancel/:duelId
 * @desc Отменить свой вызов на дуэль (только для инициатора)
 * @access Private
 * @params duelId: string
 */
router.post('/cancel/:duelId', pvpController.cancelChallenge);

/**
 * @route POST /api/pvp/rematch/:duelId
 * @desc Предложить реванш
 * @access Private
 * @params duelId: string
 */
router.post('/rematch/:duelId', pvpController.createRematch);

/**
 * @route GET /api/pvp/pending
 * @desc Получить ожидающие дуэли для пользователя
 * @access Private
 */
router.get('/pending', pvpController.getPendingDuels);

/**
 * @route POST /api/pvp/validate-challenge
 * @desc Валидировать возможность создания вызова
 * @access Private
 * @body {
 *   opponentId: string,
 *   amount: number
 * }
 */
router.post('/validate-challenge', pvpController.validateChallenge);

/**
 * @route GET /api/pvp/leaderboard
 * @desc Получить таблицу лидеров PvP
 * @access Private
 * @query {
 *   limit?: number,
 *   period?: 'all' | 'month' | 'week'
 * }
 */
router.get('/leaderboard', pvpController.getLeaderboard);

module.exports = router;