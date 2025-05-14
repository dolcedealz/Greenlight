// odds.service.js
const { User } = require('../models');

class OddsService {
  constructor() {
    // Базовые настройки
    this.gameSettings = {
      coin: {
        baseWinChance: 0.475, // 47.5% базовый шанс на выигрыш для игрока
        multiplier: 2.0 // множитель x2
      }
    };
  }

  /**
   * Получает шанс выигрыша для указанного пользователя
   * @param {string|ObjectId} userId - ID пользователя или объект пользователя
   * @param {string} gameType - Тип игры ('coin', 'mines', etc.)
   * @returns {number} - Шанс выигрыша (0-1)
   */
  async getUserWinChance(userId, gameType = 'coin') {
    // Если передан объект пользователя
    if (typeof userId === 'object' && userId !== null) {
      const user = userId;
      
      // Проверяем есть ли персональный модификатор
      if (user.gameSettings && 
          user.gameSettings[gameType] && 
          user.gameSettings[gameType].winChanceModifier !== undefined) {
        
        // Применяем модификатор (конвертируем из процентных пунктов в десятичные)
        return this.gameSettings[gameType].baseWinChance + 
               (user.gameSettings[gameType].winChanceModifier / 100);
      }
      
      return this.gameSettings[gameType].baseWinChance;
    }
    
    // Если передан ID пользователя
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return this.gameSettings[gameType].baseWinChance;
      }
      
      if (user.gameSettings && 
          user.gameSettings[gameType] && 
          user.gameSettings[gameType].winChanceModifier !== undefined) {
        
        return this.gameSettings[gameType].baseWinChance + 
               (user.gameSettings[gameType].winChanceModifier / 100);
      }
      
      return this.gameSettings[gameType].baseWinChance;
    } catch (error) {
      console.error('Ошибка при получении шанса выигрыша:', error);
      return this.gameSettings[gameType].baseWinChance;
    }
  }

  /**
   * Устанавливает базовый шанс выигрыша для игры
   * @param {string} gameType - Тип игры
   * @param {number} winChance - Базовый шанс выигрыша (0-1)
   */
  setBaseWinChance(gameType, winChance) {
    if (!this.gameSettings[gameType]) {
      this.gameSettings[gameType] = {};
    }
    
    this.gameSettings[gameType].baseWinChance = winChance;
    console.log(`Базовый шанс выигрыша для ${gameType} установлен на ${winChance * 100}%`);
  }

  /**
   * Устанавливает персональный модификатор шанса выигрыша для пользователя
   * @param {string} userId - ID пользователя
   * @param {string} gameType - Тип игры
   * @param {number} modifierPercent - Модификатор в процентных пунктах (+/-)
   */
  async setUserWinChanceModifier(userId, gameType, modifierPercent) {
    try {
      // Ограничиваем модификатор, чтобы шанс оставался в пределах 0-100%
      let safeModifier = modifierPercent;
      
      // Не позволяем уменьшить шанс ниже 0%
      if (modifierPercent < -47.5) {
        safeModifier = -47.5;
      }
      
      // Не позволяем увеличить шанс выше 100%
      if (modifierPercent > 52.5) {
        safeModifier = 52.5;
      }
      
      // Обновляем модификатор для пользователя
      const updatePath = `gameSettings.${gameType}.winChanceModifier`;
      const updateData = { [updatePath]: safeModifier };
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      return user;
    } catch (error) {
      console.error('Ошибка при установке модификатора шанса выигрыша:', error);
      throw error;
    }
  }
}

module.exports = new OddsService();