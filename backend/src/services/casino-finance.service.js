// backend/src/services/casino-finance.service.js
const { CasinoFinance, User, Game, Deposit, Withdrawal, Transaction } = require('../models');
const mongoose = require('mongoose');

class CasinoFinanceService {
  /**
   * Пересчитывает все финансовые показатели казино
   * @returns {Object} - Обновленная финансовая статистика
   */
  async recalculateAllFinances() {
    console.log('FINANCE: Начинаем полный пересчет финансов казино');
    
    try {
      const finance = await CasinoFinance.getInstance();
      
      // 1. Рассчитываем общий баланс всех пользователей (основной + реферальный)
      const userBalanceResult = await User.aggregate([
        { $match: { isBlocked: false } },
        { 
          $group: { 
            _id: null, 
            regularBalance: { $sum: '$balance' },
            referralBalance: { $sum: '$referralStats.referralBalance' }
          } 
        }
      ]);
      
      const regularBalance = userBalanceResult[0]?.regularBalance || 0;
      const referralBalance = userBalanceResult[0]?.referralBalance || 0;
      finance.totalUserBalance = regularBalance + referralBalance;
      
      console.log(`CASINO FINANCE: Баланс пользователей - основной: ${regularBalance}, реферальный: ${referralBalance}, общий: ${finance.totalUserBalance}`);
      
      // 2. Рассчитываем общие суммы депозитов и выводов
      const depositStats = await Deposit.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      const withdrawalStats = await Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      finance.totalDeposits = depositStats[0]?.total || 0;
      finance.totalWithdrawals = withdrawalStats[0]?.total || 0;
      
      // 3. Рассчитываем статистику по играм
      const gameStats = await Game.aggregate([
        {
          $group: {
            _id: '$gameType',
            totalBets: { $sum: '$bet' },
            totalWins: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
            totalGames: { $sum: 1 }
          }
        }
      ]);
      
      // Обнуляем статистику игр
      finance.totalBets = 0;
      finance.totalWins = 0;
      
      // Обновляем статистику по каждой игре
      gameStats.forEach(stat => {
        if (finance.gameStats[stat._id]) {
          finance.gameStats[stat._id].totalBets = stat.totalBets;
          finance.gameStats[stat._id].totalWins = stat.totalWins;
          finance.gameStats[stat._id].totalGames = stat.totalGames;
          finance.gameStats[stat._id].profit = stat.totalBets - stat.totalWins;
          
          finance.totalBets += stat.totalBets;
          finance.totalWins += stat.totalWins;
        }
      });
      
      // 4. Рассчитываем комиссии
      // Инициализируем commissionBreakdown если он не существует
      if (!finance.commissionBreakdown) {
        finance.commissionBreakdown = {
          duels: 0,
          events: 0
        };
      }
      
      // Комиссии с дуэлей (PvP)
      const duelCommissions = await mongoose.model('Duel').aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$commission' } } }
      ]);
      
      finance.commissionBreakdown.duels = duelCommissions[0]?.total || 0;
      
      // Для событий маржа включена в коэффициенты, поэтому комиссия = прибыль от событий
      finance.commissionBreakdown.events = finance.gameStats.events?.profit || 0;
      
      finance.totalCommissions = finance.commissionBreakdown.duels + finance.commissionBreakdown.events;
      
      // 5. Рассчитываем расходы на промокоды
      const promocodeExpenses = await Transaction.aggregate([
        { $match: { type: 'promocode_balance', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      finance.totalPromocodeExpenses = promocodeExpenses[0]?.total || 0;
      
      // 5.5. НОВОЕ: Рассчитываем общие комиссии CryptoBot
      const cryptoBotFees = await Transaction.aggregate([
        { 
          $match: { 
            'payment.fee': { $exists: true, $gt: 0 },
            status: 'completed' 
          } 
        },
        { $group: { _id: null, total: { $sum: '$payment.fee' } } }
      ]);
      
      finance.totalCryptoBotFees = cryptoBotFees[0]?.total || 0;
      
      // 6. ИСПРАВЛЕНО: Рассчитываем оперативный баланс
      // Оперативный баланс = ТОЛЬКО прибыль казино (ставки - выигрыши + комиссии - промокоды)
      // НЕ включаем депозиты и выводы пользователей!
      finance.operationalBalance = (finance.totalBets - finance.totalWins) + finance.totalCommissions - finance.totalPromocodeExpenses;
      
      console.log('FINANCE: Расчет оперативного баланса:');
      console.log(`- Всего ставок: ${finance.totalBets.toFixed(2)} USDT`);
      console.log(`- Всего выигрышей: ${finance.totalWins.toFixed(2)} USDT`);
      console.log(`- Комиссии: ${finance.totalCommissions.toFixed(2)} USDT`);
      console.log(`  • Дуэли: ${finance.commissionBreakdown.duels.toFixed(2)} USDT`);
      console.log(`  • События: ${finance.commissionBreakdown.events.toFixed(2)} USDT`);
      console.log(`- Расходы на промокоды: ${finance.totalPromocodeExpenses.toFixed(2)} USDT`);
      console.log(`- Комиссии CryptoBot: ${finance.totalCryptoBotFees.toFixed(2)} USDT`);
      console.log(`- Оперативный баланс: ${finance.operationalBalance.toFixed(2)} USDT`);
      
      // 6. Рассчитываем резерв и доступную сумму
      finance.calculateReserve();
      
      // 7. Проверяем предупреждения
      finance.checkWarnings();
      
      // 8. Обновляем время последнего расчета
      finance.lastCalculated = new Date();
      
      // 9. Добавляем в историю
      finance.addToHistory('full_recalculation', {
        totalUsers: await User.countDocuments({ isBlocked: false }),
        totalGames: await Game.countDocuments()
      });
      
      await finance.save();
      
      console.log('FINANCE: Пересчет завершен');
      console.log(`- Баланс пользователей: ${finance.totalUserBalance.toFixed(2)} USDT`);
      console.log(`- Оперативный баланс (прибыль): ${finance.operationalBalance.toFixed(2)} USDT`);
      console.log(`- Резерв: ${finance.reserveBalance.toFixed(2)} USDT`);
      console.log(`- Доступно для вывода: ${finance.availableForWithdrawal.toFixed(2)} USDT`);
      
      return finance;
      
    } catch (error) {
      console.error('FINANCE: Ошибка при пересчете финансов:', error);
      throw error;
    }
  }
  
  /**
   * Обновляет финансы после игры
   * @param {Object} gameData - Данные игры
   */
  async updateAfterGame(gameData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      const { gameType, bet, profit, win } = gameData;
      
      // Обновляем общую статистику
      finance.totalBets += bet;
      if (win) {
        finance.totalWins += (bet + profit);
      }
      
      // Обновляем статистику по типу игры
      if (finance.gameStats[gameType]) {
        finance.gameStats[gameType].totalBets += bet;
        if (win) {
          finance.gameStats[gameType].totalWins += (bet + profit);
        }
        finance.gameStats[gameType].totalGames += 1;
        finance.gameStats[gameType].profit = 
          finance.gameStats[gameType].totalBets - 
          finance.gameStats[gameType].totalWins;
      }
      
      // Обновляем оперативный баланс
      if (win) {
        finance.operationalBalance -= profit; // Выигрыш уменьшает прибыль казино
      } else {
        finance.operationalBalance += bet; // Проигрыш увеличивает прибыль казино
      }
      
      // Пересчитываем резерв
      finance.calculateReserve();
      finance.checkWarnings();
      
      await finance.save();
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после игры:', error);
    }
  }
  
  /**
   * Обновляет финансы после депозита с учетом комиссий CryptoBot
   * @param {Object} depositData - Данные депозита
   */
  async updateAfterDeposit(depositData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      const { amount, netAmount, fee } = depositData;
      
      // Увеличиваем общую сумму депозитов (валовую)
      finance.totalDeposits += amount;
      
      // Увеличиваем общий баланс пользователей (чистую сумму)
      finance.totalUserBalance += netAmount || amount;
      
      // НОВОЕ: Учитываем комиссии CryptoBot
      if (fee && fee > 0) {
        // Создаем поле для отслеживания комиссий если его нет
        if (!finance.totalCryptoBotFees) {
          finance.totalCryptoBotFees = 0;
        }
        finance.totalCryptoBotFees += fee;
        
        console.log(`FINANCE: Комиссия CryptoBot: ${fee.toFixed(2)} USDT`);
        console.log(`- Общие комиссии CryptoBot: ${finance.totalCryptoBotFees.toFixed(2)} USDT`);
      }
      
      // ВАЖНО: НЕ увеличиваем оперативный баланс!
      // Депозиты - это деньги пользователей, а не прибыль казино
      
      console.log(`FINANCE: Обработка депозита ${amount} USDT (чистыми: ${netAmount || amount} USDT)`);
      console.log(`- Новый баланс пользователей: ${finance.totalUserBalance.toFixed(2)} USDT`);
      console.log(`- Оперативный баланс (не изменился): ${finance.operationalBalance.toFixed(2)} USDT`);
      
      // Пересчитываем резерв (он зависит от оперативного баланса)
      finance.calculateReserve();
      finance.checkWarnings();
      
      finance.addToHistory('deposit', {
        amount: amount,
        netAmount: netAmount || amount,
        fee: fee || 0,
        userId: depositData.user
      });
      
      await finance.save();
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после депозита:', error);
    }
  }
  
  /**
   * Обновляет финансы после вывода пользователя с учетом комиссий CryptoBot
   * @param {Object} withdrawalData - Данные вывода
   */
  async updateAfterUserWithdrawal(withdrawalData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      const { amount, netAmount, fee } = withdrawalData;
      
      // Увеличиваем общую сумму выводов (полную сумму)
      finance.totalWithdrawals += amount;
      
      // Уменьшаем общий баланс пользователей (полную сумму списанную с пользователя)
      finance.totalUserBalance -= amount;
      
      // НОВОЕ: Учитываем комиссии CryptoBot при выводах
      if (fee && fee > 0) {
        // Создаем поле для отслеживания комиссий если его нет
        if (!finance.totalCryptoBotFees) {
          finance.totalCryptoBotFees = 0;
        }
        finance.totalCryptoBotFees += fee;
        
        console.log(`FINANCE: Комиссия CryptoBot за вывод: ${fee.toFixed(2)} USDT`);
        console.log(`- Общие комиссии CryptoBot: ${finance.totalCryptoBotFees.toFixed(2)} USDT`);
      }
      
      // ВАЖНО: НЕ уменьшаем оперативный баланс!
      // Выводы пользователей - это их деньги, а не прибыль казино
      
      console.log(`FINANCE: Обработка вывода ${amount} USDT (переведено: ${netAmount || amount} USDT)`);
      console.log(`- Новый баланс пользователей: ${finance.totalUserBalance.toFixed(2)} USDT`);
      console.log(`- Оперативный баланс (не изменился): ${finance.operationalBalance.toFixed(2)} USDT`);
      
      // Пересчитываем резерв
      finance.calculateReserve();
      finance.checkWarnings();
      
      finance.addToHistory('user_withdrawal', {
        amount: amount,
        netAmount: netAmount || amount,
        fee: fee || 0,
        userId: withdrawalData.user
      });
      
      await finance.save();
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после вывода пользователя:', error);
    }
  }
  
  /**
   * Выводит прибыль владельца
   * @param {number} amount - Сумма для вывода
   * @param {string} adminId - ID администратора
   * @returns {Object} - Результат операции
   */
  async withdrawOwnerProfit(amount, adminId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const finance = await CasinoFinance.getInstance();
      
      // Проверяем доступную сумму
      if (amount > finance.availableForWithdrawal) {
        throw new Error(
          `Недостаточно средств для вывода. ` +
          `Доступно: ${finance.availableForWithdrawal.toFixed(2)} USDT`
        );
      }
      
      // Проверяем минимальную сумму
      if (amount < 10) {
        throw new Error('Минимальная сумма вывода: 10 USDT');
      }
      
      // Обновляем балансы
      finance.operationalBalance -= amount;
      finance.totalOwnerWithdrawals += amount;
      finance.lastOwnerWithdrawal = new Date();
      
      // Пересчитываем резерв и доступную сумму
      finance.calculateReserve();
      finance.checkWarnings();
      
      // Добавляем в историю
      finance.addToHistory('owner_withdrawal', {
        amount,
        adminId,
        previousOperational: finance.operationalBalance + amount,
        newOperational: finance.operationalBalance
      });
      
      await finance.save({ session });
      
      // TODO: Здесь должна быть интеграция с CryptoBot для реального вывода
      // Пока просто логируем
      console.log(`FINANCE: Вывод прибыли владельца: ${amount} USDT`);
      
      await session.commitTransaction();
      
      return {
        success: true,
        amount,
        newOperationalBalance: finance.operationalBalance,
        newAvailable: finance.availableForWithdrawal
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Получает текущее финансовое состояние
   * @returns {Object} - Финансовая статистика
   */
  async getCurrentFinanceState() {
    const finance = await CasinoFinance.getInstance();
    
    // Проверяем, нужен ли пересчет (если прошло больше часа)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (finance.lastCalculated < hourAgo) {
      console.log('FINANCE: Автоматический пересчет (прошло больше часа)');
      await this.recalculateAllFinances();
      return await CasinoFinance.getInstance();
    }
    
    return finance;
  }
  
  /**
   * Получает финансовый отчет
   * @param {string} period - Период ('day', 'week', 'month', 'all')
   * @returns {Object} - Детальный отчет
   */
  async getFinancialReport(period = 'day') {
    const finance = await this.getCurrentFinanceState();
    
    // Определяем даты для фильтрации
    let dateFilter = new Date();
    switch (period) {
      case 'day':
        dateFilter.setDate(dateFilter.getDate() - 1);
        break;
      case 'week':
        dateFilter.setDate(dateFilter.getDate() - 7);
        break;
      case 'month':
        dateFilter.setMonth(dateFilter.getMonth() - 1);
        break;
      default:
        dateFilter = new Date(0); // Все время
    }
    
    // Получаем статистику за период
    const periodDeposits = await Deposit.aggregate([
      { 
        $match: { 
          status: 'paid',
          createdAt: { $gte: dateFilter }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const periodWithdrawals = await Withdrawal.aggregate([
      { 
        $match: { 
          status: 'completed',
          createdAt: { $gte: dateFilter }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const periodGames = await Game.aggregate([
      { 
        $match: { 
          createdAt: { $gte: dateFilter }
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalBets: { $sum: '$bet' },
          totalWins: { $sum: { $cond: ['$win', { $add: ['$bet', '$profit'] }, 0] } },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    // Считаем активных пользователей
    const activeUsers = await User.countDocuments({
      lastActivity: { $gte: dateFilter },
      isBlocked: false
    });
    
    return {
      current: {
        totalUserBalance: finance.totalUserBalance,
        operationalBalance: finance.operationalBalance,
        reserveBalance: finance.reserveBalance,
        availableForWithdrawal: finance.availableForWithdrawal,
        reservePercentage: finance.reservePercentage,
        warnings: finance.warnings
      },
      period: {
        name: period,
        deposits: {
          total: periodDeposits[0]?.total || 0,
          count: periodDeposits[0]?.count || 0
        },
        withdrawals: {
          total: periodWithdrawals[0]?.total || 0,
          count: periodWithdrawals[0]?.count || 0
        },
        games: {
          totalBets: periodGames[0]?.totalBets || 0,
          totalWins: periodGames[0]?.totalWins || 0,
          count: periodGames[0]?.count || 0,
          profit: (periodGames[0]?.totalBets || 0) - (periodGames[0]?.totalWins || 0)
        },
        activeUsers
      },
      allTime: {
        totalDeposits: finance.totalDeposits,
        totalWithdrawals: finance.totalWithdrawals,
        totalBets: finance.totalBets,
        totalWins: finance.totalWins,
        totalOwnerWithdrawals: finance.totalOwnerWithdrawals,
        gameStats: finance.gameStats
      },
      lastCalculated: finance.lastCalculated,
      lastOwnerWithdrawal: finance.lastOwnerWithdrawal
    };
  }
  
  /**
   * Устанавливает процент резервирования
   * @param {number} percentage - Новый процент (0-100)
   * @returns {Object} - Обновленная финансовая статистика
   */
  async setReservePercentage(percentage) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Процент резервирования должен быть от 0 до 100');
    }
    
    const finance = await CasinoFinance.getInstance();
    
    finance.reservePercentage = percentage;
    finance.calculateReserve();
    finance.checkWarnings();
    
    finance.addToHistory('reserve_percentage_changed', {
      oldPercentage: finance.reservePercentage,
      newPercentage: percentage
    });
    
    await finance.save();
    
    console.log(`FINANCE: Процент резервирования изменен на ${percentage}%`);
    
    return finance;
  }

  /**
   * Обновляет финансы после завершения дуэли
   * @param {Object} duelData - Данные дуэли
   */
  async updateAfterDuel(duelData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      // Инициализируем commissionBreakdown если он не существует
      if (!finance.commissionBreakdown) {
        finance.commissionBreakdown = {
          duels: 0,
          events: 0
        };
      }
      
      const { commission, amount } = duelData;
      
      // Увеличиваем общую сумму комиссий
      finance.totalCommissions += commission;
      finance.commissionBreakdown.duels += commission;
      
      // Увеличиваем оперативный баланс на сумму комиссии
      finance.operationalBalance += commission;
      
      console.log(`FINANCE: Обработка комиссии с дуэли ${commission} USDT`);
      console.log(`- Новый оперативный баланс: ${finance.operationalBalance.toFixed(2)} USDT`);
      console.log(`- Всего комиссий с дуэлей: ${finance.commissionBreakdown.duels.toFixed(2)} USDT`);
      
      // Пересчитываем резерв
      finance.calculateReserve();
      finance.checkWarnings();
      
      finance.addToHistory('duel_commission', {
        commission,
        totalAmount: amount * 2,
        duelId: duelData.sessionId
      });
      
      await finance.save();
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после дуэли:', error);
    }
  }

  /**
   * Обновляет финансы после промокода
   * @param {Object} promocodeData - Данные промокода
   */
  async updateAfterPromocode(promocodeData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      const { type, value } = promocodeData;
      
      // Только промокоды типа 'balance' влияют на финансы казино
      if (type === 'balance') {
        // Увеличиваем расходы на промокоды
        finance.totalPromocodeExpenses += value;
        
        // Уменьшаем оперативный баланс (расход казино)
        finance.operationalBalance -= value;
        
        // Увеличиваем баланс пользователей
        finance.totalUserBalance += value;
        
        console.log(`FINANCE: Активация промокода на ${value} USDT`);
        console.log(`- Новый оперативный баланс: ${finance.operationalBalance.toFixed(2)} USDT`);
        console.log(`- Новый баланс пользователей: ${finance.totalUserBalance.toFixed(2)} USDT`);
        console.log(`- Всего расходов на промокоды: ${finance.totalPromocodeExpenses.toFixed(2)} USDT`);
        
        // Пересчитываем резерв
        finance.calculateReserve();
        finance.checkWarnings();
        
        finance.addToHistory('promocode_expense', {
          type,
          value,
          promocodeId: promocodeData._id,
          userId: promocodeData.activatedBy
        });
        
        await finance.save();
      }
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после промокода:', error);
    }
  }

  /**
   * Обновляет финансы после выплаты реферального баланса
   * ИСПРАВЛЕНО: НЕ списываем с оперативного баланса, так как обязательства уже учтены
   * @param {Object} payoutData - Данные выплаты
   */
  async updateAfterReferralPayout(payoutData) {
    try {
      const finance = await CasinoFinance.getInstance();
      
      const { amount, partnerId, type } = payoutData;
      
      // ИСПРАВЛЕНО: НЕ списываем с оперативного баланса!
      // Реферальные выплаты - это только перевод между балансами
      // Реферальные обязательства уже учтены при начислении комиссий
      
      // Увеличиваем счетчик реферальных выплат (для статистики)
      if (!finance.totalReferralPayments) {
        finance.totalReferralPayments = 0;
      }
      finance.totalReferralPayments += amount;
      
      console.log(`FINANCE: Выплата реферального баланса ${amount} USDT партнеру ${partnerId}`);
      console.log(`- ИСПРАВЛЕНО: НЕ списываем с оперативного баланса (только перевод между балансами)`);
      console.log(`- Оперативный баланс (не изменился): ${finance.operationalBalance.toFixed(2)} USDT`);
      console.log(`- Всего реферальных выплат: ${finance.totalReferralPayments.toFixed(2)} USDT`);
      
      // Пересчитываем резерв
      finance.calculateReserve();
      finance.checkWarnings();
      
      finance.addToHistory('referral_payout', {
        amount,
        partnerId,
        type
      });
      
      await finance.save();
      
    } catch (error) {
      console.error('FINANCE: Ошибка обновления после реферальной выплаты:', error);
      throw error;
    }
  }
}

module.exports = new CasinoFinanceService();
