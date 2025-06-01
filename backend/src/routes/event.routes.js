// backend/src/routes/event.routes.js - ПОЛНАЯ ВЕРСИЯ С ОТЛАДОЧНЫМИ ЭНДПОИНТАМИ
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
 * ОТЛАДОЧНЫЙ ЭНДПОИНТ: Полное тестирование процесса размещения ставки
 */
router.post('/debug/test-full-bet-process', telegramAuthMiddleware, async (req, res) => {
  try {
    console.log('DEBUG: Полное тестирование процесса размещения ставки');
    console.log('DEBUG: Пользователь:', req.user._id, req.user.firstName);
    
    const { Event, EventBet, User } = require('../models');
    const mongoose = require('mongoose');
    
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Создаем тестовое событие
        const testEvent = new Event({
          title: 'Тестовое событие для отладки',
          description: 'Событие создано для тестирования размещения ставок',
          outcomes: [
            { id: 'outcome-1', name: 'Исход 1', totalBets: 0, betsCount: 0 },
            { id: 'outcome-2', name: 'Исход 2', totalBets: 0, betsCount: 0 }
          ],
          category: 'other',
          startTime: new Date(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 часа
          bettingEndsAt: new Date(Date.now() + 23 * 60 * 60 * 1000), // +23 часа
          status: 'active',
          featured: false,
          initialOdds: 2.0,
          minBet: 1,
          maxBet: 1000,
          houseEdge: 5,
          createdBy: req.user._id
        });
        
        await testEvent.save({ session });
        console.log('DEBUG: Тестовое событие создано:', testEvent._id);
        
        // 2. Создаем тестовую ставку
        const betAmount = 10;
        const odds = 2.5;
        const potentialWin = betAmount * odds;
        
        const testBet = new EventBet({
          user: req.user._id,
          event: testEvent._id,
          outcomeId: 'outcome-1',
          outcomeName: 'Исход 1',
          betAmount: betAmount,
          odds: odds,
          potentialWin: potentialWin,
          balanceBefore: req.user.balance,
          balanceAfter: req.user.balance - betAmount,
          userIp: req.ip || 'unknown',
          metadata: {
            source: 'debug-test'
          }
        });
        
        // 3. Валидируем ставку
        await testBet.validate();
        console.log('DEBUG: Тестовая ставка прошла валидацию');
        
        // 4. НЕ сохраняем реально, но тестируем процесс
        console.log('DEBUG: Процесс тестирования завершен успешно');
        
        // Откатываем транзакцию (не сохраняем тестовые данные)
        await session.abortTransaction();
        
        res.json({
          success: true,
          message: 'Полное тестирование процесса размещения ставки прошло успешно',
          data: {
            event: {
              id: testEvent._id,
              title: testEvent.title,
              canPlaceBet: testEvent.canPlaceBet()
            },
            bet: {
              betAmount: testBet.betAmount,
              odds: testBet.odds,
              potentialWin: testBet.potentialWin,
              status: testBet.status
            },
            user: {
              id: req.user._id,
              balance: req.user.balance,
              sufficientFunds: req.user.balance >= betAmount
            },
            validation: 'all_passed'
          }
        });
      });
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('DEBUG: Ошибка полного тестирования:', error);
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

/**
 * ОТЛАДОЧНЫЙ ЭНДПОИНТ: Тестирование различных сценариев валидации
 */
router.post('/debug/test-validation-scenarios', async (req, res) => {
  try {
    console.log('DEBUG: Тестирование различных сценариев валидации EventBet');
    
    const { EventBet } = require('../models');
    const mongoose = require('mongoose');
    
    const results = [];
    
    // Сценарий 1: Все поля заполнены корректно
    try {
      const scenario1 = new EventBet({
        user: new mongoose.Types.ObjectId(),
        event: new mongoose.Types.ObjectId(),
        outcomeId: 'test-1',
        outcomeName: 'Сценарий 1',
        betAmount: 10,
        odds: 2.0,
        potentialWin: 20,
        balanceBefore: 100,
        balanceAfter: 90
      });
      await scenario1.validate();
      results.push({ scenario: 'Корректные данные', status: 'PASSED' });
    } catch (error) {
      results.push({ scenario: 'Корректные данные', status: 'FAILED', error: error.message });
    }
    
    // Сценарий 2: Отсутствует potentialWin (должен рассчитаться)
    try {
      const scenario2 = new EventBet({
        user: new mongoose.Types.ObjectId(),
        event: new mongoose.Types.ObjectId(),
        outcomeId: 'test-2',
        outcomeName: 'Сценарий 2',
        betAmount: 15,
        odds: 1.5,
        // potentialWin отсутствует
        balanceBefore: 100,
        balanceAfter: 85
      });
      await scenario2.validate();
      const expectedWin = 15 * 1.5;
      const actualWin = scenario2.potentialWin;
      const isCorrect = Math.abs(actualWin - expectedWin) < 0.01;
      results.push({ 
        scenario: 'Автоматический расчет potentialWin', 
        status: isCorrect ? 'PASSED' : 'FAILED',
        expected: expectedWin,
        actual: actualWin
      });
    } catch (error) {
      results.push({ scenario: 'Автоматический расчет potentialWin', status: 'FAILED', error: error.message });
    }
    
    // Сценарий 3: Отсутствует обязательное поле
    try {
      const scenario3 = new EventBet({
        user: new mongoose.Types.ObjectId(),
        // event отсутствует
        outcomeId: 'test-3',
        outcomeName: 'Сценарий 3',
        betAmount: 5,
        odds: 3.0,
        balanceBefore: 100,
        balanceAfter: 95
      });
      await scenario3.validate();
      results.push({ scenario: 'Отсутствует обязательное поле (event)', status: 'FAILED', note: 'Должна была быть ошибка' });
    } catch (error) {
      results.push({ scenario: 'Отсутствует обязательное поле (event)', status: 'PASSED', error: error.message });
    }
    
    // Сценарий 4: Отрицательная сумма ставки
    try {
      const scenario4 = new EventBet({
        user: new mongoose.Types.ObjectId(),
        event: new mongoose.Types.ObjectId(),
        outcomeId: 'test-4',
        outcomeName: 'Сценарий 4',
        betAmount: -10,
        odds: 2.0,
        balanceBefore: 100,
        balanceAfter: 100
      });
      await scenario4.validate();
      results.push({ scenario: 'Отрицательная сумма ставки', status: 'FAILED', note: 'Должна была быть ошибка' });
    } catch (error) {
      results.push({ scenario: 'Отрицательная сумма ставки', status: 'PASSED', error: error.message });
    }
    
    res.json({
      success: true,
      message: 'Тестирование сценариев валидации завершено',
      data: {
        totalScenarios: results.length,
        passed: results.filter(r => r.status === 'PASSED').length,
        failed: results.filter(r => r.status === 'FAILED').length,
        results: results
      }
    });
    
  } catch (error) {
    console.error('DEBUG: Ошибка тестирования сценариев:', error);
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

// Получить событие по ID (ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ!)
router.get('/:eventId', 
  telegramAuthMiddleware, 
  eventController.getEventById
);

console.log('EVENT ROUTES: Маршруты событий зарегистрированы');
console.log('EVENT ROUTES: Отладочные эндпоинты доступны:');
console.log('  POST /api/events/debug/test-bet');
console.log('  POST /api/events/debug/test-presave');
console.log('  POST /api/events/debug/test-full-bet-process');
console.log('  GET  /api/events/debug/eventbet-schema');
console.log('  POST /api/events/debug/test-validation-scenarios');

module.exports = router;
