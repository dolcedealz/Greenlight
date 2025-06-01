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
          count: events.length,
          flexibleOdds: true
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
          event: event,
          flexibleOdds: true
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
          event: event,
          flexibleOdds: true
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
      console.log('EVENT CONTROLLER: Запрос на размещение ставки');
      console.log('EVENT CONTROLLER: Params:', JSON.stringify(req.params, null, 2));
      console.log('EVENT CONTROLLER: Body:', JSON.stringify(req.body, null, 2));
      
      // Проверяем аутентификацию пользователя
      if (!req.user || !req.user._id) {
        console.log('EVENT CONTROLLER: Пользователь не аутентифицирован');
        return res.status(401).json({
          success: false,
          message: 'Пользователь не аутентифицирован'
        });
      }
      
      const { eventId } = req.params;
      const { outcomeId, betAmount } = req.body;
      const userId = req.user._id;
      const userIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Валидация данных
      if (!eventId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID события'
        });
      }
      
      if (!outcomeId) {
        return res.status(400).json({
          success: false,
          message: 'Не указан ID исхода'
        });
      }
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Некорректная сумма ставки'
        });
      }
      
      const amount = parseFloat(betAmount);
      
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Сумма ставки должна быть положительным числом'
        });
      }
      
      console.log(`EVENT CONTROLLER: Размещение ставки: пользователь=${userId}, событие=${eventId}, исход=${outcomeId}, сумма=${amount}`);
      
      const result = await eventService.placeBet(userId, eventId, outcomeId, amount, userIp);
      
      console.log('EVENT CONTROLLER: Ставка успешно размещена');
      
      res.status(201).json({
        success: true,
        message: 'Ставка успешно размещена',
        data: result
      });
      
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка размещения ставки:', error);
      
      if (error.message.includes('не найдено') || error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('Недостаточно средств')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Внутренняя ошибка сервера при размещении ставки'
      });
    }
  }
  
  /**
   * Получить ставки пользователя - ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async getUserBets(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос ставок пользователя');
      
      // Проверяем аутентификацию
      if (!req.user || !req.user._id) {
        console.log('EVENT CONTROLLER: Пользователь не аутентифицирован');
        return res.status(401).json({
          success: false,
          message: 'Пользователь не аутентифицирован'
        });
      }
      
      const userId = req.user._id;
      const { limit, skip, status } = req.query;
      
      console.log('EVENT CONTROLLER: Параметры запроса:', { userId, limit, skip, status });
      
      const options = {};
      if (limit) options.limit = parseInt(limit);
      if (skip) options.skip = parseInt(skip);
      if (status) options.status = status;
      
      console.log('EVENT CONTROLLER: Вызов eventService.getUserBets...');
      
      const result = await eventService.getUserBets(userId, options);
      
      console.log(`EVENT CONTROLLER: Получено ставок: ${result.bets.length}`);
      
      res.status(200).json({
        success: true,
        data: {
          ...result,
          system: {
            flexibleOddsEnabled: true,
            message: 'Этот проект использует гибкие коэффициенты'
          }
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения ставок:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка получения ставок пользователя'
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
        data: {
          ...stats,
          flexibleOddsEnabled: true
        }
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
      
      const adminId = req.user._id;
      const eventData = req.body;
      
      // Проверяем права администратора
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        console.log('EVENT CONTROLLER: Недостаточно прав');
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
          event: event,
          flexibleOddsEnabled: true
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
      
      console.log('EVENT CONTROLLER: Завершение события:', eventId, 'победитель:', winningOutcomeId);
      
      // Проверяем права администратора
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
      
      const result = await eventService.finishEvent(eventId, winningOutcomeId, adminId);
      
      res.status(200).json({
        success: true,
        message: 'Событие завершено успешно',
        data: {
          event: result.event,
          settlementResults: result.settlement,
          houseProfit: -result.settlement.totalProfit
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка завершения события:', error);
      
      if (error.message.includes('не найдено') || error.message.includes('не найден')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка завершения события'
      });
    }
  }
  
  /**
   * Получить все события для администратора
   */
  async getAllEvents(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос всех событий от админа');
      
      // Проверяем права администратора
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
