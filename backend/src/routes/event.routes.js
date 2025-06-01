// backend/src/routes/event.routes.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
const express = require('express');
const { eventController } = require('../controllers');
const { telegramAuthMiddleware, adminAuthMiddleware } = require('../middleware');

const router = express.Router();

console.log('EVENT ROUTES: Регистрация маршрутов событий');

// === ОТЛАДОЧНЫЕ ЭНДПОИНТЫ (должны быть ПЕРВЫМИ) ===

/**
 * ОТЛАДОЧНЫЙ ЭНДПОИНТ: Тестирование создания EventBet с явными значениями
 */
router.post('/debug/test-bet', async (req, res) => {
  try {
    console.log('DEBUG: Тестирование создания EventBet с явными значениями');
    
    const { EventBet } = require('../models');
    const mongoose = require('mongoose');
    
    // Создаем тестовую ставку с явными значениями
    const testBetData = {
      user: new mongoose.Types.ObjectId(),
      event: new mongoose.Types.ObjectId(),
      outcomeId: 'test-outcome-1',
      outcomeName: 'Тестовый исход #1',
      betAmount: 10,
      odds: 2.5,
      potentialWin: 25, // Явно устанавливаем
      balanceBefore: 100,
      balanceAfter: 90,
      userIp: '127.0.0.1',
      metadata: {
        source: 'web',
        sessionId: 'test-session'
      }
    };
    
    console.log('DEBUG: Данные для создания ставки:', JSON.stringify(testBetData, null, 2));
    
    const testBet = new EventBet(testBetData);
    
    console.log('DEBUG: Данные перед валидацией:', {
      betAmount: testBet.betAmount,
      odds: testBet.odds,
      potentialWin: testBet.potentialWin,
      hasUser: !!testBet.user,
      hasEvent: !!testBet.event
    });
    
    // Валидируем перед сохранением
    await testBet.validate();
    console.log('DEBUG: Валидация прошла успешно');
    
    // НЕ сохраняем, только тестируем
    res.json({
      success: true,
      message: 'Тест создания EventBet с явными значениями прошел успешно',
      data: {
        betAmount: testBet.betAmount,
        odds: testBet.odds,
        potentialWin: testBet.potentialWin,
        calculatedPotentialWin: testBet.betAmount * testBet.odds,
        validation: 'passed',
        status: testBet.status,
        placedAt: testBet.placedAt
      }
    });
    
  } catch (error) {
    console.error('DEBUG: Ошибка тестирования EventBet:', error);
    res.status(400).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      validationErrors: error.errors || null
    });
  }
});

/**
 * ОТЛАДОЧНЫЙ ЭНДПОИНТ: Тестирование pre-save middleware
 */
router.post('/debug/test-presave', async (req, res) => {
  try {
    console.log('DEBUG: Тестирование pre-save middleware EventBet');
    
    const { EventBet } = require('../models');
    const mongoose = require('mongoose');
    
    // Создаем ставку БЕЗ potentialWin (должен рассчитаться автоматически)
    const testBetData = {
      user: new mongoose.Types.ObjectId(),
      event: new mongoose.Types.ObjectId(),
      outcomeId: 'test-outcome-2',
      outcomeName: 'Тестовый исход #2 (pre-save)',
      betAmount: 15,
      odds: 3.0,
      // potentialWin НЕ устанавливаем - должен рассчитаться в pre-save
      balanceBefore: 100,
      balanceAfter: 85,
      userIp: '127.0.0.1',
      metadata: {
        source: 'web'
      }
    };
    
    console.log('DEBUG: Создаем ставку БЕЗ potentialWin:', JSON.stringify(testBetData, null, 2));
    
    const testBet = new EventBet(testBetData);
    
    console.log('DEBUG: Данные перед валидацией (без potentialWin):', {
      betAmount: testBet.betAmount,
      odds: testBet.odds,
      potentialWin: testBet.potentialWin,
      hasPotentialWin: testBet.potentialWin !== undefined && testBet.potentialWin !== null
    });
    
    // Валидируем - это должно вызвать pre-save middleware
    await testBet.validate();
    
    console.log('DEBUG: Данные после валидации:', {
      betAmount: testBet.betAmount,
      odds: testBet.odds,
      potentialWin: testBet.potentialWin,
      middlewareWorked: testBet.potentialWin > 0
    });
    
    const expectedPotentialWin = testBet.betAmount * testBet.odds;
    const middlewareWorked = Math.abs(testBet.potentialWin - expectedPotentialWin) < 0.01;
    
    res.json({
      success: true,
      message: 'Тест pre-save middleware прошел успешно',
      data: {
        betAmount: testBet.betAmount,
        odds: testBet.odds,
        potentialWin: testBet.potentialWin,
        expectedPotentialWin: expectedPotentialWin,
        middlewareWorked: middlewareWorked,
        validation: 'passed'
      }
    });
    
  } catch (error) {
    console.error('DEBUG: Ошибка тестирования pre-save:', error);
    res.status(400).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * ОТЛАДОЧНЫЙ ЭНДПОИНТ: Получить информацию о модели EventBet
 */
router.get('/debug/eventbet-schema', (req, res) => {
  try {
    console.log('DEBUG: Запрос схемы EventBet');
    
    const { EventBet } = require('../models');
    
    // Получаем информацию о схеме
    const schema = EventBet.schema;
    const paths = schema.paths;
    
    const schemaInfo = {};
    
    Object.keys(paths).forEach(path => {
      const schemaType = paths[path];
      schemaInfo[path] = {
        type: schemaType.instance || schemaType.constructor.name,
        required: schemaType.isRequired || false,
        default: schemaType.defaultValue,
        options: schemaType.options || {}
      };
    });
    
    res.json({
      success: true,
      message: 'Информация о схеме EventBet',
      data: {
        schemaInfo: schemaInfo,
        requiredFields: Object.keys(schemaInfo).filter(key => schemaInfo[key].required),
        optionalFields: Object.keys(schemaInfo).filter(key => !schemaInfo[key].required),
        fieldsWithDefaults: Object.keys(schemaInfo).filter(key => schemaInfo[key].default !== undefined)
      }
    });
    
  } catch (error) {
    console.error('DEBUG: Ошибка получения схемы:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// === ВАЖНО: СПЕЦИФИЧНЫЕ МАРШРУТЫ ИДУТ ПЕРЕД ПАРАМЕТРИЗОВАННЫМИ ===

// Получить активные события
router.get('/active', 
  telegramAuthMiddleware, 
  eventController.getActiveEvents
);

// Получить главное событие
router.get('/featured', 
  telegramAuthMiddleware, 
  eventController.getFeaturedEvent
);

// === МАРШРУТЫ ДЛЯ СТАТИСТИКИ (должны быть перед /:eventId) ===
router.get('/stats/general', 
  eventController.getStatistics
);

// === АДМИНСКИЕ МАРШРУТЫ (должны быть перед /:eventId) ===
router.get('/admin/all', 
  adminAuthMiddleware, 
  eventController.getAllEvents
);

router.post('/admin/create', 
  adminAuthMiddleware, 
  eventController.createEvent
);

// НОВЫЙ АДМИНСКИЙ ЭНДПОИНТ: Получить событие по ID для админа
router.get('/admin/:eventId', 
  adminAuthMiddleware, 
  eventController.getEventById
);

router.put('/admin/:eventId/finish', 
  adminAuthMiddleware, 
  eventController.finishEvent
);

// === ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ ДЛЯ СТАВОК (должны быть перед /:eventId) ===

// Получить ставки пользователя
router.get('/user/bets', 
  telegramAuthMiddleware, 
  eventController.getUserBets
);

// === МАРШРУТЫ С ПАРАМЕТРОМ eventId ===

// Разместить ставку на событие
router.post('/:eventId/bet', 
  telegramAuthMiddleware, 
  eventController.placeBet
);

// Получить событие по ID (ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ - ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ!)
router.get('/:eventId', 
  telegramAuthMiddleware, 
  eventController.getEventById
);

console.log('EVENT ROUTES: Маршруты событий зарегистрированы');
console.log('EVENT ROUTES: Добавлен админский эндпоинт GET /api/events/admin/:eventId');

module.exports = router;
