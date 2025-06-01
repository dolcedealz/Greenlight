// backend/src/controllers/event.controller.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
   * Разместить ставку на событие
   */
  async placeBet(req, res) {
    try {
      const { eventId, outcomeId, betAmount } = req.body;
      const userId = req.user._id;
      const userIp = req.ip || req.connection.remoteAddress;
      
      // Валидация входных данных
      if (!eventId || !outcomeId || !betAmount) {
        return res.status(400).json({
          success: false,
          message: 'Не указаны обязательные параметры'
        });
      }
      
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Некорректная сумма ставки'
        });
      }
      
      const result = await eventService.placeBet(
        userId,
        eventId,
        outcomeId,
        amount,
        userIp
      );
      
      res.status(201).json({
        success: true,
        message: 'Ставка успешно размещена',
        data: {
          bet: {
            id: result.bet._id,
            eventId: result.bet.event,
            outcomeId: result.bet.outcomeId,
            outcomeName: result.bet.outcomeName,
            betAmount: result.bet.betAmount,
            odds: result.bet.odds,
            potentialWin: result.bet.potentialWin,
            placedAt: result.bet.placedAt
          },
          newBalance: result.newBalance,
          event: result.event
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка размещения ставки:', error);
      res.status(400).json({
        success: false,
        message: error.message
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
      const adminId = req.user._id;
      const eventData = req.body;
      
      // Проверяем права администратора
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав'
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
   * Завершить событие (админ)
   */
  async finishEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { winningOutcomeId } = req.body;
      const adminId = req.user._id;
      
      // Проверяем права администратора
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав'
        });
      }
      
      if (!winningOutcomeId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID выигрышного исхода'
        });
      }
      
      const result = await eventService.finishEvent(eventId, winningOutcomeId, adminId);
      
      res.status(200).json({
        success: true,
        message: 'Событие завершено успешно',
        data: result
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка завершения события:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить все события для администратора
   */
  async getAllEvents(req, res) {
    try {
      // Проверяем права администратора
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Недостаточно прав'
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
        const odds = event.calculateOdds();
        return {
          ...event.toObject(),
          currentOdds: odds
        };
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
