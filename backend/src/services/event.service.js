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
   * ИСПРАВЛЕННЫЙ МЕТОД: Получить ставки пользователя
   */
  async getUserBets(userId, options = {}) {
    try {
      console.log('EVENT SERVICE: Получение ставок пользователя:', userId);
      console.log('EVENT SERVICE: Опции:', JSON.stringify(options, null, 2));
      
      // Проверяем, что userId является валидным ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('EVENT SERVICE: Некорректный ID пользователя:', userId);
        throw new Error('Некорректный ID пользователя');
      }
      
      const { limit = 50, skip = 0, status } = options;
      
      // Строим запрос
      const query = { user: new mongoose.Types.ObjectId(userId) };
      
      if (status && status !== 'all') {
        query.status = status;
      }
      
      console.log('EVENT SERVICE: Запрос к базе:', JSON.stringify(query, null, 2));
      
      try {
        // Оптимизированный запрос ставок с использованием индексов
        const bets = await EventBet.find(query)
          .populate({
            path: 'event',
            select: 'title description status startTime endTime bettingEndsAt outcomes totalPool',
            options: { 
              lean: true 
            }
          })
          .sort({ placedAt: -1 })
          .limit(parseInt(limit))
          .skip(parseInt(skip))
          .lean()
          .hint('user_bets_optimized'); // Принудительно используем оптимизированный индекс
        
        console.log(`EVENT SERVICE: Найдено ставок в базе: ${bets.length}`);
        
        // Получаем общее количество
        const total = await EventBet.countDocuments(query);
        
        console.log(`EVENT SERVICE: Общее количество ставок: ${total}`);
        
        // Подготавливаем ставки для фронтенда с детальной обработкой
        const formattedBets = bets.map((bet, index) => {
          try {
            console.log(`EVENT SERVICE: Обработка ставки ${index + 1}/${bets.length}, ID: ${bet._id}`);
            
            const result = {
              _id: bet._id,
              
              // Информация о событии (с защитой от null)
              event: bet.event ? {
                _id: bet.event._id,
                title: bet.event.title || 'Неизвестное событие',
                description: bet.event.description || '',
                status: bet.event.status || 'unknown',
                startTime: bet.event.startTime,
                endTime: bet.event.endTime,
                bettingEndsAt: bet.event.bettingEndsAt,
                outcomes: bet.event.outcomes || [],
                totalPool: bet.event.totalPool || 0
              } : {
                _id: null,
                title: 'Событие удалено',
                description: 'Это событие больше не доступно',
                status: 'deleted',
                startTime: null,
                endTime: null,
                bettingEndsAt: null,
                outcomes: [],
                totalPool: 0
              },
              
              // Основная информация о ставке
              outcomeId: bet.outcomeId || '',
              outcomeName: bet.outcomeName || 'Неизвестный исход',
              betAmount: bet.betAmount || 0,
              
              // Коэффициенты и выплаты
              oddsAtBet: bet.oddsAtBet || 2.0,
              finalOdds: bet.finalOdds || null,
              estimatedWin: bet.estimatedWin || (bet.betAmount * (bet.oddsAtBet || 2.0)),
              actualWin: bet.actualWin || 0,
              profit: bet.profit || 0,
              
              // Статус и даты
              status: bet.status || 'active',
              placedAt: bet.placedAt || new Date(),
              settledAt: bet.settledAt || null,
              
              // Удобные флаги для фронтенда
              isSettled: bet.status && bet.status !== 'active',
              isWin: bet.status === 'won',
              isLoss: bet.status === 'lost',
              isPending: bet.status === 'active',
              
              // Алиасы для совместимости
              amount: bet.betAmount || 0,
              outcome: bet.outcomeName || 'Неизвестный исход',
              
              // Информация о гибких коэффициентах
              flexibleOdds: {
                hasFlexibleOdds: true,
                oddsChanged: bet.finalOdds ? Math.abs(bet.finalOdds - (bet.oddsAtBet || 2.0)) > 0.01 : false,
                oddsChange: bet.finalOdds ? bet.finalOdds - (bet.oddsAtBet || 2.0) : null,
                betPosition: bet.metadata?.oddsHistory?.betPosition || 0
              }
            };
            
            // Добавляем информацию об изменении коэффициентов для завершенных выигрышных ставок
            if (result.isWin && bet.finalOdds && bet.oddsAtBet) {
              const oddsChange = bet.finalOdds - bet.oddsAtBet;
              const winChange = (bet.actualWin || 0) - result.estimatedWin;
              
              result.flexibleOdds.oddsChangeBenefit = {
                oddsImproved: oddsChange > 0,
                oddsChange: oddsChange,
                estimatedWin: result.estimatedWin,
                actualWin: bet.actualWin || 0,
                winDifference: winChange,
                benefitPercent: result.estimatedWin > 0 ? ((winChange / result.estimatedWin) * 100).toFixed(2) : 0,
                message: oddsChange > 0 ? 
                  `Вы выиграли больше благодаря изменению коэффициентов: +${winChange.toFixed(2)} USDT` :
                  oddsChange < 0 ?
                  `Коэффициенты снизились: ${winChange.toFixed(2)} USDT` :
                  'Коэффициенты не изменились'
              };
            }
            
            return result;
            
          } catch (formatError) {
            console.error(`EVENT SERVICE: Ошибка форматирования ставки ${bet._id}:`, formatError);
            
            // Возвращаем базовую версию ставки при ошибке форматирования
            return {
              _id: bet._id,
              event: { title: 'Ошибка загрузки события', status: 'error' },
              outcomeId: bet.outcomeId || '',
              outcomeName: bet.outcomeName || 'Неизвестный исход',
              betAmount: bet.betAmount || 0,
              oddsAtBet: bet.oddsAtBet || 2.0,
              estimatedWin: bet.estimatedWin || 0,
              actualWin: bet.actualWin || 0,
              profit: bet.profit || 0,
              status: bet.status || 'active',
              placedAt: bet.placedAt || new Date(),
              isSettled: false,
              flexibleOdds: { hasFlexibleOdds: true, oddsChanged: false }
            };
          }
        });
        
        console.log('EVENT SERVICE: Обработка ставок завершена');
        
        // Вычисляем статистику с защитой от ошибок
        const validBets = bets.filter(bet => bet && bet.betAmount);
        
        const stats = {
          totalBets: total,
          activeBets: validBets.filter(bet => bet.status === 'active').length,
          wonBets: validBets.filter(bet => bet.status === 'won').length,
          lostBets: validBets.filter(bet => bet.status === 'lost').length,
          totalStaked: validBets.reduce((sum, bet) => sum + (bet.betAmount || 0), 0),
          totalWon: validBets.filter(bet => bet.status === 'won').reduce((sum, bet) => sum + (bet.actualWin || 0), 0),
          totalProfit: validBets.reduce((sum, bet) => sum + (bet.profit || 0), 0),
          
          // Статистика гибких коэффициентов
          flexibleOddsStats: {
            betsWithChangedOdds: validBets.filter(bet => 
              bet.finalOdds && Math.abs(bet.finalOdds - (bet.oddsAtBet || 2.0)) > 0.01
            ).length,
            avgOddsChange: this.calculateAverageOddsChange(validBets),
            benefitedFromOddsChange: validBets.filter(bet => 
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
        
      } catch (dbError) {
        console.error('EVENT SERVICE: Ошибка запроса к базе данных:', dbError);
        throw new Error('Ошибка получения ставок из базы данных: ' + dbError.message);
      }
      
    } catch (error) {
      console.error('EVENT SERVICE: Общая ошибка получения ставок пользователя:', error);
      console.error('EVENT SERVICE: Stack trace:', error.stack);
      
      // Возвращаем пустой результат вместо выброса ошибки
      return {
        bets: [],
        pagination: {
          total: 0,
          currentPage: 1,
          totalPages: 0,
          limit: parseInt(options.limit) || 50,
          skip: parseInt(options.skip) || 0
        },
        stats: {
          totalBets: 0,
          activeBets: 0,
          wonBets: 0,
          lostBets: 0,
          totalStaked: 0,
          totalWon: 0,
          totalProfit: 0,
          flexibleOddsStats: {
            betsWithChangedOdds: 0,
            avgOddsChange: 0,
            benefitedFromOddsChange: 0
          }
        }
      };
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
   * Создать новое событие
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
      
      // Устанавливаем статус 'active' вместо 'upcoming'
      const event = new Event({
        ...eventData,
        status: 'active',
        createdBy: adminId,
        totalPool: 0,
        outcomes: processedOutcomes
      });
      
      await event.save();
      
      console.log(`EVENT SERVICE: Событие создано с ID: ${event._id}, статус: ${event.status}`);
      
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
        const settlementResults = await EventBet.settleBetsWithFinalOdds(
          eventId, 
          winningOutcomeId
        );
        
        console.log('EVENT SERVICE: Расчет ставок завершен:', settlementResults);
        
        // 5. Обновляем финансовую статистику казино
        await this.updateCasinoFinancesForEvent(event, settlementResults);
        
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

  /**
   * Обновляет финансовую статистику казино после завершения события
   * @param {Object} event - Объект события
   * @param {Object} settlementResults - Результаты расчета ставок
   */
  async updateCasinoFinancesForEvent(event, settlementResults) {
    try {
      const casinoFinanceService = require('./casino-finance.service');
      
      const totalBets = settlementResults.winningBets + settlementResults.losingBets;
      const totalBetAmount = settlementResults.totalPayout + Math.abs(settlementResults.totalProfit);
      
      // Для событий прибыль казино = проигранные ставки - выигранные выплаты
      const casinoProfit = -settlementResults.totalProfit; // Инвертируем, так как totalProfit считается с точки зрения игроков
      
      // Обновляем через casino finance service
      await casinoFinanceService.updateAfterGame({
        gameType: 'events',
        bet: totalBetAmount,
        profit: casinoProfit,
        win: casinoProfit > 0, // Казино выиграло, если прибыль положительная
        metadata: {
          eventId: event._id,
          eventTitle: event.title,
          eventCategory: event.category,
          totalBets: totalBets,
          winningBets: settlementResults.winningBets,
          losingBets: settlementResults.losingBets,
          totalPayout: settlementResults.totalPayout
        }
      });
      
      console.log(`EVENT SERVICE: Обновлена финансовая статистика - событие: ${event.title}, ставок: ${totalBets}, сумма: ${totalBetAmount}, прибыль казино: ${casinoProfit}`);
      
    } catch (error) {
      console.error('EVENT SERVICE: Ошибка обновления финансовой статистики:', error);
      // Не прерываем основную логику
    }
  }
}

module.exports = new EventService();
