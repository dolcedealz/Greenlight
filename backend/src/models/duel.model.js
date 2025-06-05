const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Duel = sequelize.define('Duel', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Базовая информация о дуэли
  sessionId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: 'Уникальный идентификатор сессии дуэли'
  },
  
  // Участники дуэли
  challengerId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID инициатора дуэли'
  },
  challengerUsername: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Username инициатора'
  },
  opponentId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID противника (null для открытых дуэлей)'
  },
  opponentUsername: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Username противника'
  },
  
  // Настройки игры
  gameType: {
    type: DataTypes.ENUM('🎲', '🎯', '⚽', '🏀', '🎳', '🎰'),
    allowNull: false,
    comment: 'Тип игры через эмодзи'
  },
  format: {
    type: DataTypes.ENUM('bo1', 'bo3', 'bo5', 'bo7'),
    allowNull: false,
    defaultValue: 'bo1',
    comment: 'Формат дуэли (best of N)'
  },
  winsRequired: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Количество побед для выигрыша серии'
  },
  
  // Финансовая информация
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Ставка каждого игрока в USDT'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Общий банк (amount * 2)'
  },
  winAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Сумма выигрыша (totalAmount * 0.95)'
  },
  commission: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Комиссия казино (totalAmount * 0.05)'
  },
  
  // Статус дуэли
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'active', 'completed', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Текущий статус дуэли'
  },
  
  // Результаты
  winnerId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID победителя'
  },
  winnerUsername: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Username победителя'
  },
  challengerScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Счет инициатора'
  },
  opponentScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Счет противника'
  },
  
  // Информация о чате
  chatId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID чата где создана дуэль'
  },
  chatType: {
    type: DataTypes.ENUM('private', 'group', 'supergroup', 'channel'),
    allowNull: false,
    comment: 'Тип чата'
  },
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID сообщения с дуэлью'
  },
  
  // Временные ограничения
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время истечения приглашения'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время начала дуэли'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время завершения дуэли'
  },
  
  // Метаданные
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Дополнительные данные (IP адреса, источник и т.д.)'
  }
}, {
  tableName: 'duels',
  timestamps: true,
  paranoid: true, // Мягкое удаление
  indexes: [
    { fields: ['sessionId'] },
    { fields: ['challengerId'] },
    { fields: ['opponentId'] },
    { fields: ['status'] },
    { fields: ['chatId'] },
    { fields: ['createdAt'] },
    { fields: ['winnerId'] },
    { fields: ['gameType'] }
  ]
});

// Виртуальные поля
Duel.prototype.getGameName = function() {
  const gameNames = {
    '🎲': 'Кости',
    '🎯': 'Дартс',
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎳': 'Боулинг',
    '🎰': 'Слоты'
  };
  return gameNames[this.gameType] || 'Неизвестная игра';
};

Duel.prototype.getFormatName = function() {
  const formatNames = {
    'bo1': 'Bo1 (1 раунд)',
    'bo3': 'Bo3 (до 2 побед)',
    'bo5': 'Bo5 (до 3 побед)',
    'bo7': 'Bo7 (до 4 побед)'
  };
  return formatNames[this.format] || 'Неизвестный формат';
};

Duel.prototype.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

Duel.prototype.canAccept = function(userId) {
  return this.status === 'pending' && 
         !this.isExpired() && 
         this.challengerId !== userId &&
         (!this.opponentId || this.opponentId === userId);
};

Duel.prototype.isParticipant = function(userId) {
  return this.challengerId === userId || this.opponentId === userId;
};

// Хуки модели
Duel.addHook('beforeCreate', (duel) => {
  // Устанавливаем sessionId если не задан
  if (!duel.sessionId) {
    duel.sessionId = `duel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Рассчитываем финансовые поля
  duel.totalAmount = duel.amount * 2;
  duel.winAmount = duel.totalAmount * 0.95;
  duel.commission = duel.totalAmount * 0.05;
  
  // Устанавливаем количество побед для формата
  const winsMap = { bo1: 1, bo3: 2, bo5: 3, bo7: 4 };
  duel.winsRequired = winsMap[duel.format] || 1;
  
  // Устанавливаем время истечения (5 минут для приглашений)
  if (duel.status === 'pending') {
    duel.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  }
});

Duel.addHook('beforeUpdate', (duel) => {
  // Устанавливаем время начала при принятии дуэли
  if (duel.changed('status') && duel.status === 'active' && !duel.startedAt) {
    duel.startedAt = new Date();
  }
  
  // Устанавливаем время завершения при завершении дуэли
  if (duel.changed('status') && duel.status === 'completed' && !duel.completedAt) {
    duel.completedAt = new Date();
  }
});

// Устанавливаем связи с другими моделями
Duel.associate = function(models) {
  // Дуэль имеет много раундов
  Duel.hasMany(models.DuelRound, {
    foreignKey: 'duelId',
    as: 'rounds',
    onDelete: 'CASCADE'
  });
  
  // Дуэль может иметь приглашение
  Duel.hasOne(models.DuelInvitation, {
    foreignKey: 'duelId',
    as: 'invitation'
  });
  
  // Дуэль связана с пользователями (инициатор и противник)
  // Связи с User моделью будут добавлены позже если понадобится
};

module.exports = Duel;