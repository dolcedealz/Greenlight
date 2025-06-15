// backend/src/controllers/giveaway.controller.js
const { 
  Giveaway, 
  GiveawayPrize, 
  GiveawayParticipation, 
  User, 
  Deposit 
} = require('../models');

class GiveawayController {
  /**
   * Получить активные розыгрыши
   */
  async getActiveGiveaways(req, res) {
    try {
      const now = new Date();
      
      const activeGiveaways = await Giveaway.find({
        status: 'active',
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
      .populate('prize')
      .sort({ drawDate: 1 });

      const giveawaysWithStats = await Promise.all(
        activeGiveaways.map(async (giveaway) => {
          const participationCount = await GiveawayParticipation.countDocuments({
            giveaway: giveaway._id
          });

          return {
            ...giveaway.toObject(),
            participationCount
          };
        })
      );

      res.json({
        success: true,
        data: giveawaysWithStats
      });
    } catch (error) {
      console.error('Ошибка получения активных розыгрышей:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Участие в розыгрыше
   */
  async participateInGiveaway(req, res) {
    try {
      const { giveawayId } = req.params;
      const userId = req.user.id;

      // Проверяем существование розыгрыша
      const giveaway = await Giveaway.findById(giveawayId);
      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      // Проверяем статус розыгрыша
      if (giveaway.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Розыгрыш неактивен'
        });
      }

      // Проверяем время участия
      const now = new Date();
      if (now < giveaway.startDate || now > giveaway.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Время участия в розыгрыше истекло'
        });
      }

      // Проверяем, не участвует ли уже пользователь
      const existingParticipation = await GiveawayParticipation.findOne({
        giveaway: giveawayId,
        user: userId
      });

      if (existingParticipation) {
        return res.status(400).json({
          success: false,
          message: 'Вы уже участвуете в этом розыгрыше'
        });
      }

      // Проверяем депозит в зависимости от типа розыгрыша
      let validDeposit;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (giveaway.type === 'daily') {
        // Для ежедневного розыгрыша нужен депозит сегодня
        console.log(`🔍 Поиск депозита для пользователя ${userId} с ${today.toISOString()} до ${tomorrow.toISOString()}`);
        console.log(`💵 Минимальная сумма депозита: ${giveaway.minDepositAmount || 1} USDT`);
        
        // Сначала проверим все депозиты без фильтра суммы
        const allTodayDeposits = await Deposit.find({
          user: userId,
          status: 'completed',
          createdAt: {
            $gte: today,
            $lt: tomorrow
          }
        }).sort({ createdAt: -1 });
        
        console.log(`📅 Все депозиты сегодня:`, allTodayDeposits.map(d => `${d.amount} USDT (${d.createdAt})`));
        
        validDeposit = await Deposit.findOne({
          user: userId,
          status: 'completed',
          amount: { $gte: giveaway.minDepositAmount || 1 },
          createdAt: {
            $gte: today,
            $lt: tomorrow
          }
        }).sort({ createdAt: -1 });
        
        console.log(`💰 Найден подходящий депозит:`, validDeposit ? `${validDeposit.amount} USDT в ${validDeposit.createdAt}` : 'НЕТ');
      } else if (giveaway.type === 'weekly') {
        // Для недельного розыгрыша нужен депозит за текущую неделю
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        validDeposit = await Deposit.findOne({
          user: userId,
          status: 'completed',
          amount: { $gte: giveaway.minDepositAmount || 1 },
          createdAt: {
            $gte: startOfWeek
          }
        }).sort({ createdAt: -1 });
      }

      if (!validDeposit) {
        const minAmount = giveaway.minDepositAmount || 1;
        return res.status(400).json({
          success: false,
          message: giveaway.type === 'daily' 
            ? `Для участия необходимо сделать депозит от ${minAmount} USDT сегодня`
            : `Для участия необходимо сделать депозит от ${minAmount} USDT на этой неделе`
        });
      }

      // Получаем следующий номер участника
      const participationNumber = await GiveawayParticipation.countDocuments({
        giveaway: giveawayId
      }) + 1;

      // Создаем участие
      const participation = new GiveawayParticipation({
        giveaway: giveawayId,
        user: userId,
        deposit: validDeposit._id,
        depositAmount: validDeposit.amount,
        depositDate: validDeposit.createdAt,
        participationNumber
      });

      await participation.save();

      // Обновляем счетчик участников в розыгрыше
      await Giveaway.findByIdAndUpdate(giveawayId, {
        $inc: { participationCount: 1 }
      });

      res.json({
        success: true,
        message: 'Вы успешно зарегистрированы в розыгрыше!',
        data: {
          participationNumber,
          depositAmount: validDeposit.amount
        }
      });

    } catch (error) {
      console.error('Ошибка участия в розыгрыше:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Получить историю участия пользователя
   */
  async getUserParticipationHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const participations = await GiveawayParticipation.find({
        user: userId
      })
      .populate({
        path: 'giveaway',
        populate: {
          path: 'prize'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

      const total = await GiveawayParticipation.countDocuments({
        user: userId
      });

      res.json({
        success: true,
        data: {
          participations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Ошибка получения истории участия:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }

  /**
   * Проверить статус участия пользователя в розыгрыше
   */
  async checkUserParticipation(req, res) {
    try {
      const { giveawayId } = req.params;
      const userId = req.user.id;

      const giveaway = await Giveaway.findById(giveawayId);
      if (!giveaway) {
        return res.status(404).json({
          success: false,
          message: 'Розыгрыш не найден'
        });
      }

      const participation = await GiveawayParticipation.findOne({
        giveaway: giveawayId,
        user: userId
      });

      // Проверяем депозит для возможности участия
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayDeposit = await Deposit.findOne({
        user: userId,
        status: 'completed',
        amount: { $gte: giveaway.minDepositAmount || 1 },
        createdAt: {
          $gte: today,
          $lt: tomorrow
        }
      });

      // Дополнительная диагностика - все депозиты пользователя
      const allUserDeposits = await Deposit.find({
        user: userId,
        status: 'completed'
      }).sort({ createdAt: -1 }).limit(5);

      console.log(`👤 Проверка участия пользователя ${userId}:`);
      console.log(`📅 Период: с ${today.toISOString()} до ${tomorrow.toISOString()}`);
      console.log(`💵 Минимальная сумма: ${giveaway.minDepositAmount || 1} USDT`);
      console.log(`💰 Депозит сегодня:`, todayDeposit ? `${todayDeposit.amount} USDT в ${todayDeposit.createdAt}` : 'НЕТ');
      console.log(`🎯 Уже участвует:`, !!participation);
      console.log(`📊 Последние депозиты пользователя:`, allUserDeposits.map(d => `${d.amount} USDT (${d.createdAt}) [${d.status}]`));

      res.json({
        success: true,
        data: {
          isParticipating: !!participation,
          hasTodayDeposit: !!todayDeposit,
          participation: participation || null
        }
      });

    } catch (error) {
      console.error('Ошибка проверки участия:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
  }
}

module.exports = new GiveawayController();