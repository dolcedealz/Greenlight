const mongoose = require('mongoose');

const duelRoundSchema = new mongoose.Schema({
  // Связь с дуэлью
  duelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Duel',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  
  // Информация о раунде
  roundNumber: {
    type: Number,
    required: true,
    min: 1
  },
  gameType: {
    type: String,
    enum: ['🎲', '🎯', '⚽', '⚽️', '🏀', '🎳', '🎰'],
    required: true
  },
  
  // Результаты игроков
  challengerResult: {
    type: Number,
    default: null
  },
  opponentResult: {
    type: Number,
    default: null
  },
  
  // Временные метки
  challengerTimestamp: {
    type: Date,
    default: null
  },
  opponentTimestamp: {
    type: Date,
    default: null
  },
  
  // ID сообщений в Telegram
  challengerMessageId: {
    type: Number,
    default: null
  },
  opponentMessageId: {
    type: Number,
    default: null
  },
  
  // Результат раунда
  winnerId: {
    type: String,
    default: null
  },
  winnerUsername: {
    type: String,
    default: null
  },
  isDraw: {
    type: Boolean,
    default: false
  },
  
  // Статус раунда
  status: {
    type: String,
    enum: ['waiting_challenger', 'waiting_opponent', 'completed'],
    default: 'waiting_challenger'
  },
  
  // Метаданные
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Индексы
duelRoundSchema.index({ duelId: 1 });
duelRoundSchema.index({ sessionId: 1 });
duelRoundSchema.index({ roundNumber: 1 });
duelRoundSchema.index({ status: 1 });
duelRoundSchema.index({ createdAt: -1 });
duelRoundSchema.index({ duelId: 1, roundNumber: 1 }, { unique: true });

// Методы экземпляра
duelRoundSchema.methods.determineWinner = function(gameType, challengerResult, opponentResult) {
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
    case '⚽️': // Футбол - гол (4,5) побеждает
    case '🏀': // Баскетбол - попадание (4,5) побеждает
      const challengerScore = challengerResult >= 4;
      const opponentScore = opponentResult >= 4;
      if (challengerScore && !opponentScore) result = 'challenger';
      else if (opponentScore && !challengerScore) result = 'opponent';
      // Если оба забили или оба промазали - ничья
      break;
      
    case '🎰': // Слоты - лучшая комбинация
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

duelRoundSchema.methods.getResultText = function() {
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
    case '⚽️':
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

duelRoundSchema.methods.isComplete = function() {
  return this.challengerResult !== null && this.opponentResult !== null;
};

duelRoundSchema.methods.needsChallengerMove = function() {
  return this.challengerResult === null;
};

duelRoundSchema.methods.needsOpponentMove = function() {
  return this.opponentResult === null;
};

// Хуки модели
duelRoundSchema.pre('save', async function(next) {
  // Автоматически определяем победителя когда оба броска сделаны
  if (this.isModified('opponentResult') && this.challengerResult !== null && this.opponentResult !== null) {
    const winner = this.determineWinner(this.gameType, this.challengerResult, this.opponentResult);
    
    if (winner) {
      // Получаем информацию о дуэли для usernames
      const Duel = require('./duel.model');
      const duel = await Duel.findById(this.duelId);
      
      if (duel) {
        this.winnerId = winner === 'challenger' ? duel.challengerId : duel.opponentId;
        this.winnerUsername = winner === 'challenger' ? duel.challengerUsername : duel.opponentUsername;
        this.isDraw = false;
      }
    } else {
      this.isDraw = true;
    }
    
    this.status = 'completed';
  }
  
  next();
});

module.exports = mongoose.model('DuelRound', duelRoundSchema);