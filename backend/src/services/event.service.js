// backend/src/services/event.service.js
const { Event, EventBet, User, Transaction } = require('../models');

/**
 * Сервис для управления событиями и ставками
 */
class EventService {
  /**
   * Создать новое событие
   */
  async createEvent(eventData, creatorId) {
    try {
      // Валидация данных
      if (!eventData.title || !eventData.description) {
        throw new Error('Название и описание обязательны');
      }
      
      if (!eventData.outcomes || eventData.outcomes.length !== 2) {
        throw new Error('Событие должно иметь ровно 2 исхода');
      }
      
      // Создаем событие
      const event = new Event({
        ...eventData,
        createdBy: creatorId,
        status: 'active', // Сразу активируем
        outcomes: eventData.outcomes.map((outcome, index) => ({
          id: `outcome_${index + 1}`,
          name: outcome.name,
          totalBets: 0,
          betsCount: 0
        }))
      });
      
      await event.save();
      
      console.log(`EVENT SERVICE: Создано событие ${event._id}: ${event.title}`);
      return event;
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка создания события:', error);
      throw error;
    }
  }
  
  /**
   * Получить активные события
   */
  async getActiveEvents(limit = 4) {
    try {
      console.log('EVENT SERVICE: Запрос активных событий, лимит:', limit);
      
      const events = await Event.find({
        status: 'active',
        bettingEndsAt: { $gt: new Date() }
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit);
      
      console.log(`EVENT SERVICE: Найдено событий: ${events.length}`);
      
      // Добавляем текущие коэффициенты к каждому событию
      const eventsWithOdds = events.map(event => {
        try {
          const odds = event.calculateOdds();
          return {
            ...event.toObject(),
            currentOdds: odds
          };
        } catch (err) {
          console.error('EVENT SERVICE: Ошибка расчета коэффициентов:', err);
          // Возвращаем событие с базовыми коэффициентами
          return {
            ...event.toObject(),
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
      return [];
    }
  }
  
  /**
   * Получить событие для главной страницы
   */
  async getFeaturedEvent() {
    try {
      console.log('EVENT SERVICE: Запрос главного события');
      
      // Сначала ищем события с флагом featured
      let event = await Event.findOne({
        featured: true,
        status: 'active',
        bettingEndsAt: { $gt: new Date() }
      }).sort({ priority: -1, createdAt: -1 });
      
      // Если нет featured события, берем любое активное
      if (!event) {
        console.log('EVENT SERVICE: Не найдено featured событие, ищем любое активное');
        
        event = await Event.findOne({
          status: 'active',
          bettingEndsAt: { $gt: new Date() }
        }).sort({ totalPool: -1, createdAt: -1 });
      }
      
      if (!event) {
        console.log('EVENT SERVICE: Нет активных событий');
        return null;
      }
      
      console.log(`EVENT SERVICE: Найдено главное событие: ${event.title}`);
      
      try {
        const odds = event.calculateOdds();
        
        return {
          ...event.toObject(),
          currentOdds: odds
        };
      } catch (err) {
        console.error('EVENT SERVICE: Ошибка расчета коэффициентов для главного события:', err);
        // Возвращаем событие с базовыми коэффициентами
        return {
          ...event.toObject(),
          currentOdds: {
            [event.outcomes[0]?.id]: event.initialOdds || 2.0,
            [event.outcomes[1]?.id]: event.initialOdds || 2.0
          }
        };
      }
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения главного события:', error);
      return null;
    }
  }
  
  /**
   * Получить событие по ID
   */
  async getEventById(eventId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      const odds = event.calculateOdds();
      
      return {
        ...event.toObject(),
        currentOdds: odds
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения события:', error);
      throw error;
    }
  }
  
  /**
   * Разместить ставку на событие
   */
  async placeBet(userId, eventId, outcomeId, betAmount, userIp = null) {
    try {
      // Получаем пользователя и событие
      const [user, event] = await Promise.all([
        User.findById(userId),
        Event.findById(eventId)
      ]);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      // Проверяем возможность сделать ставку
      if (!event.canPlaceBet()) {
        throw new Error('Ставки на это событие больше не принимаются');
      }
      
      // Проверяем корректность исхода
      const outcome = event.outcomes.find(o => o.id === outcomeId);
      if (!outcome) {
        throw new Error('Неверный исход события');
      }
      
      // Проверяем лимиты ставки
      if (betAmount < event.minBet) {
        throw new Error(`Минимальная ставка: ${event.minBet} USDT`);
      }
      
      if (betAmount > event.maxBet) {
        throw new Error(`Максимальная ставка: ${event.maxBet} USDT`);
      }
      
      // Проверяем баланс пользователя
      if (user.balance < betAmount) {
        throw new Error('Недостаточно средств на балансе');
      }
      
      // Вычисляем текущие коэффициенты
      const currentOdds = event.calculateOdds();
      const odds = currentOdds[outcomeId];
      
      // Сохраняем баланс до ставки
      const balanceBefore = user.balance;
      
      // Списываем ставку с баланса
      user.balance -= betAmount;
      user.totalWagered += betAmount;
      await user.save();
      
      // Создаем транзакцию списания
      const betTransaction = new Transaction({
        user: userId,
        type: 'event_bet',
        amount: -betAmount,
        description: `Ставка на событие: ${event.title}`,
        balanceBefore: balanceBefore,
        balanceAfter: user.balance,
        metadata: {
          eventId: eventId,
          outcomeId: outcomeId,
          odds: odds
        }
      });
      await betTransaction.save();
      
      // Создаем запись ставки
      const bet = new EventBet({
        user: userId,
        event: eventId,
        outcomeId: outcomeId,
        outcomeName: outcome.name,
        betAmount: betAmount,
        odds: odds,
        balanceBefore: balanceBefore,
        balanceAfter: user.balance,
        userIp: userIp
      });
      await bet.save();
      
      // Обновляем статистику события
      outcome.totalBets += betAmount;
      outcome.betsCount += 1;
      event.totalPool += betAmount;
      await event.save();
      
      console.log(`EVENT SERVICE: Ставка ${bet._id} размещена: ${betAmount} USDT на "${outcome.name}"`);
      
      // Возвращаем обновленное событие с новыми коэффициентами
      const updatedEvent = await this.getEventById(eventId);
      
      return {
        bet: bet,
        event: updatedEvent,
        newBalance: user.balance
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка размещения ставки:', error);
      throw error;
    }
  }
  
  /**
   * Завершить событие и рассчитать выплаты
   */
  async finishEvent(eventId, winningOutcomeId, adminId) {
    try {
      const event = await Event.findById(eventId);
      
      if (!event) {
        throw new Error('Событие не найдено');
      }
      
      if (event.status === 'finished') {
        throw new Error('Событие уже завершено');
      }
      
      // Проверяем корректность выигрышного исхода
      const winningOutcome = event.outcomes.find(o => o.id === winningOutcomeId);
      if (!winningOutcome) {
        throw new Error('Неверный ID выигрышного исхода');
      }
      
      console.log(`EVENT SERVICE: Завершение события ${eventId}, победитель: ${winningOutcome.name}`);
      
      // Завершаем все ставки и рассчитываем выплаты
      const settlementResults = await EventBet.settleBets(eventId, winningOutcomeId);
      
      // Создаем транзакции выплат для выигрышных ставок
      const winningBets = await EventBet.find({
        event: eventId,
        outcomeId: winningOutcomeId,
        status: 'won'
      }).populate('user');
      
      for (const bet of winningBets) {
        const winTransaction = new Transaction({
          user: bet.user._id,
          type: 'event_win',
          amount: bet.actualWin,
          description: `Выигрыш в событии: ${event.title}`,
          balanceBefore: bet.user.balance - bet.actualWin,
          balanceAfter: bet.user.balance,
          metadata: {
            eventId: eventId,
            betId: bet._id,
            odds: bet.odds
          }
        });
        await winTransaction.save();
      }
      
      // Рассчитываем прибыль казино (5% от общего пула)
      const houseProfit = event.totalPool * (event.houseEdge / 100);
      
      // Финализируем событие
      await event.finalize(winningOutcomeId);
      
      console.log(`EVENT SERVICE: Событие ${eventId} завершено. Прибыль казино: ${houseProfit.toFixed(2)} USDT`);
      
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
        .populate('event', 'title status winningOutcome')
        .sort({ placedAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await EventBet.countDocuments(query);
      
      return {
        bets: bets,
        pagination: {
          total: total,
          currentPage: Math.floor(skip / limit) + 1,
          totalPages: Math.ceil(total / limit),
          limit: limit,
          skip: skip
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
      const stats = await Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPool: { $sum: '$totalPool' }
          }
        }
      ]);
      
      const betsStats = await EventBet.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$betAmount' },
            totalWin: { $sum: '$actualWin' }
          }
        }
      ]);
      
      return {
        events: stats,
        bets: betsStats
      };
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка получения статистики:', error);
      return {
        events: [],
        bets: []
      };
    }
  }
}

module.exports = new EventService();
