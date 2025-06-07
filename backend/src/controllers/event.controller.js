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
   * Получить событие по ID (для пользователей)
   */
  async getEventById(req, res) {
    try {
      const { eventId } = req.params;
      
      console.log('EVENT CONTROLLER: Запрос события по ID (пользователь):', eventId);
      
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
      res.status(400).json({
        success: false,
        message: error.message || 'Ошибка получения события'
      });
    }
  }

  /**
   * Получить событие по ID (для админов - с расширенной информацией)
   */
  async getEventByIdAdmin(req, res) {
    try {
      const { eventId } = req.params;
      
      console.log('EVENT CONTROLLER: Админский запрос события по ID:', eventId);
      
      // Проверяем права админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен. Требуются права администратора'
        });
      }
      
      const event = await eventService.getEventById(eventId);
      
      // Для админов добавляем расширенную статистику
      const oddsStats = event.metadata?.flexibleOddsStats || {};
      
      res.status(200).json({
        success: true,
        data: {
          event: event,
          flexibleOdds: true,
          adminData: {
            oddsHistory: oddsStats.oddsHistory || [],
            recalculations: oddsStats.oddsRecalculations || 0,
            extremeOdds: oddsStats.extremeOdds || {}
          }
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения события (админ):', error);
      
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
   * ИСПРАВЛЕННЫЙ МЕТОД: Получить ставки пользователя
   */
  async getUserBets(req, res) {
    try {
      console.log('EVENT CONTROLLER: Запрос ставок пользователя');
      console.log('EVENT CONTROLLER: Headers:', JSON.stringify(req.headers, null, 2));
      console.log('EVENT CONTROLLER: Query:', JSON.stringify(req.query, null, 2));
      
      // Проверяем аутентификацию
      if (!req.user || !req.user._id) {
        console.log('EVENT CONTROLLER: Пользователь не аутентифицирован');
        return res.status(401).json({
          success: false,
          message: 'Пользователь не аутентифицирован'
        });
      }
      
      const userId = req.user._id;
      const { limit = 50, skip = 0, status = 'all' } = req.query;
      
      console.log(`EVENT CONTROLLER: Получение ставок для пользователя ${userId}`);
      console.log('EVENT CONTROLLER: Параметры:', { limit, skip, status });
      
      const options = {
        limit: parseInt(limit) || 50,
        skip: parseInt(skip) || 0
      };
      
      // Добавляем фильтр по статусу если он не 'all'
      if (status && status !== 'all') {
        options.status = status;
      }
      
      console.log('EVENT CONTROLLER: Финальные опции:', options);
      console.log('EVENT CONTROLLER: Вызов eventService.getUserBets...');
      
      const result = await eventService.getUserBets(userId, options);
      
      console.log(`EVENT CONTROLLER: Получено ставок: ${result.bets ? result.bets.length : 0}`);
      console.log('EVENT CONTROLLER: Статистика:', result.stats);
      
      res.status(200).json({
        success: true,
        data: {
          bets: result.bets || [],
          pagination: result.pagination || {
            total: 0,
            currentPage: 1,
            totalPages: 0,
            limit: parseInt(limit) || 50,
            skip: parseInt(skip) || 0
          },
          stats: result.stats || {
            totalBets: 0,
            activeBets: 0,
            wonBets: 0,
            lostBets: 0,
            totalStaked: 0,
            totalWon: 0,
            totalProfit: 0
          },
          system: {
            flexibleOddsEnabled: true,
            message: 'Система гибких коэффициентов активна'
          }
        }
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка получения ставок:', error);
      console.error('EVENT CONTROLLER: Stack trace:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Ошибка получения ставок пользователя',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

  /**
   * Установить событие как главное
   */
  async setFeaturedEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { featured = true } = req.body;
      
      console.log('EVENT CONTROLLER: Установка главного события:', eventId, 'featured:', featured);
      
      // Проверяем права админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен. Требуются права администратора'
        });
      }
      
      const result = await eventService.setFeaturedEvent(eventId, featured);
      
      res.status(200).json({
        success: true,
        data: result,
        message: featured ? 'Событие установлено как главное' : 'Событие убрано из главных'
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка установки главного события:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Ошибка установки главного события'
      });
    }
  }

  /**
   * Убрать главное событие
   */
  async unsetFeaturedEvent(req, res) {
    try {
      console.log('EVENT CONTROLLER: Снятие главного события');
      
      // Проверяем права админа
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Доступ запрещен. Требуются права администратора'
        });
      }
      
      const result = await eventService.unsetAllFeaturedEvents();
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Главное событие убрано'
      });
    } catch (error) {
      console.error('EVENT CONTROLLER: Ошибка снятия главного события:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Ошибка снятия главного события'
      });
    }
  }
}

module.exports = new EventController();
