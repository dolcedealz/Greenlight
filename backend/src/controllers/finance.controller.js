// backend/src/controllers/finance.controller.js
const { casinoFinanceService } = require('../services');

/**
 * Контроллер для управления финансами казино (админ)
 */
class FinanceController {
  /**
   * Получить текущее финансовое состояние
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getCurrentState(req, res) {
    try {
      const financeState = await casinoFinanceService.getCurrentFinanceState();
      
      res.status(200).json({
        success: true,
        data: {
          balances: {
            totalUsers: financeState.totalUserBalance,
            operational: financeState.operationalBalance,
            reserve: financeState.reserveBalance,
            availableForWithdrawal: financeState.availableForWithdrawal
          },
          settings: {
            reservePercentage: financeState.reservePercentage
          },
          statistics: {
            totalDeposits: financeState.totalDeposits,
            totalWithdrawals: financeState.totalWithdrawals,
            totalBets: financeState.totalBets,
            totalWins: financeState.totalWins,
            totalCommissions: financeState.totalCommissions,
            totalOwnerWithdrawals: financeState.totalOwnerWithdrawals
          },
          warnings: financeState.warnings,
          lastCalculated: financeState.lastCalculated,
          lastOwnerWithdrawal: financeState.lastOwnerWithdrawal
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка получения состояния:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить финансовый отчет - СОВМЕСТИМОСТЬ С АДМИН БОТОМ
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getFinancialReport(req, res) {
    try {
      const { period = 'day' } = req.query;
      
      // Получаем текущее состояние финансов
      const financeState = await casinoFinanceService.getCurrentFinanceState();
      const report = await casinoFinanceService.getFinancialReport(period);
      
      // Формируем полный отчет в формате, ожидаемом админ ботом
      const fullReport = {
        current: {
          totalUserBalance: financeState.totalUserBalance,
          operationalBalance: financeState.operationalBalance,
          reserveBalance: financeState.reserveBalance,
          availableForWithdrawal: financeState.availableForWithdrawal,
          reservePercentage: financeState.reservePercentage,
          totalCommissions: financeState.totalCommissions,
          totalPromocodeExpenses: financeState.totalPromocodeExpenses,
          commissionBreakdown: financeState.commissionBreakdown || { duels: 0, events: 0 },
          warnings: financeState.warnings || {
            lowReserve: false,
            highRiskRatio: false,
            negativeOperational: false
          }
        },
        allTime: {
          totalBets: financeState.totalBets,
          totalWins: financeState.totalWins,
          totalDeposits: financeState.totalDeposits,
          totalWithdrawals: financeState.totalWithdrawals,
          gameStats: financeState.gameStats
        },
        period: {
          name: period,
          games: {
            count: report?.games?.count || 0,
            totalBets: report?.games?.totalBets || 0,
            totalWins: report?.games?.totalWins || 0,
            profit: (report?.games?.totalBets || 0) - (report?.games?.totalWins || 0)
          },
          deposits: report?.deposits || 0,
          withdrawals: report?.withdrawals || 0,
          commissions: report?.commissions || 0,
          promocodes: report?.promocodes || 0
        }
      };
      
      res.status(200).json({
        success: true,
        data: fullReport
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка получения отчета:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Пересчитать все финансы
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async recalculateFinances(req, res) {
    try {
      console.log(`FINANCE CONTROLLER: Запрос пересчета от админа ${req.user._id}`);
      
      const financeState = await casinoFinanceService.recalculateAllFinances();
      
      res.status(200).json({
        success: true,
        message: 'Финансы успешно пересчитаны',
        data: {
          balances: {
            totalUsers: financeState.totalUserBalance,
            operational: financeState.operationalBalance,
            reserve: financeState.reserveBalance,
            availableForWithdrawal: financeState.availableForWithdrawal
          },
          warnings: financeState.warnings
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка пересчета:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Установить процент резервирования
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async setReservePercentage(req, res) {
    try {
      const { percentage } = req.body;
      
      if (percentage === undefined || isNaN(percentage)) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректный процент резервирования'
        });
      }
      
      const financeState = await casinoFinanceService.setReservePercentage(percentage);
      
      res.status(200).json({
        success: true,
        message: `Процент резервирования установлен на ${percentage}%`,
        data: {
          reservePercentage: financeState.reservePercentage,
          reserveBalance: financeState.reserveBalance,
          availableForWithdrawal: financeState.availableForWithdrawal
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка установки процента:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Вывести прибыль владельца
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async withdrawOwnerProfit(req, res) {
    try {
      const { amount, recipient, comment } = req.body;
      const adminId = req.user._id;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Укажите корректную сумму для вывода'
        });
      }
      
      console.log(`FINANCE CONTROLLER: Запрос вывода прибыли: ${amount} USDT от админа ${adminId}`);
      
      const result = await casinoFinanceService.withdrawOwnerProfit(amount, adminId);
      
      res.status(200).json({
        success: true,
        message: `Прибыль ${amount} USDT успешно выведена`,
        data: {
          amount,
          recipient,
          newOperationalBalance: result.newOperationalBalance,
          newAvailable: result.newAvailable,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка вывода прибыли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить историю изменений балансов
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getBalanceHistory(req, res) {
    try {
      const { limit = 100 } = req.query;
      
      const financeState = await casinoFinanceService.getCurrentFinanceState();
      
      // Берем последние N записей из истории
      const history = financeState.balanceHistory
        .slice(-Number(limit))
        .reverse();
      
      res.status(200).json({
        success: true,
        data: {
          history,
          total: financeState.balanceHistory.length
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка получения истории:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  /**
   * Получить статистику по играм
   * @param {Object} req - Запрос Express
   * @param {Object} res - Ответ Express
   */
  async getGameStatistics(req, res) {
    try {
      const financeState = await casinoFinanceService.getCurrentFinanceState();
      
      // Рассчитываем общий RTP по каждой игре
      const gameStatsWithRTP = {};
      
      for (const [gameType, stats] of Object.entries(financeState.gameStats)) {
        gameStatsWithRTP[gameType] = {
          ...stats,
          rtp: stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(2) : 0,
          houseEdge: stats.totalBets > 0 ? (stats.profit / stats.totalBets * 100).toFixed(2) : 0
        };
      }
      
      // Общая статистика
      const totalRTP = financeState.totalBets > 0 
        ? (financeState.totalWins / financeState.totalBets * 100).toFixed(2) 
        : 0;
      
      res.status(200).json({
        success: true,
        data: {
          games: gameStatsWithRTP,
          total: {
            totalBets: financeState.totalBets,
            totalWins: financeState.totalWins,
            totalProfit: financeState.totalBets - financeState.totalWins,
            rtp: totalRTP,
            houseEdge: (100 - totalRTP).toFixed(2)
          }
        }
      });
    } catch (error) {
      console.error('FINANCE CONTROLLER: Ошибка получения статистики игр:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new FinanceController();