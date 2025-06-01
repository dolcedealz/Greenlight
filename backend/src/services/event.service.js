// backend/src/services/event.service.js - БЕЗ UUID (альтернативное решение)
const { Event, EventBet, User, Transaction } = require('../models');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Функция для генерации уникального ID без uuid
function generateUniqueId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Сервис для управления событиями
 */
class EventService {
  
  /**
   * Получить активные события
   * @param {number} limit - Количество событий
   * @returns {Array} Список активных событий с коэффициентами
   */
  async getActiveEvents(limit = 4) {
    console.log('EVENT SERVICE: Получение активных событий, лимит:', limit);
    
    try {
      const events = await Event.getActiveEvents(limit);
      
      // Добавляем текущие коэффициенты для каждого события
      const eventsWithOdds = events.map(event => {
        try {
          const odds = event.calculateOdds();
          return {
            ...event.toObject(),
            currentOdds: odds
          };
        } catch (err) {
          console.error('Ошибка расчета коэффициентов для события:', event._id, err);
          return {
            ...event.toObject(),
            currentOdds: {
              [event.outcomes[0]?.id]: event.initialOdds || 2.0,
              [event.outcomes[1]?.id]: event.initialOdds || 2.0
            }
          };
        }
      });
      
      console.log('EVENT SERVICE: Найдено активных событий:', eventsWithOdds.length);
      return eventsWithOdds;
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения активных событий:', error);
      throw new Error('Не удалось получить список событий');
    }
  }
  
  /**
   * Получить главное событие
   * @returns {Object|null} Главное событие или null
   */
  async getFeaturedEvent() {
    console.log('EVENT SERVICE: Получение главного события');
    
    try {
      const event = await Event.getFeaturedEvent();
      
      if (!event) {
        console.log('EVENT SERVICE: Главное событие не найдено');
        return null;
      }
      
      // Добавляем коэффициенты
      const odds = event.calculateOdds();
      
      return {
        ...event.toObject(),
        currentOdds: odds
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения главного события:', error);
      throw new Error('Не удалось получить главное событие');
    }
  }
  
  /**
   * Получить событие по ID
   * @param {string} eventId - ID события
   * @returns {Object} Событие с коэффициентами
   */
  async getEventById(eventId) {
    console.log('EVENT SERVICE: Получение события по ID:', eventId);
    
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      // Добавляем коэффициенты
      const odds = event.calculateOdds();
      
      return {
        ...event.toObject(),
        currentOdds: odds
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения события:', error);
      if (error.message === 'Событие не найдено') {
        throw error;
      }
      throw new Error('Не удалось получить событие');
    }
  }
  
  /**
   * Разместить ставку на событие
   * @param {string} userId - ID пользователя
   * @param {string} eventId - ID события
   * @param {string} outcomeId - ID исхода
   * @param {number} amount - Сумма ставки
   * @param {string} userIp - IP адрес пользователя
   * @returns {Object} Результат размещения ставки
   */
  async placeBet(userId, eventId, outcomeId, amount, userIp = null) {
    console.log(`EVENT SERVICE: Размещение ставки пользователем ${userId} на событие ${eventId}`);
    
    try {
      // Получаем событие
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      // Проверяем, можно ли делать ставки
      if (!event.canPlaceBet()) {
        throw new Error('Ставки на это событие больше не принимаются');
      }
      
      // Проверяем корректность исхода
      const outcome = event.outcomes.find(o => o.id === outcomeId);
      if (!outcome) {
        throw new Error('Некорректный исход события');
      }
      
      // Проверяем лимиты ставки
      if (amount < event.minBet) {
        throw new Error(`Минимальная ставка: ${event.minBet} USDT`);
      }
      
      if (amount > event.maxBet) {
        throw new Error(`Максимальная ставка: ${event.maxBet} USDT`);
      }
      
      // Получаем пользователя
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Проверяем баланс
      if (user.balance < amount) {
        throw new Error('Недостаточно средств на балансе');
      }
      
      // Рассчитываем коэффициенты на момент ставки
      const odds = event.calculateOdds();
      const currentOdds = odds[outcomeId];
      
      if (!currentOdds || currentOdds < 1.01) {
        throw new Error('Некорректные коэффициенты для данного исхода');
      }
      
      // Списываем средства с баланса
      const balanceBefore = user.balance;
      user.balance -= amount;
      const balanceAfter = user.balance;
      
      // Создаем ставку
      const bet = new EventBet({
        user: userId,
        event: eventId,
        outcomeId: outcomeId,
        outcomeName: outcome.name,
        betAmount: amount,
        odds: currentOdds,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        userIp: userIp,
        metadata: {
          source: 'web'
        }
      });
      
      // Обновляем событие
      const outcomeIndex = event.outcomes.findIndex(o => o.id === outcomeId);
      event.outcomes[outcomeIndex].totalBets += amount;
      event.outcomes[outcomeIndex].betsCount += 1;
      event.totalPool += amount;
      
      // Создаем транзакцию
      const transaction = new Transaction({
        user: userId,
        type: 'bet',
        amount: amount,
        status: 'completed',
        description: `Ставка на событие: ${event.title}`,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter
      });
      
      // Сохраняем все изменения
      await Promise.all([
        user.save(),
        bet.save(),
        event.save(),
        transaction.save()
      ]);
      
      console.log(`EVENT SERVICE: Ставка успешно размещена: ${amount} USDT на ${outcome.name}`);
      
      // Возвращаем обновленное событие с новыми коэффициентами
      const updatedEvent = await this.getEventById(eventId);
      
      return {
        bet: bet,
        newBalance: balanceAfter,
        event: updatedEvent
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка размещения ставки:', error);
      throw error;
    }
  }
  
  /**
   * Получить ставки пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции запроса
   * @returns {Object} Ставки пользователя
   */
  async getUserBets(userId, options = {}) {
    const { limit = 20, skip = 0, status = null } = options;
    
    console.log(`EVENT SERVICE: Получение ставок пользователя ${userId}`);
    
    try {
      const query = { user: userId };
      if (status) {
        query.status = status;
      }
      
      const bets = await EventBet.find(query)
        .populate('event', 'title status')
        .sort({ placedAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await EventBet.countDocuments(query);
      
      return {
        bets: bets,
        pagination: {
          total: total,
          limit: limit,
          skip: skip,
          hasMore: (skip + limit) < total
        }
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения ставок пользователя:', error);
      throw new Error('Не удалось получить ставки пользователя');
    }
  }
  
  /**
   * Получить общую статистику событий
   * @returns {Object} Статистика
   */
  async getEventsStatistics() {
    console.log('EVENT SERVICE: Получение статистики событий');
    
    try {
      // Статистика по событиям
      const eventsStats = await Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPool: { $sum: '$totalPool' }
          }
        }
      ]);
      
      // Статистика по ставкам
      const betsStats = await EventBet.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$betAmount' }
          }
        }
      ]);
      
      return {
        events: eventsStats,
        bets: betsStats
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения статистики:', error);
      throw new Error('Не удалось получить статистику событий');
    }
  }
  
  /**
   * Создать новое событие (админ)
   * @param {Object} eventData - Данные события
   * @param {string|ObjectId} adminId - ID администратора
   * @returns {Object} Созданное событие
   */
  async createEvent(eventData, adminId) {
    console.log('EVENT SERVICE: Создание нового события:', eventData.title);
    console.log('EVENT SERVICE: AdminId:', adminId, 'тип:', typeof adminId);
    
    try {
      // Убеждаемся, что adminId является ObjectId
      let validAdminId;
      if (typeof adminId === 'string') {
        if (mongoose.Types.ObjectId.isValid(adminId)) {
          validAdminId = new mongoose.Types.ObjectId(adminId);
        } else {
          throw new Error('Некорректный ID администратора');
        }
      } else if (adminId instanceof mongoose.Types.ObjectId) {
        validAdminId = adminId;
      } else {
        throw new Error('ID администратора должен быть строкой или ObjectId');
      }
      
      console.log('EVENT SERVICE: Валидный AdminId:', validAdminId);
      
      // Генерируем уникальные ID для исходов (используем crypto вместо uuid)
      const outcomes = eventData.outcomes.map(outcome => ({
        id: generateUniqueId(), // Используем встроенную функцию вместо uuid
        name: outcome.name,
        totalBets: 0,
        betsCount: 0
      }));
      
      console.log('EVENT SERVICE: Генерированные исходы:', outcomes);
      
      // Создаем объект события
      const eventObj = {
        title: eventData.title,
        description: eventData.description,
        outcomes: outcomes,
        category: eventData.category,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        bettingEndsAt: new Date(eventData.bettingEndsAt),
        featured: eventData.featured || false,
        initialOdds: eventData.initialOdds || 2.0,
        minBet: eventData.minBet || 1,
        maxBet: eventData.maxBet || 1000,
        houseEdge: eventData.houseEdge || 5,
        status: 'active',
        createdBy: validAdminId // Используем валидный ObjectId
      };
      
      console.log('EVENT SERVICE: Объект события:', JSON.stringify(eventObj, null, 2));
      
      // Создаем событие
      const event = new Event(eventObj);
      
      // Валидируем перед сохранением
      await event.validate();
      console.log('EVENT SERVICE: Валидация прошла успешно');
      
      await event.save();
      
      console.log('EVENT SERVICE: Событие создано успешно с ID:', event._id);
      
      return event;
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка создания события:', error);
      console.error('EVENT SERVICE: Stack trace:', error.stack);
      
      // Более детальная обработка ошибок
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new Error('Ошибка валидации: ' + validationErrors.join(', '));
      }
      
      if (error.name === 'CastError') {
        throw new Error('Ошибка типа данных: ' + error.message);
      }
      
      throw new Error('Не удалось создать событие: ' + error.message);
    }
  }
  
  /**
   * Завершить событие (админ)
   * @param {string} eventId - ID события
   * @param {string} winningOutcomeId - ID выигрышного исхода
   * @param {string} adminId - ID администратора
   * @returns {Object} Результат завершения
   */
  async finishEvent(eventId, winningOutcomeId, adminId) {
    console.log(`EVENT SERVICE: Завершение события ${eventId}, победитель: ${winningOutcomeId}`);
    
    try {
      // Получаем событие
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      if (event.status === 'finished') {
        throw new Error('Событие уже завершено');
      }
      
      // Проверяем корректность исхода
      const winningOutcome = event.outcomes.find(o => o.id === winningOutcomeId);
      if (!winningOutcome) {
        throw new Error('Некорректный ID выигрышного исхода');
      }
      
      // Завершаем событие
      await event.finalize(winningOutcomeId);
      
      // Обрабатываем все ставки
      const settlementResults = await EventBet.settleBets(eventId, winningOutcomeId);
      
      // Рассчитываем прибыль казино
      const houseProfit = event.totalPool - settlementResults.totalPayout;
      
      console.log(`EVENT SERVICE: Событие завершено. Выплачено: ${settlementResults.totalPayout} USDT, прибыль: ${houseProfit} USDT`);
      
      return {
        event: event,
        settlementResults: settlementResults,
        houseProfit: houseProfit
      };
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка завершения события:', error);
      throw error;
    }
  }
}

module.exports = new EventService();
