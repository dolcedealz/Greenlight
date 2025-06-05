// backend/src/utils/game-validation.js
/**
 * Унифицированная валидация игровых результатов для дуэлей
 */

class GameValidation {
  constructor() {
    // Определяем правила для каждого типа игры
    this.gameRules = {
      '🎲': {
        name: 'Кости',
        minResult: 1,
        maxResult: 6,
        description: 'Результат броска кости (1-6)'
      },
      '🎯': {
        name: 'Дартс',
        minResult: 1,
        maxResult: 6,
        description: 'Результат броска дротика (1-6)'
      },
      '⚽': {
        name: 'Футбол',
        minResult: 1,
        maxResult: 5,
        description: 'Результат футбольного мяча (1-5)'
      },
      '🏀': {
        name: 'Баскетбол',
        minResult: 1,
        maxResult: 5,
        description: 'Результат баскетбольного мяча (1-5)'
      },
      '🎳': {
        name: 'Боулинг',
        minResult: 0,
        maxResult: 10,
        description: 'Результат боулинга (0-10 кеглей)'
      },
      '🎰': {
        name: 'Слоты',
        minResult: 1,
        maxResult: 64,
        description: 'Результат слота (1-64)'
      }
    };

    // Допустимые типы игр
    this.validGameTypes = Object.keys(this.gameRules);
    
    // Допустимые форматы дуэлей
    this.validFormats = ['bo1', 'bo3', 'bo5', 'bo7'];
  }

  /**
   * Валидирует тип игры
   * @param {string} gameType - Тип игры (эмодзи)
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateGameType(gameType) {
    if (!gameType) {
      return {
        isValid: false,
        error: 'Тип игры не указан'
      };
    }

    if (!this.validGameTypes.includes(gameType)) {
      return {
        isValid: false,
        error: `Неподдерживаемый тип игры: ${gameType}. Доступные: ${this.validGameTypes.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Валидирует результат игры
   * @param {string} gameType - Тип игры
   * @param {number} result - Результат игры
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateGameResult(gameType, result) {
    // Сначала проверяем тип игры
    const gameTypeValidation = this.validateGameType(gameType);
    if (!gameTypeValidation.isValid) {
      return gameTypeValidation;
    }

    // Проверяем что result это число
    if (typeof result !== 'number' || isNaN(result)) {
      return {
        isValid: false,
        error: 'Результат должен быть числом'
      };
    }

    // Проверяем что result целое число
    if (!Number.isInteger(result)) {
      return {
        isValid: false,
        error: 'Результат должен быть целым числом'
      };
    }

    const rules = this.gameRules[gameType];
    
    // Проверяем диапазон
    if (result < rules.minResult || result > rules.maxResult) {
      return {
        isValid: false,
        error: `Результат для ${rules.name} должен быть от ${rules.minResult} до ${rules.maxResult}`
      };
    }

    return { isValid: true };
  }

  /**
   * Валидирует формат дуэли
   * @param {string} format - Формат дуэли
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateFormat(format) {
    if (!format) {
      return {
        isValid: false,
        error: 'Формат дуэли не указан'
      };
    }

    if (!this.validFormats.includes(format)) {
      return {
        isValid: false,
        error: `Неподдерживаемый формат: ${format}. Доступные: ${this.validFormats.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Валидирует сумму ставки
   * @param {number} amount - Сумма ставки
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        isValid: false,
        error: 'Сумма ставки должна быть числом'
      };
    }

    if (amount < 1) {
      return {
        isValid: false,
        error: 'Минимальная ставка: 1 USDT'
      };
    }

    if (amount > 1000) {
      return {
        isValid: false,
        error: 'Максимальная ставка: 1000 USDT'
      };
    }

    // Проверяем что сумма имеет не более 2 знаков после запятой
    if (Number(amount.toFixed(2)) !== amount) {
      return {
        isValid: false,
        error: 'Сумма ставки должна иметь не более 2 знаков после запятой'
      };
    }

    return { isValid: true };
  }

  /**
   * Валидирует username
   * @param {string} username - Username пользователя
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateUsername(username) {
    if (!username) {
      return {
        isValid: false,
        error: 'Username не указан'
      };
    }

    if (typeof username !== 'string') {
      return {
        isValid: false,
        error: 'Username должен быть строкой'
      };
    }

    // Убираем символ @ если он есть
    const cleanUsername = username.replace('@', '');

    if (cleanUsername.length < 5) {
      return {
        isValid: false,
        error: 'Username должен содержать минимум 5 символов'
      };
    }

    if (cleanUsername.length > 32) {
      return {
        isValid: false,
        error: 'Username должен содержать максимум 32 символа'
      };
    }

    // Проверяем что username содержит только допустимые символы
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(cleanUsername)) {
      return {
        isValid: false,
        error: 'Username может содержать только буквы, цифры и подчеркивания'
      };
    }

    return { isValid: true };
  }

  /**
   * Валидирует ID сессии дуэли
   * @param {string} sessionId - ID сессии
   * @returns {Object} - { isValid: boolean, error?: string }
   */
  validateSessionId(sessionId) {
    if (!sessionId) {
      return {
        isValid: false,
        error: 'ID сессии не указан'
      };
    }

    if (typeof sessionId !== 'string') {
      return {
        isValid: false,
        error: 'ID сессии должен быть строкой'
      };
    }

    if (sessionId.length < 10) {
      return {
        isValid: false,
        error: 'ID сессии слишком короткий'
      };
    }

    return { isValid: true };
  }

  /**
   * Комплексная валидация создания дуэли
   * @param {Object} duelData - Данные дуэли
   * @returns {Object} - { isValid: boolean, errors: Array }
   */
  validateDuelCreation(duelData) {
    const errors = [];

    // Валидируем все поля
    const validations = [
      { name: 'gameType', validator: () => this.validateGameType(duelData.gameType) },
      { name: 'format', validator: () => this.validateFormat(duelData.format) },
      { name: 'amount', validator: () => this.validateAmount(duelData.amount) }
    ];

    // Добавляем валидацию username если указан
    if (duelData.targetUsername || duelData.opponentUsername) {
      const username = duelData.targetUsername || duelData.opponentUsername;
      validations.push({ 
        name: 'username', 
        validator: () => this.validateUsername(username) 
      });
    }

    // Проверяем все валидации
    for (const validation of validations) {
      const result = validation.validator();
      if (!result.isValid) {
        errors.push(`${validation.name}: ${result.error}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Валидация хода в дуэли
   * @param {Object} moveData - Данные хода
   * @returns {Object} - { isValid: boolean, errors: Array }
   */
  validateMove(moveData) {
    const errors = [];

    // Валидируем sessionId
    const sessionValidation = this.validateSessionId(moveData.sessionId);
    if (!sessionValidation.isValid) {
      errors.push(`sessionId: ${sessionValidation.error}`);
    }

    // Валидируем результат если указан gameType
    if (moveData.gameType && moveData.result !== undefined) {
      const resultValidation = this.validateGameResult(moveData.gameType, moveData.result);
      if (!resultValidation.isValid) {
        errors.push(`result: ${resultValidation.error}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Получает правила для типа игры
   * @param {string} gameType - Тип игры
   * @returns {Object|null} - Правила игры или null
   */
  getGameRules(gameType) {
    return this.gameRules[gameType] || null;
  }

  /**
   * Получает список всех доступных игр
   * @returns {Array} - Массив типов игр с описанием
   */
  getAllGames() {
    return Object.entries(this.gameRules).map(([type, rules]) => ({
      type,
      name: rules.name,
      description: rules.description,
      minResult: rules.minResult,
      maxResult: rules.maxResult
    }));
  }

  /**
   * Определяет победителя раунда
   * @param {string} gameType - Тип игры
   * @param {number} result1 - Результат первого игрока
   * @param {number} result2 - Результат второго игрока
   * @returns {string} - 'player1', 'player2' или 'draw'
   */
  determineWinner(gameType, result1, result2) {
    // Валидируем результаты
    const validation1 = this.validateGameResult(gameType, result1);
    const validation2 = this.validateGameResult(gameType, result2);
    
    if (!validation1.isValid || !validation2.isValid) {
      throw new Error('Некорректные результаты для определения победителя');
    }

    if (result1 > result2) {
      return 'player1';
    } else if (result2 > result1) {
      return 'player2';
    } else {
      return 'draw';
    }
  }
}

// Singleton instance
const gameValidation = new GameValidation();

module.exports = gameValidation;