// backend/src/services/event.service.js - ПОЛНАЯ РЕАЛИЗАЦИЯ
const { Event, EventBet, User } = require('../models');
const mongoose = require('mongoose');

/**
 * Сервис для работы с событиями
 */
class EventService {
  /**
   * Получить активные события
   */
  async getActiveEvents(limit = 10) {
    try {
      console.log('EVENT SERVICE: Получение активных событий, лимит:', limit);
      
      const events = await Event.find({
        status: 'active',
        bettingEndsAt: { $gt: new Date() }
      })
      .populate('createdBy', 'telegramId username firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .lean();
      
      console.log(`EVENT SERVICE: Найдено событий: ${events.length}`);
      
      // Добавляем текущие коэффициенты для каждого события
      const eventsWithOdds = events.map(event => {
        try {
          const eventDoc = new Event(event);
          const odds = eventDoc.calculateOdds();
          return {
            ...event,
            currentOdds: odds
          };
        } catch (err) {
          console.error('EVENT SERVICE: Ошибка расчета коэффициентов для события', event._id, ':', err);
          return {
            ...event,
            currentOdds: {
              [event.outcomes[0]?.id]: event.initialOdds || 2.0,
              [event.outcomes[1]?.id]: event.initialOdds || 2.0
            }
          };
        }
      });
      
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
      .populate('createdBy', 'telegramId username firstName lastName')
      .sort({ priority: -1, createdAt: -1 })
      .lean();
      
      if (!event) {
        console.log('EVENT SERVICE: Главное событие не найдено');
        return null;
      }
      
      console.log(`EVENT SERVICE: Найдено главное событие: ${event.title}`);
      
      // Добавляем текущие коэффициенты
      try {
        const eventDoc = new Event(event);
        const odds = eventDoc.calculateOdds();
        return {
          ...event,
          currentOdds: odds
        };
      } catch (err) {
        console.error('EVENT SERVICE: Ошибка расчета коэффициентов для главного события:', err);
        return {
          ...event,
          currentOdds: {
            [event.outcomes[0]?.id]: event.initialOdds || 2.0,
            [event.outcomes[1]?.id]: event.initialOdds || 2.0
          }
        };
      }
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
      console.log('EVENT SERVICE: Получение события по ID:', eventId);
      
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new Error('Некорректный ID события');
      }
      
      const event = await Event.findById(eventId)
        .populate('createdBy', 'telegramId username firstName lastName')
        .lean();
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      console.log(`EVENT SERVICE: Найдено событие: ${event.title}`);
      
      // Добавляем текущие коэффициенты
      try {
        const eventDoc = new Event(event);
        const odds = eventDoc.calculateOdds();
        return {
          ...event,
          currentOdds: odds
        };
      } catch (err) {
        console.error('EVENT SERVICE: Ошибка расчета коэффициентов:', err);
        return {
          ...event,
          currentOdds: {
            [event.outcomes[0]?.id]: event.initialOdds || 2.0,
            [event.outcomes[1]?.id]: event.initialOdds || 2.0
          }
        };
      }
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения события:', error);
      throw error;
    }
  }
  
  /**
   * Размещение ставки на событие - ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async placeBet(userId, eventId, outcomeId, amount, userIp) {
    const session = await mongoose.startSession();
    
    try {
      console.log('EVENT SERVICE: Начало размещения ставки');
      console.log(`  Пользователь: ${userId}`);
      console.log(`  Событие: ${eventId}`);
      console.log(`  Исход: ${outcomeId}`);
      console.log(`  Сумма: ${amount}`);
      
      return await session.withTransaction(async () => {
        // 1. Получаем пользователя с блокировкой
        const user = await User.findById(userId).session(session);
        
        if (!user) {
          throw new Error('Пользователь не найден');
        }
        
        console.log(`EVENT SERVICE: Баланс пользователя: ${user.balance} USDT`);
        
        // 2. Проверяем баланс
        if (user.balance < amount) {
          throw new Error(`Недостаточно средств. Доступно: ${user.balance} USDT, требуется: ${amount} USDT`);
        }
        
        // 3. Получаем событие
        const event = await Event.findById(eventId).session(session);
        
        if (!event) {
          throw new Error('Событие не найдено');
        }
        
        console.log(`EVENT SERVICE: Найдено событие: ${event.title}`);
        
        // 4. Проверяем возможность размещения ставки
        if (!event.canPlaceBet()) {
          throw new Error('Ставки на это событие больше не принимаются');
        }
        
        // 5. Проверяем корректность исхода
        const outcome = event.outcomes.find(o => o.id === outcomeId);
        
        if (!outcome) {
          throw new Error('Указанный исход не найден');
        }
        
        console.log(`EVENT SERVICE: Выбранный исход: ${outcome.name}`);
        
        // 6. Проверяем лимиты ставок
        if (amount < event.minBet) {
          throw new Error(`Минимальная ставка: ${event.minBet} USDT`);
        }
        
        if (amount > event.maxBet) {
          throw new Error(`Максимальная ставка: ${event.maxBet} USDT`);
        }
        
        // 7. Рассчитываем текущие коэффициенты
        const currentOdds = event.calculateOdds();
        const odds = currentOdds[outcomeId];
        
        console.log(`EVENT SERVICE: Текущий коэффициент: ${odds}`);
        
        if (!odds || odds < 1.01) {
          throw new Error('Некорректный коэффициент для данного исхода');
        }
        
        // 8. Списываем средства с баланса пользователя
        const balanceBefore = user.balance;
        user.balance -= amount;
        
        console.log(`EVENT SERVICE: Списание средств: ${balanceBefore} -> ${user.balance}`);
        
        await user.save({ session });
        
        // 9. Создаем ставку
        const betData = {
          user: userId,
          event: eventId,
          outcomeId: outcomeId,
          outcomeName: outcome.name,
          betAmount: amount,
          odds: odds,
          balanceBefore: balanceBefore,
          balanceAfter: user.balance,
          userIp: userIp,
          metadata: {
            source: 'web',
            sessionId: `bet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          }
        };
        
        console.log('EVENT SERVICE: Создание ставки с данными:', JSON.stringify(betData, null, 2));
        
        const bet = new EventBet(betData);
        
        // Валидируем перед сохранением
        await bet.validate();
        console.log('EVENT SERVICE: Валидация ставки прошла успешно');
        
        await bet.save({ session });
        
        console.log(`EVENT SERVICE: Ставка создана с ID: ${bet._id}`);
        console.log(`EVENT SERVICE: potentialWin после сохранения: ${bet.potentialWin}`);
        
        // 10. Обновляем статистику события
        outcome.totalBets += amount;
        outcome.betsCount += 1;
        event.totalPool += amount;
        
        await event.save({ session });
        
        console.log(`EVENT SERVICE: Статистика события обновлена. Новый пул: ${event.totalPool}`);
        
        // 11. Пересчитываем коэффициенты после обновления
        const updatedOdds = event.calculateOdds();
        
        // 12. Подготавливаем результат
        const result = {
          bet: {
            _id: bet._id,
            event: bet.event,
            outcomeId: bet.outcomeId,
            outcomeName: bet.outcomeName,
            betAmount: bet.betAmount,
            odds: bet.odds,
            potentialWin: bet.potentialWin,
            placedAt: bet.placedAt,
            status: bet.status
          },
          newBalance: user.balance,
          event: {
            ...event.toObject(),
            currentOdds: updatedOdds
          }
        };
        
        console.log('EVENT SERVICE: Ставка успешно размещена');
        
        return result;
      });
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка размещения ставки:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Получить ставки пользователя - НОВЫЙ МЕТОД
   */
  async getUserBets(userId, options = {}) {
    try {
      console.log('EVENT SERVICE: Получение ставок пользователя:', userId);
      console.log('EVENT SERVICE: Опции:', options);
      
      const { limit = 50, skip = 0, status } = options;
      
      // Строим запрос
      const query = { user: userId };
      
      if (status && status !== 'all') {
        query.status = status;
      }
      
      console.log('EVENT SERVICE: Запрос к базе:', JSON.stringify(query, null, 2));
      
      // Получаем ставки
      const bets = await EventBet.find(query)
        .populate('event', 'title description status startTime endTime bettingEndsAt')
        .sort({ placedAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();
      
      console.log(`EVENT SERVICE: Найдено ставок: ${bets.length}`);
      
      // Получаем общее количество
      const total = await EventBet.countDocuments(query);
      
      // Подготавливаем ставки для фронтенда
      const formattedBets = bets.map(bet => {
        return {
          _id: bet._id,
          event: bet.event || { title: 'Событие удалено', status: 'deleted' },
          outcomeId: bet.outcomeId,
          outcomeName: bet.outcomeName,
          betAmount: bet.betAmount,
          odds: bet.odds,
          potentialWin: bet.potentialWin || (bet.betAmount * bet.odds),
          actualWin: bet.actualWin || 0,
          profit: bet.profit || 0,
          status: bet.status,
          placedAt: bet.placedAt,
          settledAt: bet.settledAt,
          // Добавляем удобные флаги для фронтенда
          isSettled: bet.status !== 'active',
          isWin: bet.status === 'won',
          amount: bet.betAmount // Алиас для совместимости
        };
      });
      
      console.log('EVENT SERVICE: Первая ставка (пример):', formattedBets[0]);
      
      // Вычисляем статистику
      const stats = {
        totalBets: total,
        activeBets: bets.filter(bet => bet.status === 'active').length,
        wonBets: bets.filter(bet => bet.status === 'won').length,
        lostBets: bets.filter(bet => bet.status === 'lost').length,
        totalStaked: bets.reduce((sum, bet) => sum + bet.betAmount, 0),
        totalWon: bets.filter(bet => bet.status === 'won').reduce((sum, bet) => sum + (bet.actualWin || 0), 0),
        totalProfit: bets.reduce((sum, bet) => sum + (bet.profit || 0), 0)
      };
      
      console.log('EVENT SERVICE: Статистика ставок:', stats);
      
      return {
        bets: formattedBets,
        pagination: {
          total: total,
          currentPage: Math.floor(skip / limit) + 1,
          totalPages: Math.ceil(total / limit),
          limit: parseInt(limit),
          skip: parseInt(skip)
        },
        stats: stats
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
      
      const [
        totalEvents,
        activeEvents,
        totalBets,
        totalVolume
      ] = await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ status: 'active' }),
        EventBet.countDocuments(),
        EventBet.aggregate([
          {
            $group: {
              _id: null,
              totalVolume: { $sum: '$betAmount' },
              totalPayout: { $sum: '$actualWin' }
            }
          }
        ])
      ]);
      
      const stats = {
        totalEvents,
        activeEvents,
        totalBets,
        totalVolume: totalVolume[0]?.totalVolume || 0,
        totalPayout: totalVolume[0]?.totalPayout || 0,
        houseEdge: totalVolume[0] ? 
          ((totalVolume[0].totalVolume - totalVolume[0].totalPayout) / totalVolume[0].totalVolume * 100).toFixed(2) : 
          0
      };
      
      console.log('EVENT SERVICE: Статистика событий:', stats);
      
      return stats;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения статистики:', error);
      throw error;
    }
  }
  
  /**
   * Создать новое событие (админ)
   */
  async createEvent(eventData, adminId) {
    try {
      console.log('EVENT SERVICE: Создание события:', eventData.title);
      
      // Валидация данных
      if (!eventData.title || !eventData.description) {
        throw new Error('Название и описание события обязательны');
      }
      
      if (!eventData.outcomes || eventData.outcomes.length !== 2) {
        throw new Error('Событие должно иметь ровно 2 исхода');
      }
      
      // Создаем событие
      const event = new Event({
        ...eventData,
        createdBy: adminId,
        totalPool: 0,
        outcomes: eventData.outcomes.map(outcome => ({
          ...outcome,
          totalBets: 0,
          betsCount: 0
        }))
      });
      
      await event.save();
      
      console.log(`EVENT SERVICE: Событие создано с ID: ${event._id}`);
      
      return event;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка создания события:', error);
      throw error;
    }
  }
  
  /**
   * Завершить событие (админ)
   */
  async finishEvent(eventId, winningOutcomeId, adminId) {
    const session = await mongoose.startSession();
    
    try {
      console.log('EVENT SERVICE: Завершение события:', eventId, 'победитель:', winningOutcomeId);
      
      return await session.withTransaction(async () => {
        // Получаем событие
        const event = await Event.findById(eventId).session(session);
        
        if (!event) {
          throw new Error('Событие не найдено');
        }
        
        if (event.status === 'finished') {
          throw new Error('Событие уже завершено');
        }
        
        // Проверяем корректность выигрышного исхода
        if (!event.outcomes.find(o => o.id === winningOutcomeId)) {
          throw new Error('Некорректный ID выигрышного исхода');
        }
        
        // Завершаем событие
        await event.finalize(winningOutcomeId);
        
        // Рассчитываем все ставки
        const settlementResult = await EventBet.settleBets(eventId, winningOutcomeId);
        
        console.log('EVENT SERVICE: Результат расчета ставок:', settlementResult);
        
        return {
          event: event,
          settlement: settlementResult
        };
      });
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка завершения события:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new EventService();
