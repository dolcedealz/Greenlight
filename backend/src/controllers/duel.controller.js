const duelService = require('../services/duel.service');
const { validationResult } = require('express-validator');

class DuelController {
  
  // Создание приглашения на дуэль (для inline режима)
  async createInvitation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации',
          errors: errors.array()
        });
      }
      
      const { targetUsername, gameType, format = 'bo1', amount } = req.body;
      const challengerId = req.user.id;
      const challengerUsername = req.user.username;
      
      const invitation = await duelService.createInvitation({
        challengerId,
        challengerUsername,
        targetUsername,
        gameType,
        format,
        amount,
        metadata: {
          source: 'api',
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });
      
      res.json({
        success: true,
        data: {
          inviteId: invitation.inviteId,
          invitation
        }
      });
      
    } catch (error) {
      console.error('Ошибка создания приглашения:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Принятие приглашения
  async acceptInvitation(req, res) {
    try {
      const { inviteId } = req.params;
      const acceptorId = req.user.id;
      const acceptorUsername = req.user.username;
      
      const result = await duelService.acceptInvitation(inviteId, acceptorId, acceptorUsername);
      
      res.json({
        success: true,
        data: {
          duel: result.duel,
          sessionId: result.duel.sessionId
        }
      });
      
    } catch (error) {
      console.error('Ошибка принятия приглашения:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Отклонение приглашения
  async declineInvitation(req, res) {
    try {
      const { inviteId } = req.params;
      const userId = req.user.id;
      
      const { DuelInvitation } = require('../models');
      
      // Находим приглашение и обновляем статус
      const invitation = await DuelInvitation.findOne({ where: { inviteId } });
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: 'Приглашение не найдено'
        });
      }
      
      if (!invitation.canAccept(userId, req.user.username)) {
        return res.status(403).json({
          success: false,
          message: 'Вы не можете отклонить это приглашение'
        });
      }
      
      await invitation.update({ status: 'declined' });
      
      res.json({
        success: true,
        message: 'Приглашение отклонено'
      });
      
    } catch (error) {
      console.error('Ошибка отклонения приглашения:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
  
  // Создание дуэли напрямую (для групповых чатов)
  async createDuel(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации',
          errors: errors.array()
        });
      }
      
      const {
        challengerId,
        challengerUsername,
        opponentId,
        opponentUsername,
        gameType,
        format = 'bo1',
        amount,
        chatId,
        chatType,
        messageId,
        winsRequired
      } = req.body;
      
      // Используем данные из запроса (для Telegram бота) или из auth middleware
      const actualChallengerId = challengerId || req.user?.id;
      const actualChallengerUsername = challengerUsername || req.user?.username;
      
      if (!actualChallengerId || !actualChallengerUsername) {
        return res.status(400).json({
          success: false,
          message: 'Отсутствуют данные инициатора дуэли'
        });
      }
      
      const duel = await duelService.createDuel({
        challengerId: actualChallengerId,
        challengerUsername: actualChallengerUsername,
        opponentId,
        opponentUsername,
        gameType,
        format,
        amount,
        chatId,
        chatType,
        messageId
      });
      
      res.json({
        success: true,
        data: {
          duel,
          sessionId: duel.sessionId
        }
      });
      
    } catch (error) {
      console.error('Ошибка создания дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Присоединение к открытой дуэли
  async joinDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const playerId = req.user.id;
      const playerUsername = req.user.username;
      
      // Находим дуэль по sessionId
      const existingDuel = await duelService.getDuel(sessionId);
      
      const duel = await duelService.joinDuel(existingDuel.id, playerId, playerUsername);
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка присоединения к дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Начало игры
  async startGame(req, res) {
    try {
      const { sessionId } = req.params;
      const playerId = req.user.id;
      
      const result = await duelService.startGame(sessionId, playerId);
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Ошибка начала игры:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Сделать ход
  async makeMove(req, res) {
    try {
      const { sessionId } = req.params;
      const { result, messageId } = req.body;
      const playerId = req.user.id;
      
      if (!result || result < 1 || result > 6) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный результат хода'
        });
      }
      
      const duel = await duelService.makeMove(sessionId, playerId, result, messageId);
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка хода:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Получение информации о дуэли
  async getDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
      
      const duel = await duelService.getDuel(sessionId);
      
      // Проверяем права доступа
      if (!duel.isParticipant(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Нет доступа к этой дуэли'
        });
      }
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка получения дуэли:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Получение активных дуэлей пользователя
  async getActiveDuels(req, res) {
    try {
      const userId = req.user.id;
      const duels = await duelService.getUserActiveDuels(userId);
      
      res.json({
        success: true,
        data: { duels }
      });
      
    } catch (error) {
      console.error('Ошибка получения активных дуэлей:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
  
  // Получение истории дуэлей
  async getDuelHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      
      const result = await duelService.getUserDuelHistory(userId, limit, offset);
      
      res.json({
        success: true,
        data: {
          duels: result.rows,
          total: result.count,
          limit,
          offset
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения истории:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
  
  // Получение статистики дуэлей пользователя
  async getDuelStats(req, res) {
    try {
      const userId = req.user.id;
      const { Duel } = require('../models');
      const { Op } = require('sequelize');
      
      // Получаем статистику
      const stats = await Duel.findAll({
        where: {
          [Op.or]: [
            { challengerId: userId },
            { opponentId: userId }
          ],
          status: 'completed'
        },
        attributes: [
          [Duel.sequelize.fn('COUNT', '*'), 'totalGames'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN 1 ELSE 0 END`)
          ), 'wins'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN winAmount ELSE -amount END`)
          ), 'totalProfit'],
          'gameType'
        ],
        group: ['gameType'],
        raw: true
      });
      
      // Общая статистика
      const totalStats = await Duel.findOne({
        where: {
          [Op.or]: [
            { challengerId: userId },
            { opponentId: userId }
          ],
          status: 'completed'
        },
        attributes: [
          [Duel.sequelize.fn('COUNT', '*'), 'totalGames'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN 1 ELSE 0 END`)
          ), 'totalWins'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN winAmount ELSE -amount END`)
          ), 'totalProfit']
        ],
        raw: true
      });
      
      res.json({
        success: true,
        data: {
          byGame: stats,
          total: totalStats
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
  
  // Отмена дуэли
  async cancelDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
      
      const duel = await duelService.cancelDuel(sessionId, userId);
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка отмены дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Получение открытых дуэлей (для админа или публичного просмотра)
  async getOpenDuels(req, res) {
    try {
      const { Duel } = require('../models');
      
      const duels = await Duel.findAll({
        where: {
          status: 'pending',
          opponentId: null
        },
        limit: 20,
        order: [['createdAt', 'DESC']]
      });
      
      res.json({
        success: true,
        data: { duels }
      });
      
    } catch (error) {
      console.error('Ошибка получения открытых дуэлей:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }

  // Принятие дуэли
  async acceptDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const { userId } = req.body;
      const playerId = userId || req.user.id;
      const playerUsername = req.user.username;
      
      const duel = await duelService.joinDuel(sessionId, playerId, playerUsername);
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка принятия дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Отклонение дуэли
  async declineDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const { userId } = req.body;
      const playerId = userId || req.user.id;
      
      const duel = await duelService.cancelDuel(sessionId, playerId, 'declined');
      
      res.json({
        success: true,
        data: { duel }
      });
      
    } catch (error) {
      console.error('Ошибка отклонения дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Сохранение результата раунда
  async saveRound(req, res) {
    try {
      const { sessionId } = req.params;
      const roundData = req.body;
      
      // Валидация данных раунда
      if (!roundData.round || !roundData.challengerResult || !roundData.opponentResult) {
        return res.status(400).json({
          success: false,
          message: 'Недостаточно данных для сохранения раунда'
        });
      }
      
      // Сохраняем раунд через сервис
      const result = await duelService.makeMove(sessionId, roundData.winnerId, roundData.challengerResult);
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Ошибка сохранения раунда:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Завершение дуэли
  async finishDuel(req, res) {
    try {
      const { sessionId } = req.params;
      const { winnerId } = req.body;
      
      if (!winnerId) {
        return res.status(400).json({
          success: false,
          message: 'ID победителя обязателен'
        });
      }
      
      const duel = await duelService.getDuel(sessionId);
      
      if (!duel) {
        return res.status(404).json({
          success: false,
          message: 'Дуэль не найдена'
        });
      }
      
      // Завершаем дуэль
      await duelService.finishDuel(duel, winnerId, duel.challengerId === winnerId ? duel.challengerUsername : duel.opponentUsername, null);
      
      // Возвращаем обновленную дуэль
      const updatedDuel = await duelService.getDuel(sessionId);
      
      res.json({
        success: true,
        data: { 
          duel: updatedDuel,
          winAmount: Math.floor(duel.amount * 2 * 0.95) // 95% от банка
        }
      });
      
    } catch (error) {
      console.error('Ошибка завершения дуэли:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Получение истории дуэлей конкретного пользователя
  async getUserHistoryById(req, res) {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      
      const result = await duelService.getUserDuelHistory(userId, limit, offset);
      
      res.json({
        success: true,
        data: {
          duels: result.rows,
          total: result.count,
          limit,
          offset
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения истории пользователя:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }

  // Получение статистики конкретного пользователя
  async getUserStatsById(req, res) {
    try {
      const { userId } = req.params;
      const { Duel } = require('../models');
      const { Op } = require('sequelize');
      
      // Получаем статистику
      const stats = await Duel.findAll({
        where: {
          [Op.or]: [
            { challengerId: userId },
            { opponentId: userId }
          ],
          status: 'completed'
        },
        attributes: [
          [Duel.sequelize.fn('COUNT', '*'), 'totalGames'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN 1 ELSE 0 END`)
          ), 'wins'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN winAmount ELSE -amount END`)
          ), 'totalProfit'],
          'gameType'
        ],
        group: ['gameType'],
        raw: true
      });
      
      // Общая статистика
      const totalStats = await Duel.findOne({
        where: {
          [Op.or]: [
            { challengerId: userId },
            { opponentId: userId }
          ],
          status: 'completed'
        },
        attributes: [
          [Duel.sequelize.fn('COUNT', '*'), 'totalGames'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN 1 ELSE 0 END`)
          ), 'totalWins'],
          [Duel.sequelize.fn('SUM', 
            Duel.sequelize.literal(`CASE WHEN winnerId = '${userId}' THEN winAmount ELSE -amount END`)
          ), 'totalProfit']
        ],
        raw: true
      });

      // Получаем любимую игру
      const favoriteGame = stats.reduce((prev, current) => 
        (prev.totalGames > current.totalGames) ? prev : current
      )?.gameType || '🎲';

      res.json({
        success: true,
        data: {
          wins: parseInt(totalStats?.totalWins) || 0,
          losses: (parseInt(totalStats?.totalGames) || 0) - (parseInt(totalStats?.totalWins) || 0),
          totalWinnings: Math.max(parseFloat(totalStats?.totalProfit) || 0, 0),
          totalLosses: Math.abs(Math.min(parseFloat(totalStats?.totalProfit) || 0, 0)),
          favoriteGame: favoriteGame,
          byGame: stats
        }
      });
      
    } catch (error) {
      console.error('Ошибка получения статистики пользователя:', error);
      res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
      });
    }
  }
}

module.exports = new DuelController();