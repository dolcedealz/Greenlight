const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DuelInvitation = sequelize.define('DuelInvitation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Уникальный идентификатор приглашения
  inviteId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: 'Уникальный ID приглашения для inline режима'
  },
  
  // Участники
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
  targetUsername: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Username целевого игрока (null для открытых приглашений)'
  },
  targetUserId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID целевого игрока (заполняется при принятии)'
  },
  
  // Настройки дуэли
  gameType: {
    type: DataTypes.ENUM('🎲', '🎯', '⚽', '🏀', '🎳', '🎰'),
    allowNull: false,
    comment: 'Тип игры через эмодзи'
  },
  format: {
    type: DataTypes.ENUM('bo1', 'bo3', 'bo5', 'bo7'),
    allowNull: false,
    defaultValue: 'bo1',
    comment: 'Формат дуэли'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Ставка каждого игрока в USDT'
  },
  
  // Статус приглашения
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Статус приглашения'
  },
  
  // Связанная дуэль
  duelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'duels',
      key: 'id'
    },
    comment: 'ID созданной дуэли (после принятия)'
  },
  
  // Информация о чатах
  sourceChat: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Информация об исходном чате где было создано приглашение'
  },
  
  // Telegram данные
  inviteMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID сообщения с приглашением в личном чате'
  },
  sourceMessageId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID исходного сообщения в группе/канале'
  },
  
  // Временные ограничения
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Время истечения приглашения'
  },
  acceptedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Время принятия приглашения'
  },
  
  // Метаданные
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Дополнительные данные (source, IP и т.д.)'
  }
}, {
  tableName: 'duel_invitations',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['inviteId'] },
    { fields: ['challengerId'] },
    { fields: ['targetUsername'] },
    { fields: ['targetUserId'] },
    { fields: ['status'] },
    { fields: ['expiresAt'] },
    { fields: ['duelId'] },
    { fields: ['createdAt'] }
  ]
});

// Виртуальные поля и методы
DuelInvitation.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

DuelInvitation.prototype.canAccept = function(userId, username) {
  return this.status === 'pending' && 
         !this.isExpired() && 
         this.challengerId !== userId &&
         (!this.targetUsername || this.targetUsername === username);
};

DuelInvitation.prototype.canCancel = function(userId) {
  return this.status === 'pending' && 
         this.challengerId === userId &&
         !this.isExpired();
};

DuelInvitation.prototype.getGameName = function() {
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

DuelInvitation.prototype.getFormatName = function() {
  const formatNames = {
    'bo1': 'Bo1 (1 раунд)',
    'bo3': 'Bo3 (до 2 побед)',
    'bo5': 'Bo5 (до 3 побед)',
    'bo7': 'Bo7 (до 4 побед)'
  };
  return formatNames[this.format] || 'Неизвестный формат';
};

DuelInvitation.prototype.getInviteText = function() {
  const target = this.targetUsername ? `@${this.targetUsername}` : 'любого игрока';
  return `🎮 **ПРИГЛАШЕНИЕ НА ДУЭЛЬ** 🎮\n\n` +
         `${this.gameType} **${this.getGameName()}** ${this.gameType}\n` +
         `👤 От: @${this.challengerUsername}\n` +
         `🎯 Вызывает: ${target}\n` +
         `💰 Ставка: ${this.amount} USDT каждый\n` +
         `🏆 Формат: ${this.getFormatName()}\n` +
         `⏱ Действует до: ${this.expiresAt.toLocaleTimeString('ru')}`;
};

// Хуки модели
DuelInvitation.addHook('beforeCreate', (invitation) => {
  // Генерируем уникальный ID приглашения
  if (!invitation.inviteId) {
    invitation.inviteId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Устанавливаем время истечения (5 минут)
  if (!invitation.expiresAt) {
    invitation.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  }
});

DuelInvitation.addHook('beforeUpdate', (invitation) => {
  // Устанавливаем время принятия
  if (invitation.changed('status') && invitation.status === 'accepted' && !invitation.acceptedAt) {
    invitation.acceptedAt = new Date();
  }
});

// Статические методы
DuelInvitation.cleanupExpired = async function() {
  const expiredInvitations = await this.findAll({
    where: {
      status: 'pending',
      expiresAt: {
        [require('sequelize').Op.lt]: new Date()
      }
    }
  });
  
  for (const invitation of expiredInvitations) {
    await invitation.update({ status: 'expired' });
  }
  
  return expiredInvitations.length;
};

// Устанавливаем связи с другими моделями  
DuelInvitation.associate = function(models) {
  // Приглашение может быть связано с дуэлью
  DuelInvitation.belongsTo(models.Duel, {
    foreignKey: 'duelId',
    as: 'duel'
  });
};

module.exports = DuelInvitation;