// backend/src/controllers/admin-giveaway.controller.js
const { 
  Giveaway, 
  GiveawayPrize, 
  GiveawayParticipation, 
  User 
} = require('../models');
const crypto = require('crypto');

class AdminGiveawayController {
  /**
   * Получить все призы
   */
  async getAllPrizes(req, res) {
    try {
      const { page = 1, limit = 20, type } = req.query;
      const skip = (page - 1) * limit;

      const filter = type ? { type } : {};
      
      const prizes = await GiveawayPrize.find(filter)
        .populate('createdBy', 'firstName lastName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await GiveawayPrize.countDocuments(filter);

      res.json({
        success: true,
        data: {
          prizes,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Ошибка получения призов:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Создать приз
   */
  async createPrize(req, res) {
    try {
      const { name, description, image, type, value, giftData } = req.body;
      const adminId = req.user.id;

      // Валидация обязательных полей
      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: 'Название и тип приза обязательны'
        });
      }

      // Валидация типа приза
      const allowedTypes = ['telegram_gift', 'promo_code', 'balance_bonus'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Недопустимый тип приза'
        });
      }

      const prize = new GiveawayPrize({
        name,
        description,
        image,
        type,
        value: value || 0,
        giftData: type === 'telegram_gift' ? giftData : undefined,
        createdBy: adminId
      });

      await prize.save();

      const populatedPrize = await GiveawayPrize.findById(prize._id)
        .populate('createdBy', 'firstName lastName username');

      res.status(201).json({
        success: true,
        message: 'Приз успешно создан',
        data: populatedPrize
      });

    } catch (error) {
      console.error('Ошибка создания приза:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Обновить приз
   */
  async updatePrize(req, res) {
    try {
      const { prizeId } = req.params;
      const updateData = req.body;

      const prize = await GiveawayPrize.findByIdAndUpdate(
        prizeId,
        updateData,
        { new: true }
      ).populate('createdBy', 'firstName lastName username');

      if (!prize) {
        return res.status(404).json({
          success: false,
          message: 'Приз не найден'
        });
      }

      res.json({
        success: true,
        message: 'Приз успешно обновлен',
        data: prize
      });

    } catch (error) {
      console.error('Ошибка обновления приза:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Удалить приз
   */
  async deletePrize(req, res) {
    try {
      const { prizeId } = req.params;

      // Проверяем, не используется ли приз в активных розыгрышах
      const activeGiveaways = await Giveaway.countDocuments({
        prize: prizeId,
        status: { $in: ['pending', 'active'] }
      });

      if (activeGiveaways > 0) {
        return res.status(400).json({
          success: false,
          message: 'Нельзя удалить приз, используемый в активных розыгрышах'
        });
      }

      const prize = await GiveawayPrize.findByIdAndDelete(prizeId);

      if (!prize) {
        return res.status(404).json({
          success: false,
          message: 'Приз не найден'
        });
      }

      res.json({
        success: true,
        message: 'Приз успешно удален'
      });

    } catch (error) {
      console.error('Ошибка удаления приза:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Получить все розыгрыши
   */
  async getAllGiveaways(req, res) {
    try {
      const { page = 1, limit = 20, status, type } = req.query;
      const skip = (page - 1) * limit;

      const filter = {};
      if (status) filter.status = status;
      if (type) filter.type = type;

      const giveaways = await Giveaway.find(filter)
        .populate('prize')
        .populate('createdBy', 'firstName lastName username')
        .populate('winners.user', 'firstName lastName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Giveaway.countDocuments(filter);

      res.json({
        success: true,
        data: {
          giveaways,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Ошибка получения розыгрышей:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Создать розыгрыш
   */
  async createGiveaway(req, res) {
    try {
      const { 
        title, 
        type, 
        prizeId, 
        winnersCount, 
        startDate, 
        endDate, 
        drawDate,
        requiresDeposit = true,
        depositTimeframe = 'same_day'
      } = req.body;
      const adminId = req.user.id;

      // Валидация обязательных полей
      if (!title || !type || !prizeId || !winnersCount || !startDate || !endDate || !drawDate) {
        return res.status(400).json({
          success: false,
          message: 'Все обязательные поля должны быть заполнены'
        });
      }

      // Проверка существования приза
      const prize = await GiveawayPrize.findById(prizeId);
      if (!prize) {
        return res.status(404).json({
          success: false,
          message: 'Приз не найден'
        });
      }

      // Валидация дат
      const start = new Date(startDate);
      const end = new Date(endDate);
      const draw = new Date(drawDate);

      if (start >= end || end >= draw) {
        return res.status(400).json({
          success: false,
          message: 'Некорректные даты: дата начала < дата окончания < дата розыгрыша'
        });
      }

      const giveaway = new Giveaway({
        title,
        type,
        prize: prizeId,
        winnersCount: parseInt(winnersCount),
        startDate: start,
        endDate: end,
        drawDate: draw,
        requiresDeposit,
        depositTimeframe,
        createdBy: adminId
      });

      await giveaway.save();

      const populatedGiveaway = await Giveaway.findById(giveaway._id)
        .populate('prize')
        .populate('createdBy', 'firstName lastName username');

      res.status(201).json({
        success: true,
        message: 'Розыгрыш успешно создан',
        data: populatedGiveaway
      });

    } catch (error) {
      console.error('Ошибка создания розыгрыша:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Обновить розыгрыш
   */
  async updateGiveaway(req, res) {
    try {
      const { giveawayId } = req.params;
      const updateData = req.body;

      const giveaway = await Giveaway.findById(giveawayId);
      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      // Запрещаем изменение завершенных розыгрышей
      if (giveaway.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Нельзя изменять завершенные розыгрыши'
        });
      }

      const updatedGiveaway = await Giveaway.findByIdAndUpdate(
        giveawayId,
        updateData,
        { new: true }
      )
      .populate('prize')
      .populate('createdBy', 'firstName lastName username')
      .populate('winners.user', 'firstName lastName username');

      res.json({
        success: true,
        message: 'Розыгрыш успешно обновлен',
        data: updatedGiveaway
      });

    } catch (error) {
      console.error('Ошибка обновления розыгрыша:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Активировать розыгрыш
   */
  async activateGiveaway(req, res) {
    try {
      const { giveawayId } = req.params;

      const giveaway = await Giveaway.findById(giveawayId);
      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      if (giveaway.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Можно активировать только ожидающие розыгрыши'
        });
      }

      giveaway.status = 'active';
      await giveaway.save();

      const populatedGiveaway = await Giveaway.findById(giveaway._id)
        .populate('prize')
        .populate('createdBy', 'firstName lastName username');

      res.json({
        success: true,
        message: 'Розыгрыш активирован',
        data: populatedGiveaway
      });

    } catch (error) {
      console.error('Ошибка активации розыгрыша:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Отменить розыгрыш
   */
  async cancelGiveaway(req, res) {
    try {
      const { giveawayId } = req.params;

      const giveaway = await Giveaway.findById(giveawayId);
      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      if (!['pending', 'active'].includes(giveaway.status)) {
        return res.status(400).json({
          success: false,
          message: 'Можно отменить только ожидающие или активные розыгрыши'
        });
      }

      giveaway.status = 'cancelled';
      await giveaway.save();

      res.json({
        success: true,
        message: 'Розыгрыш отменен'
      });

    } catch (error) {
      console.error('Ошибка отмены розыгрыша:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Получить участников розыгрыша
   */
  async getGiveawayParticipants(req, res) {
    try {
      const { giveawayId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      const participants = await GiveawayParticipation.find({
        giveaway: giveawayId
      })
      .populate('user', 'firstName lastName username telegramId')
      .populate('deposit', 'amount createdAt')
      .sort({ participationNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

      const total = await GiveawayParticipation.countDocuments({
        giveaway: giveawayId
      });

      res.json({
        success: true,
        data: {
          participants,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Ошибка получения участников:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Провести розыгрыш вручную
   */
  async conductGiveaway(req, res) {
    try {
      const { giveawayId } = req.params;
      const { useCustomSeed } = req.body;

      const giveaway = await Giveaway.findById(giveawayId)
        .populate('prize');

      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      if (giveaway.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Можно проводить только активные розыгрыши'
        });
      }

      // Получаем всех участников
      const participants = await GiveawayParticipation.find({
        giveaway: giveawayId
      }).populate('user', 'firstName lastName username telegramId');

      if (participants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Нет участников для розыгрыша'
        });
      }

      if (participants.length < giveaway.winnersCount) {
        return res.status(400).json({
          success: false,
          message: `Недостаточно участников. Нужно: ${giveaway.winnersCount}, есть: ${participants.length}`
        });
      }

      // Генерируем случайные числа для выбора победителей
      const seed = useCustomSeed || crypto.randomBytes(32).toString('hex');
      const winners = [];
      const usedIndices = new Set();

      for (let i = 0; i < giveaway.winnersCount; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * participants.length);
        } while (usedIndices.has(randomIndex));
        
        usedIndices.add(randomIndex);
        const winner = participants[randomIndex];
        
        winners.push({
          user: winner.user._id,
          position: i + 1,
          selectedAt: new Date()
        });

        // Обновляем участие как выигрышное
        await GiveawayParticipation.findByIdAndUpdate(winner._id, {
          isWinner: true,
          winnerPosition: i + 1,
          status: 'winner'
        });
      }

      // Обновляем розыгрыш
      giveaway.winners = winners;
      giveaway.status = 'completed';
      giveaway.diceResult = {
        value: Math.floor(Math.random() * 6) + 1,
        timestamp: new Date()
      };
      
      await giveaway.save();

      // Обновляем статус участников, которые не выиграли
      await GiveawayParticipation.updateMany(
        { 
          giveaway: giveawayId, 
          isWinner: false 
        },
        { status: 'not_winner' }
      );

      const populatedGiveaway = await Giveaway.findById(giveaway._id)
        .populate('prize')
        .populate('winners.user', 'firstName lastName username telegramId');

      res.json({
        success: true,
        message: 'Розыгрыш успешно проведен',
        data: {
          giveaway: populatedGiveaway,
          winnersInfo: winners.map((winner, index) => ({
            position: winner.position,
            user: participants.find(p => p.user._id.toString() === winner.user.toString()).user,
            participationNumber: participants.find(p => p.user._id.toString() === winner.user.toString()).participationNumber
          }))
        }
      });

    } catch (error) {
      console.error('Ошибка проведения розыгрыша:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Получить статистику розыгрышей
   */
  async getGiveawayStats(req, res) {
    try {
      const stats = await Promise.all([
        // Общая статистика
        Giveaway.countDocuments(),
        Giveaway.countDocuments({ status: 'active' }),
        Giveaway.countDocuments({ status: 'completed' }),
        Giveaway.countDocuments({ status: 'pending' }),
        GiveawayParticipation.countDocuments(),
        GiveawayPrize.countDocuments(),
        
        // Статистика по типам розыгрышей
        Giveaway.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        
        // Статистика участия по дням (последние 7 дней)
        GiveawayParticipation.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id': 1 } }
        ])
      ]);

      const [
        totalGiveaways,
        activeGiveaways,
        completedGiveaways,
        pendingGiveaways,
        totalParticipations,
        totalPrizes,
        giveawaysByType,
        participationsByDay
      ] = stats;

      res.json({
        success: true,
        data: {
          overview: {
            totalGiveaways,
            activeGiveaways,
            completedGiveaways,
            pendingGiveaways,
            totalParticipations,
            totalPrizes
          },
          giveawaysByType,
          participationsByDay
        }
      });

    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }
}

module.exports = new AdminGiveawayController();