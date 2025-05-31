// backend/src/services/odds.service.js
const { User, GameSettings } = require('../models');

/**
 * Сервис для управления шансами и вероятностями в играх
 */
class OddsService {
  /**
   * Базовые шансы выигрыша для каждой игры
   */
  static BASE_WIN_CHANCES = {
    coin: 0.475, // 47.5% - базовый шанс для монетки (с учетом house edge)
  };

  /**
   * Базовые параметры RTP для слотов
   */
  static SLOTS_BASE_RTP = 0.90; // 90% RTP - более справедливый базовый RTP

  /**
   * Получить шанс выигрыша для конкретного пользователя в конкретной игре
   * @param {Object} user - Объект пользователя из БД
   * @param {string} gameType - Тип игры ('coin', 'slots', и т.д.)
   * @returns {number} - Шанс выигрыша от 0 до 1
   */
  async getUserWinChance(user, gameType) {
    try {
      // Получаем базовый шанс для игры
      const baseChance = OddsService.BASE_WIN_CHANCES[gameType];
      
      if (!baseChance) {
        throw new Error(`Неизвестный тип игры: ${gameType}`);
      }

      // Получаем глобальные настройки
      const gameSettings = await GameSettings.getSettings();
      let modifier = 0;
      
      // Определяем какой модификатор использовать
      if (gameSettings.modifierMode === 'global' || 
          (gameSettings.modifierMode === 'mixed' && gameSettings.globalModifiers[gameType]?.enabled)) {
        // Используем глобальный модификатор
        modifier = gameSettings.globalModifiers[gameType]?.winChanceModifier || 0;
        console.log(`ODDS: Используется глобальный модификатор для ${gameType}: ${modifier}%`);
      } else {
        // Используем персональный модификатор
        if (user.gameSettings && user.gameSettings[gameType]) {
          modifier = user.gameSettings[gameType].winChanceModifier || 0;
        }
      }

      // Применяем модификатор (в процентных пунктах)
      const finalChance = baseChance + (modifier / 100);

      // Проверяем границы (от 0 до 1)
      const clampedChance = Math.max(0, Math.min(1, finalChance));

      console.log(`ODDS: Пользователь ${user.username || user.telegramId} - ${gameType}:`,
        `базовый шанс=${baseChance}`,
        `модификатор=${modifier}%`,
        `режим=${gameSettings.modifierMode}`,
        `итоговый шанс=${clampedChance}`
      );

      return clampedChance;
    } catch (error) {
      console.error('ODDS: Ошибка расчета шанса:', error);
      // В случае ошибки возвращаем базовый шанс
      return OddsService.BASE_WIN_CHANCES[gameType] || 0.5;
    }
  }

  /**
   * Получить модифицированный RTP для слотов
   * @param {Object} user - Объект пользователя
   * @returns {number} - Модифицированный RTP
   */
  async getSlotsRTP(user) {
    try {
      // Получаем глобальные настройки
      const gameSettings = await GameSettings.getSettings();
      let rtpModifier = 0;
      
      // Определяем какой модификатор использовать
      if (gameSettings.modifierMode === 'global' || 
          (gameSettings.modifierMode === 'mixed' && gameSettings.globalModifiers.slots?.enabled)) {
        // Используем глобальный модификатор
        rtpModifier = gameSettings.globalModifiers.slots?.rtpModifier || 0;
        console.log(`ODDS: Используется глобальный RTP модификатор для слотов: ${rtpModifier}%`);
      } else {
        // Используем персональный модификатор
        if (user.gameSettings?.slots?.rtpModifier) {
          rtpModifier = user.gameSettings.slots.rtpModifier;
        }
      }

      const modifiedRTP = OddsService.SLOTS_BASE_RTP * (1 + rtpModifier / 100);
      const clampedRTP = Math.max(0.5, Math.min(1.2, modifiedRTP));

      console.log(`ODDS: Слоты RTP для ${user.username || user.telegramId}:`,
        `базовый=${OddsService.SLOTS_BASE_RTP}`,
        `модификатор=${rtpModifier}%`,
        `режим=${gameSettings.modifierMode}`,
        `итоговый=${clampedRTP}`
      );

      return clampedRTP;
    } catch (error) {
      console.error('ODDS: Ошибка расчета RTP:', error);
      return OddsService.SLOTS_BASE_RTP;
    }
  }

  /**
   * Проверить, должен ли слот выиграть на основе RTP
   * Правильная логика: RTP влияет на частоту выигрышей, но не напрямую
   * @param {Object} user - Объект пользователя
   * @returns {boolean} - true если должен выиграть
   */
  async shouldSlotsWin(user) {
    const rtp = await this.getSlotsRTP(user);
    
    // Преобразуем RTP в шанс выигрыша
    // Базовый шанс выигрыша в слотах должен быть около 20-25%
    // RTP влияет на размер выигрышей, а не только на частоту
    const baseWinChance = 0.22; // 22% базовый шанс выигрыша
    
    // RTP модифицирует шанс выигрыша:
    // При RTP 90% = базовый шанс
    // При RTP выше/ниже - корректируем шанс
    const rtpFactor = rtp / OddsService.SLOTS_BASE_RTP; // например, 0.95/0.90 = 1.056
    const adjustedWinChance = baseWinChance * rtpFactor;
    
    // Ограничиваем шанс разумными пределами (12% - 35%)
    const finalWinChance = Math.max(0.12, Math.min(0.35, adjustedWinChance));
    
    console.log(`ODDS: Шанс выигрыша в слотах для ${user.username || user.telegramId}: ${(finalWinChance * 100).toFixed(1)}% (RTP: ${(rtp * 100).toFixed(1)}%)`);
    
    return Math.random() < finalWinChance;
  }

  /**
   * Получить модификатор для количества мин
   * @param {Object} user - Объект пользователя
   * @param {number} baseMinesCount - Базовое количество мин
   * @returns {number} - Модифицированное количество мин
   */
  async getModifiedMinesCount(user, baseMinesCount) {
    try {
      // Получаем глобальные настройки
      const gameSettings = await GameSettings.getSettings();
      let modifier = 0;
      
      // Определяем какой модификатор использовать
      if (gameSettings.modifierMode === 'global' || 
          (gameSettings.modifierMode === 'mixed' && gameSettings.globalModifiers.mines?.enabled)) {
        // Используем глобальный модификатор
        modifier = gameSettings.globalModifiers.mines?.mineChanceModifier || 0;
        console.log(`ODDS: Используется глобальный модификатор мин: ${modifier}%`);
      } else {
        // Используем персональный модификатор
        if (user.gameSettings?.mines?.mineChanceModifier) {
          modifier = user.gameSettings.mines.mineChanceModifier;
        }
      }

      // Применяем модификатор как процент от базового количества
      const modifiedCount = Math.round(baseMinesCount * (1 + modifier / 100));
      
      // Ограничиваем количество мин разумными пределами
      const clampedCount = Math.max(1, Math.min(24, modifiedCount));

      console.log(`ODDS: Мины для ${user.username || user.telegramId}:`,
        `базовое количество=${baseMinesCount}`,
        `модификатор=${modifier}%`,
        `режим=${gameSettings.modifierMode}`,
        `итоговое количество=${clampedCount}`
      );

      return clampedCount;
    } catch (error) {
      console.error('ODDS: Ошибка модификации мин:', error);
      return baseMinesCount;
    }
  }

  /**
   * Получить модификатор краша
   * @param {Object} user - Объект пользователя
   * @returns {number} - Модификатор вероятности раннего краша
   */
  async getCrashModifier(user) {
    try {
      let modifier = 0;
      
      if (user.gameSettings?.crash?.crashModifier) {
        modifier = user.gameSettings.crash.crashModifier;
      }

      console.log(`ODDS: Краш модификатор для ${user.username || user.telegramId}: ${modifier}%`);

      return modifier;
    } catch (error) {
      console.error('ODDS: Ошибка получения краш модификатора:', error);
      return 0;
    }
  }

  /**
   * Установить модификатор для пользователя
   * @param {string} userId - ID пользователя
   * @param {string} gameType - Тип игры
   * @param {string} modifierType - Тип модификатора
   * @param {number} value - Значение модификатора
   * @returns {Object} - Обновленный пользователь
   */
  async setUserGameModifier(userId, gameType, modifierType, value) {
    try {
      // Валидация
      const validGameTypes = ['coin', 'slots', 'mines', 'crash'];
      if (!validGameTypes.includes(gameType)) {
        throw new Error('Неверный тип игры');
      }

      // Определяем путь обновления
      let updatePath;
      switch (gameType) {
        case 'coin':
          updatePath = 'gameSettings.coin.winChanceModifier';
          break;
        case 'slots':
          updatePath = 'gameSettings.slots.rtpModifier';
          break;
        case 'mines':
          updatePath = 'gameSettings.mines.mineChanceModifier';
          break;
        case 'crash':
          updatePath = 'gameSettings.crash.crashModifier';
          break;
      }
      
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { [updatePath]: value } },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      console.log(`ODDS: Установлен модификатор для пользователя ${user.username || user.telegramId}:`,
        `${gameType}.${modifierType} = ${value}%`
      );

      return user;
    } catch (error) {
      console.error('ODDS: Ошибка установки модификатора:', error);
      throw error;
    }
  }

  /**
   * Получить статистику по шансам всех пользователей
   * @returns {Object} - Статистика
   */
  async getOddsStatistics() {
    try {
      const users = await User.find({});
      
      const stats = {
        totalUsers: users.length,
        modifiedUsers: 0,
        gameStats: {
          coin: { modified: 0, avgModifier: 0, minModifier: 0, maxModifier: 0 },
          slots: { modified: 0, avgModifier: 0, minModifier: 0, maxModifier: 0 },
          mines: { modified: 0, avgModifier: 0, minModifier: 0, maxModifier: 0 },
          crash: { modified: 0, avgModifier: 0, minModifier: 0, maxModifier: 0 }
        }
      };

      users.forEach(user => {
        let hasModifications = false;

        // Проверяем каждую игру
        ['coin', 'slots', 'mines', 'crash'].forEach(gameType => {
          let modifier = 0;
          
          switch (gameType) {
            case 'coin':
              modifier = user.gameSettings?.coin?.winChanceModifier || 0;
              break;
            case 'slots':
              modifier = user.gameSettings?.slots?.rtpModifier || 0;
              break;
            case 'mines':
              modifier = user.gameSettings?.mines?.mineChanceModifier || 0;
              break;
            case 'crash':
              modifier = user.gameSettings?.crash?.crashModifier || 0;
              break;
          }

          if (modifier !== 0) {
            hasModifications = true;
            stats.gameStats[gameType].modified++;
            stats.gameStats[gameType].avgModifier += modifier;
            stats.gameStats[gameType].minModifier = Math.min(stats.gameStats[gameType].minModifier, modifier);
            stats.gameStats[gameType].maxModifier = Math.max(stats.gameStats[gameType].maxModifier, modifier);
          }
        });

        if (hasModifications) {
          stats.modifiedUsers++;
        }
      });

      // Вычисляем средние значения
      Object.keys(stats.gameStats).forEach(gameType => {
        if (stats.gameStats[gameType].modified > 0) {
          stats.gameStats[gameType].avgModifier /= stats.gameStats[gameType].modified;
        }
      });

      return stats;
    } catch (error) {
      console.error('ODDS: Ошибка получения статистики:', error);
      throw error;
    }
  }

  /**
   * Сбросить все модификаторы для пользователя
   * @param {string} userId - ID пользователя
   * @returns {Object} - Обновленный пользователь
   */
  async resetUserModifiers(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            'gameSettings.coin.winChanceModifier': 0,
            'gameSettings.slots.rtpModifier': 0,
            'gameSettings.mines.mineChanceModifier': 0,
            'gameSettings.crash.crashModifier': 0
          }
        },
        { new: true }
      );

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      console.log(`ODDS: Сброшены все модификаторы для пользователя ${user.username || user.telegramId}`);

      return user;
    } catch (error) {
      console.error('ODDS: Ошибка сброса модификаторов:', error);
      throw error;
    }
  }
}

module.exports = new OddsService();