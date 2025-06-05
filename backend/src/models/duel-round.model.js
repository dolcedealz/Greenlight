const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DuelRound = sequelize.define('DuelRound', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Связь с дуэлью
  duelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'duels',
      key: 'id'
    },
    comment: 'ID дуэли'
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Session ID дуэли для быстрого поиска'
  },
  
  // Информация о раунде
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Номер раунда в дуэли'
  },
  
  // Результаты бросков
  challengerResult: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Результат броска инициатора (1-6 для кости, и т.д.)'
  },
  challengerTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время броска инициатора'
  },
  
  opponentResult: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Результат броска противника'
  },
  opponentTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время броска противника'
  },
  
  // Результат раунда
  winnerId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID победителя раунда (null для ничьи)'
  },
  winnerUsername: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Username победителя раунда'
  },
  isDraw: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Является ли раунд ничьей'
  },
  
  // Статус раунда
  status: {
    type: DataTypes.ENUM('waiting_challenger', 'waiting_opponent', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'waiting_challenger',
    comment: 'Статус раунда'
  },
  
  // Telegram данные
  challengerMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID сообщения с броском инициатора'
  },
  opponentMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID сообщения с броском противника'
  },
  
  // Дополнительные данные
  gameType: {
    type: DataTypes.ENUM('🎲', '🎯', '⚽', '🏀', '🎳', '🎰'),
    allowNull: false,
    comment: 'Тип игры (копируется из дуэли)'
  },
  
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Дополнительные данные раунда'
  }
}, {
  tableName: 'duel_rounds',
  timestamps: true,
  indexes: [
    { fields: ['duelId'] },
    { fields: ['sessionId'] },
    { fields: ['roundNumber'] },
    { fields: ['status'] },
    { fields: ['winnerId'] },
    { fields: ['createdAt'] },
    {
      fields: ['duelId', 'roundNumber'],
      unique: true
    }
  ]
});

// Методы модели
DuelRound.prototype.determineWinner = function(gameType, challengerResult, opponentResult) {
  let result = null;
  
  switch (gameType) {
    case '🎲': // Кости - больше значение побеждает
    case '🎳': // Боулинг - больше кеглей побеждает
      if (challengerResult > opponentResult) result = 'challenger';
      else if (opponentResult > challengerResult) result = 'opponent';
      break;
      
    case '🎯': // Дартс - попадание в центр (6) побеждает, иначе больше очков
      if (challengerResult === 6 && opponentResult !== 6) result = 'challenger';
      else if (opponentResult === 6 && challengerResult !== 6) result = 'opponent';
      else if (challengerResult > opponentResult) result = 'challenger';
      else if (opponentResult > challengerResult) result = 'opponent';
      break;
      
    case '⚽': // Футбол - гол (4,5) побеждает
    case '🏀': // Баскетбол - попадание (4,5) побеждает
      const challengerScore = challengerResult >= 4;
      const opponentScore = opponentResult >= 4;
      if (challengerScore && !opponentScore) result = 'challenger';
      else if (opponentScore && !challengerScore) result = 'opponent';
      // Если оба забили или оба промазали - ничья
      break;
      
    case '🎰': // Слоты - лучшая комбинация
      // Предполагаем что 1-32 это выигрышные комбинации разного уровня
      const challengerWin = challengerResult >= 1 && challengerResult <= 64;
      const opponentWin = opponentResult >= 1 && opponentResult <= 64;
      if (challengerWin && !opponentWin) result = 'challenger';
      else if (opponentWin && !challengerWin) result = 'opponent';
      else if (challengerWin && opponentWin) {
        // Оба выиграли - выше значение лучше
        if (challengerResult > opponentResult) result = 'challenger';
        else if (opponentResult > challengerResult) result = 'opponent';
      }
      break;
  }
  
  return result; // 'challenger', 'opponent' или null для ничьи
};

DuelRound.prototype.getResultText = function() {
  const gameType = this.gameType;
  const c = this.challengerResult;
  const o = this.opponentResult;
  
  switch (gameType) {
    case '🎲':
      return `(${c} vs ${o})`;
      
    case '🎯':
      const dartC = c === 6 ? 'Центр!' : `${c} очков`;
      const dartO = o === 6 ? 'Центр!' : `${o} очков`;
      return `(${dartC} vs ${dartO})`;
      
    case '⚽':
      const goalC = c >= 4 ? 'ГОЛ!' : 'Мимо';
      const goalO = o >= 4 ? 'ГОЛ!' : 'Мимо';
      return `(${goalC} vs ${goalO})`;
      
    case '🏀':
      const basketC = c >= 4 ? 'Попал!' : 'Мимо';
      const basketO = o >= 4 ? 'Попал!' : 'Мимо';
      return `(${basketC} vs ${basketO})`;
      
    case '🎰':
      const slotC = c >= 1 && c <= 64 ? 'Выигрыш!' : 'Проигрыш';
      const slotO = o >= 1 && o <= 64 ? 'Выигрыш!' : 'Проигрыш';
      return `(${slotC} vs ${slotO})`;
      
    case '🎳':
      return `(${c} кеглей vs ${o} кеглей)`;
      
    default:
      return `(${c} vs ${o})`;
  }
};

DuelRound.prototype.isComplete = function() {
  return this.challengerResult !== null && this.opponentResult !== null;
};

DuelRound.prototype.needsChallengerMove = function() {
  return this.challengerResult === null;
};

DuelRound.prototype.needsOpponentMove = function() {
  return this.opponentResult === null;
};

// Хуки модели
DuelRound.addHook('beforeUpdate', async (round) => {
  // Автоматически определяем победителя когда оба броска сделаны
  if (round.changed('opponentResult') && round.challengerResult !== null && round.opponentResult !== null) {
    const winner = round.determineWinner(round.gameType, round.challengerResult, round.opponentResult);
    
    if (winner) {
      // Получаем информацию о дуэли для usernames
      const Duel = require('./duel.model');
      const duel = await Duel.findOne({ where: { id: round.duelId } });
      
      if (duel) {
        round.winnerId = winner === 'challenger' ? duel.challengerId : duel.opponentId;
        round.winnerUsername = winner === 'challenger' ? duel.challengerUsername : duel.opponentUsername;
        round.isDraw = false;
      }
    } else {
      round.isDraw = true;
    }
    
    round.status = 'completed';
  }
});

// Устанавливаем связи с другими моделями
DuelRound.associate = function(models) {
  // Раунд принадлежит дуэли
  DuelRound.belongsTo(models.Duel, {
    foreignKey: 'duelId',
    as: 'duel'
  });
};

module.exports = DuelRound;