// backend/src/services/event.service.js
const { Event, EventBet, User, Transaction } = require('../models');
const mongoose = require('mongoose');

/**
 * Сервис для управления событиями
 */
class EventService {
  /**
   * Получить активные события
   */
  async getActiveEvents(limit = 10) {
    try {
      console.log(`EVENT SERVICE: Получение активных событий, лимит: ${limit}`);
      
      const events = await Event.find({
        status: 'active',
        bettingEndsAt: { $gt: new Date() }
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .populate('createdBy', 'telegramId username firstName lastName');
      
      // Добавляем текущие коэффициенты
      const eventsWithOdds = events.map(event => {
        const odds = event.calculateOdds();
        return {
          ...event.toObject(),
          currentOdds: odds
        };
      });
      
      console.log(`EVENT SERVICE: Найдено ${eventsWithOdds.length} активных событий`);
      return eventsWithOdds;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения активных событий:', error);
      throw error;
    }
  }
  
  /**
   * Получить главное событие
   */
  async getFeaturedEvent() {
    try {
      console.log('EVENT SERVICE: Получение главного события');
      
      const event = await Event.findOne({
        featured: true,
        status: 'active',
        bettingEndsAt: { $gt: new Date() }
      })
      .sort({ priority: -1, createdAt: -1 })
      .populate('createdBy', 'telegramId username firstName lastName');
      
      if (!event) {
        console.log('EVENT SERVICE: Главное событие не найдено');
        return null;
      }
      
      // Добавляем текущие коэффициенты
      const odds = event.calculateOdds();
      const eventWithOdds = {
        ...event.toObject(),
        currentOdds: odds
      };
      
      console.log(`EVENT SERVICE: Найдено главное событие: ${event.title}`);
      return eventWithOdds;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения главного события:', error);
      throw error;
    }
  }
  
  /**
   * Получить событие по ID
   */
  async getEventById(eventId) {
    try {
      console.log(`EVENT SERVICE: Получение события по ID: ${eventId}`);
      
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new Error('Некорректный ID события');
      }
      
      const event = await Event.findById(eventId)
        .populate('createdBy', 'telegramId username firstName lastName');
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      // Добавляем текущие коэффициенты
      const odds = event.calculateOdds();
      const eventWithOdds = {
        ...event.toObject(),
        currentOdds: odds
      };
      
      console.log(`EVENT SERVICE: Событие найдено: ${event.title}`);
      return eventWithOdds;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения события:', error);
      throw error;
    }
  }
  
  /**
   * Создать событие
   */
  async createEvent(eventData, adminId) {
    try {
      console.log('EVENT SERVICE: Создание события:', JSON.stringify(eventData, null, 2));
      
      // Генерируем уникальные ID для исходов
      const outcomes = eventData.outcomes.map((outcome, index) => ({
        id: `outcome_${index + 1}`,
        name: outcome.name,
        totalBets: 0,
        betsCount: 0
      }));
      
      // Создаем событие
      const eventToCreate = {
        ...eventData,
        outcomes,
        createdBy: adminId,
        status: 'active' // Сразу делаем активным
      };
      
      console.log('EVENT SERVICE: Данные для создания:', JSON.stringify(eventToCreate, null, 2));
      
      const event = new Event(eventToCreate);
      await event.save();
      
      console.log(`EVENT SERVICE: Событие создано с ID: ${event._id}`);
      
      // Заполняем информацию о создателе
      await event.populate('createdBy', 'telegramId username firstName lastName');
      
      // Добавляем коэффициенты
      const odds = event.calculateOdds();
      
      return {
        ...event.toObject(),
        currentOdds: odds
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка создания события:', error);
      throw new Error(`Ошибка создания события: ${error.message}`);
    }
  }
  
  /**
   * Разместить ставку на событие
   */
  async placeBet(userId, eventId, outcomeId, betAmount, userIp = null) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`EVENT SERVICE: Размещение ставки пользователем ${userId} на событие ${eventId}`);
      
      // Получаем событие
      const event = await Event.findById(eventId).session(session);
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      // Проверяем возможность сделать ставку
      if (!event.canPlaceBet()) {
        throw new Error('Ставки на это событие больше не принимаются');
      }
      
      // Проверяем существование исхода
      const outcome = event.outcomes.find(o => o.id === outcomeId);
      if (!outcome) {
        throw new Error('Исход не найден');
      }
      
      // Проверяем лимиты ставки
      if (betAmount < event.minBet) {
        throw new Error(`Минимальная ставка: ${event.minBet} USDT`);
      }
      
      if (betAmount > event.maxBet) {
        throw new Error(`Максимальная ставка: ${event.maxBet} USDT`);
      }
      
      // Получаем пользователя
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств');
      }
      
      // Рассчитываем коэффициенты до ставки
      const oddsBeforeBet = event.calculateOdds();
      const currentOdds = oddsBeforeBet[outcomeId];
      
      // Списываем средства с баланса пользователя
      const balanceBefore = user.balance;
      user.balance -= betAmount;
      user.totalWagered += betAmount;
      await user.save({ session });
      
      // Создаем ставку
      const bet = new EventBet({
        user: userId,
        event: eventId,
        outcomeId,
        outcomeName: outcome.name,
        betAmount,
        odds: currentOdds,
        potentialWin: betAmount * currentOdds,
        balanceBefore,
        balanceAfter: user.balance,
        userIp,
        metadata: {
          source: 'web'
        }
      });
      
      await bet.save({ session });
      
      // Обновляем событие
      const outcomeIndex = event.outcomes.findIndex(o => o.id === outcomeId);
      event.outcomes[outcomeIndex].totalBets += betAmount;
      event.outcomes[outcomeIndex].betsCount += 1;
      event.totalPool += betAmount;
      
      await event.save({ session });
      
      // Создаем транзакцию
      const transaction = new Transaction({
        user: userId,
        type: 'bet',
        amount: betAmount,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Ставка на событие: ${event.title}`,
        metadata: {
          eventId,
          betId: bet._id,
          outcomeId,
          outcomeName: outcome.name
        }
      });
      
      await transaction.save({ session });
      
      await session.commitTransaction();
      
      console.log(`EVENT SERVICE: Ставка размещена успешно, ID: ${bet._id}`);
      
      // Возвращаем обновленное событие с новыми коэффициентами
      const updatedEvent = await Event.findById(eventId);
      const newOdds = updatedEvent.calculateOdds();
      
      return {
        bet,
        newBalance: user.balance,
        event: {
          ...updatedEvent.toObject(),
          currentOdds: newOdds
        }
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('EVENT SERVICE: Ошибка размещения ставки:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Завершить событие
   */
  async finishEvent(eventId, winningOutcomeId, adminId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`EVENT SERVICE: Завершение события ${eventId}, победитель: ${winningOutcomeId}`);
      
      // Получаем событие
      const event = await Event.findById(eventId).session(session);
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      if (event.status === 'finished') {
        throw new Error('Событие уже завершено');
      }
      
      // Проверяем корректность исхода
      const winningOutcome = event.outcomes.find(o => o.id === winningOutcomeId);
      if (!winningOutcome) {
        throw new Error('Некорректный ID победившего исхода');
      }
      
      // Завершаем событие
      await event.finalize(winningOutcomeId);
      await event.save({ session });
      
      // Обрабатываем все ставки
      const settlementResults = await EventBet.settleBets(eventId, winningOutcomeId);
      
      // Рассчитываем прибыль казино
      const houseProfit = event.totalPool - settlementResults.totalPayout;
      
      // Создаем транзакцию для прибыли казино
      if (houseProfit > 0) {
        const { financeService } = require('./finance.service');
        await financeService.addToOperationalBalance(houseProfit, 'event_profit', {
          eventId: event._id,
          eventTitle: event.title,
          totalPool: event.totalPool,
          totalPayout: settlementResults.totalPayout
        });
      }
      
      await session.commitTransaction();
      
      console.log(`EVENT SERVICE: Событие завершено, выплачено: ${settlementResults.totalPayout} USDT`);
      
      return {
        event,
        settlementResults,
        houseProfit
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('EVENT SERVICE: Ошибка завершения события:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Получить ставки пользователя
   */
  async getUserBets(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, status = null } = options;
      
      const query = { user: userId };
      if (status) {
        query.status = status;
      }
      
      const bets = await EventBet.find(query)
        .populate('event', 'title description status winningOutcome')
        .sort({ placedAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await EventBet.countDocuments(query);
      
      return {
        bets,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения ставок пользователя:', error);
      throw error;
    }
  }
  
  /**
   * Получить статистику событий
   */
  async getEventsStatistics() {
    try {
      console.log('EVENT SERVICE: Получение статистики событий');
      
      // Статистика по событиям
      const eventStats = await Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPool: { $sum: '$totalPool' }
          }
        }
      ]);
      
      // Статистика по ставкам
      const betStats = await EventBet.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$betAmount' }
          }
        }
      ]);
      
      return {
        events: eventStats,
        bets: betStats
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения статистики:', error);
      throw error;
    }
  }
}

module.exports = new EventService();
