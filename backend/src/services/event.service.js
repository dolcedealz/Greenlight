// backend/src/services/event.service.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const { Event, EventBet, User } = require('../models');
const mongoose = require('mongoose');

/**
 * Сервис для работы с событиями с поддержкой гибких коэффициентов
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
   * Размещение ставки на событие
   */
  async placeBet(userId, eventId, outcomeId, amount, userIp) {
    const session = await mongoose.startSession();
    
    try {
      console.log('EVENT SERVICE: Начало размещения ставки с гибкими коэффициентами');
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
        const oddsAtBet = currentOdds[outcomeId];
        
        console.log(`EVENT SERVICE: Коэффициент на момент ставки: ${oddsAtBet}`);
        
        if (!oddsAtBet || oddsAtBet < 1.01) {
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
          oddsAtBet: oddsAtBet,
          balanceBefore: balanceBefore,
          balanceAfter: user.balance,
          userIp: userIp,
          metadata: {
            source: 'web',
            sessionId: `bet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            oddsHistory: {
              allOddsAtBet: currentOdds,
              betPosition: await EventBet.countDocuments({ event: eventId }) + 1
            }
          }
        };
        
        const bet = new EventBet(betData);
        await bet.validate();
        await bet.save({ session });
        
        console.log(`EVENT SERVICE: Ставка создана с ID: ${bet._id}`);
        
        // 10. Обновляем статистику события
        outcome.totalBets += amount;
        outcome.betsCount += 1;
        event.totalPool += amount;
        
        await event.save({ session });
        
        console.log(`EVENT SERVICE: Статистика события обновлена. Новый пул: ${event.totalPool}`);
        
        // 11. Пересчитываем коэффициенты ПОСЛЕ обновления
        const newOdds = event.calculateOdds();
        
        console.log(`EVENT SERVICE: Коэффициенты после ставки:`, newOdds);
        
        // 12. Подготавливаем результат
        const result = {
          bet: {
            _id: bet._id,
            event: bet.event,
            outcomeId: bet.outcomeId,
            outcomeName: bet.outcomeName,
            betAmount: bet.betAmount,
            oddsAtBet: bet.oddsAtBet,
            estimatedWin: bet.estimatedWin,
            placedAt: bet.placedAt,
            status: bet.status,
            note: 'Финальная выплата будет рассчитана по коэффициентам на момент завершения события'
          },
          newBalance: user.balance,
          event: {
            ...event.toObject(),
            currentOdds: newOdds,
            oddsChanged: JSON.stringify(currentOdds) !== JSON.stringify(newOdds)
          },
          oddsInfo: {
            oddsAtBet: oddsAtBet,
            newOdds: newOdds[outcomeId],
            oddsChange: newOdds[outcomeId] - oddsAtBet,
            estimatedWin: bet.estimatedWin,
            message: 'Коэффициенты изменились после вашей ставки. Финальная выплата будет рассчитана по коэффициентам на момент завершения события.'
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
   * Получить ставки пользователя - ИСПРАВЛЕННАЯ ВЕРСИЯ
   */
  async getUserBets(userId, options = {}) {
    try {
      console.log('EVENT SERVICE: Получение ставок пользователя:', userId);
      console.log('EVENT SERVICE: Опции:', options);
      
      // Проверяем, что userId является валидным ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Некорректный ID пользователя');
      }
      
      const { limit = 50, skip = 0, status } = options;
      
      // Строим запрос
      const query = { user: new mongoose.Types.ObjectId(userId) };
      
      if (status && status !== 'all') {
        query.status = status;
      }
      
      console.log('EVENT SERVICE: Запрос к базе:', JSON.stringify(query, null, 2));
      
      // Получаем ставки с проверкой на ошибки
      const bets = await EventBet.find(query)
        .populate({
          path: 'event',
          select: 'title description status startTime endTime bettingEndsAt',
          options: { 
            lean: true 
          }
        })
        .sort({ placedAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean()
        .catch(error => {
          console.error('EVENT SERVICE: Ошибка при запросе ставок из БД:', error);
          throw new Error('Ошибка получения ставок из базы данных');
        });
      
      console.log(`EVENT SERVICE: Найдено ставок: ${bets.length}`);
      
      // Получаем общее количество
      const total = await EventBet.countDocuments(query).catch(error => {
        console.error('EVENT SERVICE: Ошибка при подсчете ставок:', error);
        return 0;
      });
      
      // Подготавливаем ставки для фронтенда
      const formattedBets = bets.map(bet => {
        const result = {
          _id: bet._id,
          event: bet.event || { 
            title: 'Событие удалено', 
            status: 'deleted',
            startTime: null,
            endTime: null
          },
          outcomeId: bet.outcomeId,
          outcomeName: bet.outcomeName,
          betAmount: bet.betAmount,
          
          // Коэффициенты и выплаты
          oddsAtBet: bet.oddsAtBet || 2.0,
          finalOdds: bet.finalOdds,
          estimatedWin: bet.estimatedWin || (bet.betAmount * (bet.oddsAtBet || 2.0)),
          actualWin: bet.actualWin || 0,
          profit: bet.profit || 0,
          
          // Статус и даты
          status: bet.status,
          placedAt: bet.placedAt,
          settledAt: bet.settledAt,
          
          // Удобные флаги для фронтенда
          isSettled: bet.status !== 'active',
          isWin: bet.status === 'won',
          amount: bet.betAmount, // Алиас для совместимости
          
          // Информация о гибких коэффициентах
          flexibleOdds: {
            hasFlexibleOdds: true,
            oddsChanged: bet.finalOdds ? Math.abs(bet.finalOdds - (bet.oddsAtBet || 2.0)) > 0.01 : false,
            oddsChange: bet.finalOdds ? bet.finalOdds - (bet.oddsAtBet || 2.0) : null,
            betPosition: bet.metadata?.oddsHistory?.betPosition || 0
          }
        };
        
        // Добавляем информацию об изменении коэффициентов для завершенных ставок
        if (result.isSettled && bet.finalOdds && bet.status === 'won') {
          const oddsChange = bet.finalOdds - (bet.oddsAtBet || 2.0);
          const winChange = (bet.actualWin || 0) - result.estimatedWin;
          
          result.flexibleOdds.oddsChangeBenefit = {
            oddsImproved: oddsChange > 0,
            oddsChange: oddsChange,
            estimatedWin: result.estimatedWin,
            actualWin: bet.actualWin || 0,
            winDifference: winChange,
            benefitPercent: result.estimatedWin > 0 ? ((winChange / result.estimatedWin) * 100).toFixed(2) : 0
          };
        }
        
        return result;
      });
      
      console.log('EVENT SERVICE: Обработка ставок завершена');
      
      // Вычисляем статистику
      const stats = {
        totalBets: total,
        activeBets: bets.filter(bet => bet.status === 'active').length,
        wonBets: bets.filter(bet => bet.status === 'won').length,
        lostBets: bets.filter(bet => bet.status === 'lost').length,
        totalStaked: bets.reduce((sum, bet) => sum + (bet.betAmount || 0), 0),
        totalWon: bets.filter(bet => bet.status === 'won').reduce((sum, bet) => sum + (bet.actualWin || 0), 0),
        totalProfit: bets.reduce((sum, bet) => sum + (bet.profit || 0), 0),
        
        // Статистика гибких коэффициентов
        flexibleOddsStats: {
          betsWithChangedOdds: bets.filter(bet => 
            bet.finalOdds && Math.abs(bet.finalOdds - (bet.oddsAtBet || 2.0)) > 0.01
          ).length,
          avgOddsChange: this.calculateAverageOddsChange(bets),
          benefitedFromOddsChange: bets.filter(bet => 
            bet.status === 'won' && bet.finalOdds && bet.finalOdds > (bet.oddsAtBet || 2.0)
          ).length
        }
      };
      
      console.log('EVENT SERVICE: Статистика ставок рассчитана:', stats);
      
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
   * Вспомогательный метод для расчета среднего изменения коэффициентов
   */
  calculateAverageOddsChange(bets) {
    const betsWithChangedOdds = bets.filter(bet => bet.finalOdds && bet.oddsAtBet);
    
    if (betsWithChangedOdds.length === 0) {
      return 0;
    }
    
    const totalChange = betsWithChangedOdds.reduce((sum, bet) => {
      return sum + (bet.finalOdds - (bet.oddsAtBet || 2.0));
    }, 0);
    
    return totalChange / betsWithChangedOdds.length;
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
   * Создать новое событие - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
      
      // Генерируем ID для исходов, если они не предоставлены
      const processedOutcomes = eventData.outcomes.map((outcome, index) => {
        if (!outcome.id) {
          outcome.id = `outcome_${Date.now()}_${index + 1}_${Math.random().toString(36).substring(2, 8)}`;
          console.log(`EVENT SERVICE: Сгенерирован ID для исхода ${index + 1}: ${outcome.id}`);
        }
        
        return {
          id: outcome.id,
          name: outcome.name,
          totalBets: 0,
          betsCount: 0
        };
      });
      
      console.log('EVENT SERVICE: Обработанные исходы:', JSON.stringify(processedOutcomes, null, 2));
      
      // ИСПРАВЛЕНИЕ: Устанавливаем статус 'active' вместо 'upcoming'
      const event = new Event({
        ...eventData,
        status: 'active', // ИСПРАВЛЕНО: делаем событие сразу активным
        createdBy: adminId,
        totalPool: 0,
        outcomes: processedOutcomes
      });
      
      await event.save();
      
      console.log(`EVENT SERVICE: Событие создано с ID: ${event._id}, статус: ${event.status}`);
      console.log(`EVENT SERVICE: Исходы события:`, event.outcomes.map(o => `${o.id}: ${o.name}`));
      
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
        // 1. Получаем событие с блокировкой
        const event = await Event.findById(eventId).session(session);
        
        if (!event) {
          throw new Error('Событие не найдено');
        }
        
        console.log(`EVENT SERVICE: Найдено событие: ${event.title}, статус: ${event.status}`);
        
        if (event.status === 'finished') {
          throw new Error('Событие уже завершено');
        }
        
        // 2. Проверяем корректность выигрышного исхода
        const winningOutcome = event.outcomes.find(o => o.id === winningOutcomeId);
        if (!winningOutcome) {
          throw new Error('Некорректный ID выигрышного исхода');
        }
        
        console.log(`EVENT SERVICE: Выигрышный исход: ${winningOutcome.name}`);
        
        // 3. Завершаем событие
        event.winningOutcome = winningOutcomeId;
        event.status = 'finished';
        
        // Записываем метаданные о завершении
        if (!event.metadata) {
          event.metadata = {};
        }
        event.metadata.finishedBy = adminId;
        event.metadata.finishedAt = new Date();
        event.metadata.finishType = 'manual';
        
        await event.save({ session });
        
        console.log('EVENT SERVICE: Событие помечено как завершенное');
        
        // 4. Рассчитываем все ставки с финальными коэффициентами
        console.log('EVENT SERVICE: Начинаем расчет ставок с финальными коэффициентами...');
        
        const settlementResults = await EventBet.settleBetsWithFinalOdds(
          eventId, 
          winningOutcomeId
        );
        
        console.log('EVENT SERVICE: Расчет ставок завершен:', settlementResults);
        
        console.log('EVENT SERVICE: Событие успешно завершено');
        
        return {
          event: event,
          settlement: settlementResults
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
