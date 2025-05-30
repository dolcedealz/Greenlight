// backend/src/models/game-settings.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameSettingsSchema = new Schema({
  // Идентификатор настроек (всегда "global")
  settingsId: {
    type: String,
    default: 'global',
    unique: true,
    required: true
  },
  
  // Глобальные модификаторы для игр
  globalModifiers: {
    coin: {
      winChanceModifier: {
        type: Number,
        default: 0,
        min: -47.5,
        max: 52.5
      },
      enabled: {
        type: Boolean,
        default: false
      }
    },
    slots: {
      rtpModifier: {
        type: Number,
        default: 0,
        min: -30,
        max: 20
      },
      enabled: {
        type: Boolean,
        default: false
      }
    },
    mines: {
      mineChanceModifier: {
        type: Number,
        default: 0,
        min: -20,
        max: 30
      },
      enabled: {
        type: Boolean,
        default: false
      }
    },
    crash: {
      crashModifier: {
        type: Number,
        default: 0,
        min: -20,
        max: 50
      },
      enabled: {
        type: Boolean,
        default: true // Crash всегда глобальный
      }
    }
  },
  
  // Настройки применения модификаторов
  modifierMode: {
    type: String,
    enum: ['individual', 'global', 'mixed'], // individual - только персональные, global - только глобальные, mixed - комбинированные
    default: 'individual'
  },
  
  // История изменений
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Статический метод для получения текущих настроек
gameSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ settingsId: 'global' });
  
  if (!settings) {
    // Создаем настройки по умолчанию
    settings = await this.create({ settingsId: 'global' });
  }
  
  return settings;
};

// Статический метод для обновления настроек
gameSettingsSchema.statics.updateSettings = async function(updates, adminId) {
  const settings = await this.findOneAndUpdate(
    { settingsId: 'global' },
    { 
      ...updates,
      lastModified: new Date(),
      lastModifiedBy: adminId
    },
    { new: true, upsert: true }
  );
  
  return settings;
};

const GameSettings = mongoose.model('GameSettings', gameSettingsSchema);

module.exports = GameSettings;