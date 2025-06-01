// backend/src/controllers/event.controller.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
const { eventService } = require('../services');

/**
 * Контроллер для управления событиями
 */
class EventController {
  /**
   * Получить список активных событий
   */
  async getActiveEvents(req, res) {
    try {
      const { limit = 4 } = req.query;
      
      console.log('EVENT CONTROLLER: Запрос активных событий, лимит:', limit);
      
      const events = await eventService.getActiveEvents(parseInt(limit));
      
      console.log(`EVENT CONTROLLER: Найдено событий: ${events.length}`);
      
      res.status(200).json({
        success: true,
        data: {
          events: events,
          count: events.length
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения событий:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Ошибка получения списка событий'
      });
    }
  }
  
  /**
   * Получить событие для главной страницы
   */
  async getFeaturedEvent(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос главного события');
      
      const event = await eventService.getFeaturedEvent();
      
      if (event) {
        console.log(`EVENT CONTROLLER: Найдено главное событие: ${event.title}`);
      } else {
        console.log('EVENT CONTROLLER: Главное событие не найдено');
      }
      
      res.status(200).json({
        success: true,
        data: {
          event: event
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения главного события:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Ошибка получения главного события'
      });
    }
  }
  
  /**
   * Получить событие по ID
   */
  async getEventById(req, res) {
    try {
      const { eventId } = req.params;
      
      console.log('EVENT CONTROLLER: Запрос события по ID:', eventId);
      
      const event = await eventService.getEventById(eventId);
      
      res.status(200).json({
        success: true,
        data: {
          event: event
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения события:', error);
      
      if (error.message.includes('не найдено')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message || 'Ошибка получения события'
        });
      }
    }
  }
  
  /**
   * Разместить ставку на событие - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async placeBet(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос на размещение ставки');
      console.log('EVENT CONTROLLER: Method:', req.method);
      console.log('EVENT CONTROLLER: URL:', req.originalUrl);
      console.log('EVENT CONTROLLER: Params:', JSON.stringify(req.params, null, 2));
      console.log('EVENT CONTROLLER: Body:', JSON.stringify(req.body, null, 2));
      console.log('EVENT CONTROLLER: Headers (частично):', {
        'content-type': req.headers['content-type'],
        'telegram-data': req.headers['telegram-data'] ? '***СКРЫТО***' : 'отсутствует'
      });
      
      // Проверяем аутентификацию пользователя
      if (!req.user || !req.user._id) {
        console.log('EVENT CONTROLLER: Пользователь не аутентифицирован');
        return res.status(401).json({
          success: false,
          message: 'Пользователь не аутентифицирован'
        });
      }
      
      console.log('EVENT CONTROLLER: Аутентифицированный пользователь:', {
        id: req.user._id,
        telegramId: req.user.telegramId,
        firstName: req.user.firstName,
        balance: req.user.balance
      });
      
      // Получаем eventId из параметров URL
      const { eventId } = req.params;
      const { outcomeId, betAmount } = req.body;
      const userId = req.user._id;
      const userIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // === ДЕТАЛЬНАЯ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ ===
      
      // 1. Проверяем eventId
      if (!eventId) {
        console.log('EVENT CONTROLLER: Отсутствует eventId в параметрах URL');
        return res.status(400).json({
          success: false,
          message: 'Не указан ID события в URL',
          details: 'eventId должен быть передан в параметрах URL: /api/events/{eventId}/bet'
        });
      }
      
      // Проверяем формат eventId (MongoDB ObjectId)
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        console.log('EVENT CONTROLLER: Некорректный формат eventId:', eventId);
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат ID события',
          details: 'eventId должен быть валидным MongoDB ObjectId'
        });
      }
      
      // 2. Проверяем outcomeId
      if (!outcomeId) {
        console.log('EVENT CONTROLLER: Отсутствует outcomeId в теле запроса');
        return res.status(400).json({
          success: false,
          message: 'Не указан ID исхода (outcomeId)',
          details: 'outcomeId должен быть передан в теле запроса'
        });
      }
      
      if (typeof outcomeId !== 'string' || outcomeId.trim().length === 0) {
        console.log('EVENT CONTROLLER: Некорректный тип или пустой outcomeId:', outcomeId);
        return res.status(400).json({
          success: false,
          message: 'ID исхода должен быть непустой строкой',
          details: 'outcomeId должен быть строкой длиной больше 0'
        });
      }
      
      // 3. Проверяем betAmount
      if (betAmount === undefined || betAmount === null) {
        console.log('EVENT CONTROLLER: Отсутствует betAmount в теле запроса');
        return res.status(400).json({
          success: false,
          message: 'Не указана сумма ставки (betAmount)',
          details: 'betAmount должен быть передан в теле запроса'
        });
      }
      
      // Проверяем и преобразуем сумму ставки
      let amount;
      if (typeof betAmount === 'string') {
        // Если строка, пытаемся преобразовать
        amount = parseFloat(betAmount.trim());
      } else if (typeof betAmount === 'number') {
        // Если уже число
        amount = betAmount;
      } else {
        console.log('EVENT CONTROLLER: betAmount имеет некорректный тип:', typeof betAmount, betAmount);
        return res.status(400).json({
          success: false,
          message: 'Сумма ставки должна быть числом или строкой с числом',
          details: `Получен тип: ${typeof betAmount}, значение: ${betAmount}`
        });
      }
      
      // Проверяем, что преобразование прошло успешно
      if (isNaN(amount)) {
        console.log('EVENT CONTROLLER: betAmount не является числом после преобразования:', betAmount);
        return res.status(400).json({
          success: false,
          message: 'Сумма ставки должна быть корректным числом',
          details: `Не удалось преобразовать "${betAmount}" в число`
        });
      }
      
      // Проверяем, что сумма положительная
      if (amount <= 0) {
        console.log('EVENT CONTROLLER: Отрицательная или нулевая сумма ставки:', amount);
        return res.status(400).json({
          success: false,
          message: 'Сумма ставки должна быть положительным числом',
          details: `Получена сумма: ${amount}`
        });
      }
      
      // Проверяем минимальную сумму (базовая проверка)
      if (amount < 0.01) {
        console.log('EVENT CONTROLLER: Сумма ставки слишком мала:', amount);
        return res.status(400).json({
          success: false,
          message: 'Минимальная сумма ставки: 0.01 USDT',
          details: `Указана сумма: ${amount} USDT`
        });
      }
      
      // Проверяем разумный максимум (защита от случайных огромных ставок)
      if (amount > 100000) {
        console.log('EVENT CONTROLLER: Слишком большая сумма ставки:', amount);
        return res.status(400).json({
          success: false,
          message: 'Максимальная сумма ставки: 100,000 USDT',
          details: `Указана сумма: ${amount} USDT`
        });
      }
      
      // Проверяем точность (максимум 2 знака после запятой)
      const roundedAmount = Math.round(amount * 100) / 100;
      if (Math.abs(amount - roundedAmount) > 0.001) {
        console.log('EVENT CONTROLLER: Слишком высокая точность суммы:', amount);
        return res.status(400).json({
          success: false,
          message: 'Сумма ставки может иметь максимум 2 знака после запятой',
          details: `Указана сумма: ${amount}, округленная: ${roundedAmount}`
        });
      }
      
      // Используем округленную сумму
      amount = roundedAmount;
      
      // === ЛОГИРОВАНИЕ ФИНАЛЬНЫХ ДАННЫХ ===
      console.log(`EVENT CONTROLLER: Валидация прошла успешно. Параметры ставки:`);
      console.log(`  - Пользователь: ${userId} (${req.user.firstName})`);
      console.log(`  - Событие: ${eventId}`);
      console.log(`  - Исход: ${outcomeId}`);
      console.log(`  - Сумма: ${amount} USDT`);
      console.log(`  - IP: ${userIp}`);
      console.log(`  - Баланс пользователя: ${req.user.balance} USDT`);
      
      // === ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА БАЛАНСА ===
      if (req.user.balance < amount) {
        console.log(`EVENT CONTROLLER: Недостаточно средств. Баланс: ${req.user.balance}, требуется: ${amount}`);
        return res.status(400).json({
          success: false,
          message: 'Недостаточно средств на балансе',
          details: {
            currentBalance: req.user.balance,
            requiredAmount: amount,
            deficit: amount - req.user.balance
          }
        });
      }
      
      // === РАЗМЕЩЕНИЕ СТАВКИ ===
      console.log('EVENT CONTROLLER: Передаем управление сервису событий...');
      
      const result = await eventService.placeBet(
        userId,
        eventId,
        outcomeId,
        amount,
        userIp
      );
      
      console.log('EVENT CONTROLLER: Ставка успешно размещена через сервис:', {
        betId: result.bet._id,
        newBalance: result.newBalance,
        potentialWin: result.bet.potentialWin
      });
      
      // === ФОРМИРОВАНИЕ ОТВЕТА ===
      const responseData = {
        bet: {
          id: result.bet._id,
          eventId: result.bet.event,
          outcomeId: result.bet.outcomeId,
          outcomeName: result.bet.outcomeName,
          betAmount: result.bet.betAmount,
          odds: result.bet.odds,
          potentialWin: result.bet.potentialWin,
          placedAt: result.bet.placedAt,
          status: result.bet.status
        },
        user: {
          newBalance: result.newBalance,
          previousBalance: req.user.balance
        },
        event: result.event
      };
      
      console.log('EVENT CONTROLLER: Отправляем успешный ответ');
      
      res.status(201).json({
        success: true,
        message: 'Ставка успешно размещена',
        data: responseData
      });
      
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка размещения ставки:', error);
      console.error('EVENT CONTROLLER: Stack trace:', error.stack);
      
      // === ДЕТАЛЬНАЯ ОБРАБОТКА ОШИБОК ===
      
      // Ошибки "не найдено"
      if (error.message.includes('не найдено') || error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorType: 'NOT_FOUND'
        });
      }
      
      // Ошибки недостатка средств
      if (error.message.includes('Недостаточно средств')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: 'INSUFFICIENT_FUNDS'
        });
      }
      
      // Ошибки времени приема ставок
      if (error.message.includes('ставки') && error.message.includes('принимаются')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: 'BETTING_CLOSED'
        });
      }
      
      // Ошибки валидации
      if (error.message.includes('ValidationError') || error.message.includes('validation failed')) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации данных: ' + error.message,
          errorType: 'VALIDATION_ERROR'
        });
      }
      
      // Ошибки лимитов ставок
      if (error.message.includes('Минимальная ставка') || error.message.includes('Максимальная ставка')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: 'BET_LIMIT_EXCEEDED'
        });
      }
      
      // Ошибки коэффициентов
      if (error.message.includes('коэффициент') || error.message.includes('исход')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: 'INVALID_OUTCOME'
        });
      }
      
      // Общая ошибка сервера
      res.status(500).json({
        success: false,
        message: error.message || 'Внутренняя ошибка сервера при размещении ставки',
        errorType: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
  
  /**
   * Получить ставки пользователя
   */
  async getUserBets(req, res) {
    try {
      const userId = req.user._id;
      const { limit, skip, status } = req.query;
      
      const options = {};
      if (limit) options.limit = parseInt(limit);
      if (skip) options.skip = parseInt(skip);
      if (status) options.status = status;
      
      const result = await eventService.getUserBets(userId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения ставок:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить статистику событий
   */
  async getStatistics(req, res) {
    try {
      const stats = await eventService.getEventsStatistics();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения статистики:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // === АДМИНСКИЕ МЕТОДЫ ===
  
  /**
   * Создать новое событие (админ)
   */
  async createEvent(req, res) {
    try {
      console.log('EVENT CONTROLLER: Создание события, данные:', JSON.stringify(req.body, null, 2));
      console.log('EVENT CONTROLLER: Пользователь:', req.user);
      
      const adminId = req.user._id;
      const eventData = req.body;
      
      // Проверяем права администратора - принимаем виртуального админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        console.log('EVENT CONTROLLER: Недостаточно прав, role:', req.user.role, 'isAdmin:', req.user.isAdmin);
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав для создания события'
        });
      }
      
      const event = await eventService.createEvent(eventData, adminId);
      
      res.status(201).json({
        success: true,
        message: 'Событие создано успешно',
        data: {
          event: event
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка создания события:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Завершить событие (админ) - ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async finishEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { winningOutcomeId } = req.body;
      const adminId = req.user._id;
      
      console.log('EVENT CONTROLLER: Завершение события:', eventId, 'победитель:', winningOutcomeId);
      console.log('EVENT CONTROLLER: Пользователь:', req.user);
      
      // Проверяем права администратора - принимаем виртуального админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав для завершения события'
        });
      }
      
      if (!winningOutcomeId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID выигрышного исхода'
        });
      }
      
      // Проверяем формат eventId
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат ID события'
        });
      }
      
      console.log('EVENT CONTROLLER: Вызываем eventService.finishEvent...');
      
      const result = await eventService.finishEvent(eventId, winningOutcomeId, adminId);
      
      console.log('EVENT CONTROLLER: Результат завершения события:', {
        eventId: result.event._id,
        winningOutcome: result.event.winningOutcome,
        settlementResults: result.settlement
      });
      
      // Формируем ответ с правильной структурой данных
      const responseData = {
        event: result.event,
        settlementResults: result.settlement,
        houseProfit: -result.settlement.totalProfit // Прибыль казино = убыток игроков
      };
      
      res.status(200).json({
        success: true,
        message: 'Событие завершено успешно',
        data: responseData
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка завершения события:', error);
      
      // Определяем тип ошибки для более точного ответа
      if (error.message.includes('не найдено') || error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('уже завершено')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('Некорректный ID')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Внутренняя ошибка сервера при завершении события'
      });
    }
  }
  
  /**
   * Получить все события для администратора
   */
  async getAllEvents(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос всех событий от админа');
      console.log('EVENT CONTROLLER: Пользователь:', req.user);
      
      // Проверяем права администратора - принимаем виртуального админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав для просмотра всех событий'
        });
      }
      
      const { status, limit = 50, skip = 0 } = req.query;
      const { Event } = require('../models');
      
      const query = {};
      if (status) {
        query.status = status;
      }
      
      const events = await Event.find(query)
        .populate('createdBy', 'telegramId username firstName lastName')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));
      
      const total = await Event.countDocuments(query);
      
      // Добавляем текущие коэффициенты
      const eventsWithOdds = events.map(event => {
        try {
          const odds = event.calculateOdds();
          return {
            ...event.toObject(),
            currentOdds: odds
          };
        } catch (err) {
          console.error('Ошибка расчета коэффициентов:', err);
          return {
            ...event.toObject(),
            currentOdds: {
              [event.outcomes[0]?.id]: event.initialOdds || 2.0,
              [event.outcomes[1]?.id]: event.initialOdds || 2.0
            }
          };
        }
      });
      
      res.status(200).json({
        success: true,
        data: {
          events: eventsWithOdds,
          pagination: {
            total: total,
            currentPage: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit: parseInt(limit),
            skip: parseInt(skip)
          }
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения всех событий:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new EventController();
