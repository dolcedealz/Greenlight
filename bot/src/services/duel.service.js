// bot/src/services/duel.service.js
const crypto = require('crypto');

/**
 * Безопасный сервис для управления дуэлями
 */
class DuelService {
  constructor() {
    // Храним активные дуэли в памяти (в продакшене использовать Redis)
    this.activeDuels = new Map();
    this.userDuels = new Map(); // Быстрый поиск дуэлей пользователя
    
    // Настройки безопасности
    this.MAX_ACTIVE_DUELS_PER_USER = 3;
    this.DUEL_TIMEOUT = 5 * 60 * 1000; // 5 минут
    this.SUPPORTED_GAMES = ['🎲', '🎯', '⚽', '🏀', '🎰', '🎳'];
    this.SUPPORTED_FORMATS = ['bo1', 'bo3', 'bo5', 'bo7', 'bo9'];
    
    console.log('🎮 DuelService инициализирован');
  }

  /**
   * Генерирует безопасный ID для дуэли
   */
  generateDuelId() {
    return `duel_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Валидирует параметры дуэли
   */
  validateDuelParams(challengerId, opponentUsername, amount, gameType, format) {
    const errors = [];

    // Проверка ID инициатора
    if (!challengerId || typeof challengerId !== 'string') {
      errors.push('Некорректный ID инициатора');
    }

    // Проверка username оппонента
    if (!opponentUsername || typeof opponentUsername !== 'string' || opponentUsername.length < 2) {
      errors.push('Некорректный username оппонента');
    }

    // Проверка суммы
    if (!amount || isNaN(amount) || amount < 1 || amount > 1000) {
      errors.push('Сумма должна быть от 1 до 1000 USDT');
    }

    // Проверка типа игры
    if (!this.SUPPORTED_GAMES.includes(gameType)) {
      errors.push('Неподдерживаемый тип игры');
    }

    // Проверка формата
    if (!this.SUPPORTED_FORMATS.includes(format)) {
      errors.push('Неподдерживаемый формат игры');
    }

    return errors;
  }

  /**
   * Проверяет, может ли пользователь создать новую дуэль
   */
  canUserCreateDuel(userId) {
    const userDuels = this.userDuels.get(userId) || [];
    const activeDuels = userDuels.filter(duelId => {
      const duel = this.activeDuels.get(duelId);
      return duel && (duel.status === 'waiting' || duel.status === 'active');
    });

    return activeDuels.length < this.MAX_ACTIVE_DUELS_PER_USER;
  }

  /**
   * Создает новую дуэль (только структуру данных)
   */
  createDuel(challengerId, challengerUsername, opponentUsername, amount, gameType, format, type = 'private') {
    try {
      // Валидация
      const errors = this.validateDuelParams(challengerId, opponentUsername, amount, gameType, format);
      if (errors.length > 0) {
        throw new Error(`Ошибки валидации: ${errors.join(', ')}`);
      }

      // Проверка лимитов
      if (!this.canUserCreateDuel(challengerId)) {
        throw new Error('Превышен лимит активных дуэлей');
      }

      // Определяем количество раундов
      const maxRounds = this.getWinsRequired(format);
      
      // Создаем дуэль
      const duelId = this.generateDuelId();
      const duel = {
        id: duelId,
        type: type, // 'private' или 'group'
        
        players: {
          challenger: {
            id: challengerId,
            username: challengerUsername,
            ready: false,
            moves: [],
            score: 0
          },
          opponent: {
            id: null, // Заполнится при принятии
            username: opponentUsername,
            ready: false,
            moves: [],
            score: 0
          }
        },
        
        game: {
          type: gameType,
          format: format,
          currentRound: 0,
          maxRounds: maxRounds,
          status: 'waiting' // waiting, active, finished
        },
        
        messages: {
          challenger: null,
          opponent: null,
          group: null
        },
        
        settings: {
          amount: amount,
          createdAt: Date.now(),
          expiresAt: Date.now() + this.DUEL_TIMEOUT
        },
        
        status: 'waiting'
      };

      // Сохраняем дуэль
      this.activeDuels.set(duelId, duel);
      
      // Индексируем по пользователю
      const userDuels = this.userDuels.get(challengerId) || [];
      userDuels.push(duelId);
      this.userDuels.set(challengerId, userDuels);

      console.log(`✅ Дуэль создана: ${duelId}`, {
        challenger: challengerUsername,
        opponent: opponentUsername,
        amount: amount,
        type: type
      });

      return duel;
      
    } catch (error) {
      console.error('❌ Ошибка создания дуэли:', error.message);
      throw error;
    }
  }

  /**
   * Получает дуэль по ID
   */
  getDuel(duelId) {
    return this.activeDuels.get(duelId);
  }

  /**
   * Принимает дуэль
   */
  acceptDuel(duelId, opponentId, opponentUsername) {
    const duel = this.getDuel(duelId);
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }

    if (duel.status !== 'waiting') {
      throw new Error('Дуэль уже не ожидает принятия');
    }

    if (duel.players.challenger.id === opponentId) {
      throw new Error('Нельзя принять собственную дуэль');
    }

    // Проверяем лимиты оппонента
    if (!this.canUserCreateDuel(opponentId)) {
      throw new Error('У оппонента превышен лимит активных дуэлей');
    }

    // Заполняем данные оппонента
    duel.players.opponent.id = opponentId;
    duel.players.opponent.username = opponentUsername;
    duel.status = 'active';
    duel.game.status = 'active';

    // Индексируем по оппоненту
    const opponentDuels = this.userDuels.get(opponentId) || [];
    opponentDuels.push(duelId);
    this.userDuels.set(opponentId, opponentDuels);

    console.log(`✅ Дуэль принята: ${duelId}`, {
      challenger: duel.players.challenger.username,
      opponent: opponentUsername
    });

    return duel;
  }

  /**
   * Отклоняет дуэль
   */
  declineDuel(duelId, userId) {
    const duel = this.getDuel(duelId);
    
    if (!duel) {
      throw new Error('Дуэль не найдена');
    }

    if (duel.status !== 'waiting') {
      throw new Error('Дуэль уже не ожидает ответа');
    }

    // Удаляем дуэль
    this.removeDuel(duelId);

    console.log(`❌ Дуэль отклонена: ${duelId}`);
    return true;
  }

  /**
   * Удаляет дуэль из всех индексов
   */
  removeDuel(duelId) {
    const duel = this.getDuel(duelId);
    
    if (duel) {
      // Удаляем из индексов пользователей
      [duel.players.challenger.id, duel.players.opponent.id].forEach(userId => {
        if (userId) {
          const userDuels = this.userDuels.get(userId) || [];
          const filteredDuels = userDuels.filter(id => id !== duelId);
          if (filteredDuels.length > 0) {
            this.userDuels.set(userId, filteredDuels);
          } else {
            this.userDuels.delete(userId);
          }
        }
      });
    }

    // Удаляем саму дуэль
    this.activeDuels.delete(duelId);
  }

  /**
   * Получает количество побед для формата
   */
  getWinsRequired(format) {
    const formatMap = {
      'bo1': 1,
      'bo3': 2,
      'bo5': 3,
      'bo7': 4,
      'bo9': 5
    };
    return formatMap[format] || 1;
  }

  /**
   * Получает название игры
   */
  getGameName(gameType) {
    const gameNames = {
      '🎲': 'Кости',
      '🎯': 'Дартс',
      '⚽': 'Футбол',
      '🏀': 'Баскетбол',
      '🎰': 'Слоты',
      '🎳': 'Боулинг'
    };
    return gameNames[gameType] || 'Игра';
  }

  /**
   * Очистка просроченных дуэлей
   */
  cleanupExpiredDuels() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [duelId, duel] of this.activeDuels.entries()) {
      if (duel.settings.expiresAt < now && duel.status === 'waiting') {
        this.removeDuel(duelId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Очищено просроченных дуэлей: ${cleanedCount}`);
    }
  }

  /**
   * Получает статистику сервиса
   */
  getStats() {
    const totalDuels = this.activeDuels.size;
    const waitingDuels = Array.from(this.activeDuels.values()).filter(d => d.status === 'waiting').length;
    const activeDuels = Array.from(this.activeDuels.values()).filter(d => d.status === 'active').length;
    
    return {
      total: totalDuels,
      waiting: waitingDuels,
      active: activeDuels,
      users: this.userDuels.size
    };
  }
}

// Создаем singleton instance
const duelService = new DuelService();

// Автоочистка каждые 2 минуты
setInterval(() => {
  duelService.cleanupExpiredDuels();
}, 2 * 60 * 1000);

module.exports = duelService;