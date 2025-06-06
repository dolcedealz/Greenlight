// bot/src/handlers/duel/duel-utils.js

/**
 * Конфигурации игр для дуэлей
 */
function getGameConfig(gameType) {
  const gameConfigs = {
    '🎲': {
      emoji: '🎲',
      name: 'Кости',
      actionText: 'Бросить кость',
      processText: 'Бросаем кость...',
      resultText: 'Результат броска кости',
      maxValue: 6,
      rules: 'Больше значение - победа'
    },
    '🎯': {
      emoji: '🎯',
      name: 'Дартс',
      actionText: 'Бросить дартс',
      processText: 'Бросаем дартс...',
      resultText: 'Результат броска дартса',
      maxValue: 6,
      rules: 'Центр (6) приоритет, потом больше значение'
    },
    '⚽': {
      emoji: '⚽',
      name: 'Футбол',
      actionText: 'Удар по мячу',
      processText: 'Бьем по мячу...',
      resultText: 'Результат удара',
      maxValue: 5,
      rules: 'Гол при значении 4-5'
    },
    '⚽️': {
      emoji: '⚽️',
      name: 'Футбол',
      actionText: 'Удар по мячу',
      processText: 'Бьем по мячу...',
      resultText: 'Результат удара',
      maxValue: 5,
      rules: 'Гол при значении 4-5'
    },
    '🏀': {
      emoji: '🏀',
      name: 'Баскетбол',
      actionText: 'Бросок в корзину',
      processText: 'Бросаем в корзину...',
      resultText: 'Результат броска',
      maxValue: 5,
      rules: 'Попадание при значении 4-5'
    },
    '🎳': {
      emoji: '🎳',
      name: 'Боулинг',
      actionText: 'Бросок в боулинге',
      processText: 'Бросаем боулинг...',
      resultText: 'Результат в боулинге',
      maxValue: 6,
      rules: 'Больше сбитых кеглей - победа'
    },
    '🎰': {
      emoji: '🎰',
      name: 'Слоты',
      actionText: 'Крутить слоты',
      processText: 'Крутим слоты...',
      resultText: 'Результат слотов',
      maxValue: 64,
      rules: 'Лучшая комбинация побеждает'
    }
  };

  return gameConfigs[gameType] || gameConfigs['🎲']; // По умолчанию кости
}

/**
 * Получение имени игры
 */
function getGameName(gameType) {
  return getGameConfig(gameType).name;
}

/**
 * Получение эмодзи для Telegram Dice API (базовые эмодзи без variation selector)
 */
function getTelegramDiceEmoji(gameType) {
  const telegramEmojiMap = {
    '🎲': '🎲',
    '🎯': '🎯',
    '⚽': '⚽',
    '⚽️': '⚽', // Важно: Telegram API требует базовый эмодзи
    '🏀': '🏀',
    '🎳': '🎳',
    '🎰': '🎰'
  };
  
  const result = telegramEmojiMap[gameType];
  if (!result) {
    console.error(`Неподдерживаемый gameType: ${gameType}, используем fallback 🎲`);
    return '🎲';
  }
  
  return result;
}

/**
 * Конвертация текстового названия игры в эмодзи
 */
function convertGameNameToEmoji(gameName) {
  if (!gameName) return '🎲'; // По умолчанию кости
  
  const gameMap = {
    'dice': '🎲',
    'darts': '🎯', 
    'football': '⚽️',
    'basketball': '🏀',
    'bowling': '🎳',
    'slots': '🎰',
    'slot': '🎰',
    // Поддержка прямых эмодзи
    '🎲': '🎲',
    '🎯': '🎯',
    '⚽': '⚽️',
    '⚽️': '⚽️',
    '🏀': '🏀',
    '🎳': '🎳',
    '🎰': '🎰'
  };
  
  const normalizedName = gameName.toLowerCase();
  return gameMap[normalizedName] || gameMap[gameName] || gameName;
}

/**
 * Форматы дуэлей
 */
function getFormatConfig(format) {
  const formats = {
    'bo1': { name: 'Bo1', winsRequired: 1, description: 'до 1 победы' },
    'bo3': { name: 'Bo3', winsRequired: 2, description: 'до 2 побед' },
    'bo5': { name: 'Bo5', winsRequired: 3, description: 'до 3 побед' },
    'bo7': { name: 'Bo7', winsRequired: 4, description: 'до 4 побед' }
  };
  
  return formats[(format || 'bo1').toLowerCase()] || formats['bo1'];
}

/**
 * Валидация параметров дуэли
 */
function validateDuelParams(targetUsername, amount, gameType, format) {
  const errors = [];
  
  // Строгая проверка username (только буквы, цифры, подчеркивания)
  if (!targetUsername || !/^[a-zA-Z0-9_]{3,32}$/.test(targetUsername)) {
    errors.push('Username должен содержать 3-32 символа (буквы, цифры, _)');
  }
  
  // Строгая проверка суммы - только целые числа
  const numAmount = Number(amount);
  if (!Number.isInteger(numAmount) || numAmount < 1 || numAmount > 1000) {
    errors.push('Сумма должна быть целым числом от 1 до 1000 USDT');
  }
  
  // Whitelist проверка типа игры
  const validGameTypes = ['🎲', '🎯', '⚽', '⚽️', '🏀', '🎳', '🎰'];
  if (!validGameTypes.includes(gameType)) {
    errors.push('Недопустимый тип игры');
  }
  
  // Whitelist проверка формата
  const validFormats = ['bo1', 'bo3', 'bo5', 'bo7'];
  const normalizedFormat = String(format).toLowerCase();
  if (!validFormats.includes(normalizedFormat)) {
    errors.push('Недопустимый формат');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    params: {
      targetUsername: String(targetUsername).replace('@', '').toLowerCase(),
      amount: numAmount,
      gameType,
      format: normalizedFormat
    }
  };
}

/**
 * Генерация безопасного ID для inline данных
 */
function generateShortId(challengerId, targetUsername) {
  const crypto = require('crypto');
  
  // Генерируем криптографически стойкий случайный ID
  const randomBytes = crypto.randomBytes(8);
  const timestamp = Date.now();
  
  // Создаем хеш для дополнительной безопасности
  const hash = crypto.createHash('sha256')
    .update(`${challengerId}_${targetUsername}_${timestamp}_${randomBytes.toString('hex')}`)
    .digest('hex')
    .substring(0, 12);
  
  return `${challengerId}_${hash}`;
}

/**
 * Форматирование сообщения о дуэли
 */
function formatDuelMessage(duel, isPersonal = false) {
  const gameConfig = getGameConfig(duel.gameType);
  const formatConfig = getFormatConfig(duel.format);
  
  const header = `${gameConfig.emoji} **ДУЭЛЬ** ${gameConfig.emoji}`;
  const participants = isPersonal 
    ? `⚔️ @${duel.challengerUsername} VS @${duel.opponentUsername}`
    : `👤 Вызов от: @${duel.challengerUsername}${duel.opponentUsername ? `\n🎯 Против: @${duel.opponentUsername}` : ''}`;
  
  const gameInfo = [
    `🎮 Игра: ${gameConfig.name}`,
    `💰 Ставка: ${duel.amount} USDT каждый`,
    `🏆 Формат: ${formatConfig.name} (${formatConfig.description})`,
    `💎 Общий банк: ${duel.totalAmount || duel.amount * 2} USDT`,
    `🎯 Выигрыш: ${duel.winAmount || (duel.amount * 2 * 0.95)} USDT`
  ].join('\n');
  
  return `${header}\n\n${participants}\n\n${gameInfo}`;
}

/**
 * Форматирование результатов раунда
 */
function formatRoundResults(rounds, challengerUsername, opponentUsername, duel = null) {
  if (!rounds || rounds.length === 0) return '';
  
  let result = '📍 **Результаты раундов:**\n';
  
  rounds.forEach((round, index) => {
    if (round.challengerResult !== null && round.opponentResult !== null) {
      let resultIcon = '🤝'; // ничья по умолчанию
      
      // Определяем победителя раунда
      if (round.winnerId) {
        if (duel) {
          // Если передан объект дуэли, используем его для определения победителя
          if (round.winnerId === duel.challengerId) {
            resultIcon = '✅';
          } else if (round.winnerId === duel.opponentId) {
            resultIcon = '❌';
          }
        } else {
          // Иначе просто показываем что есть победитель
          resultIcon = '⭐';
        }
      }
      
      result += `• Раунд ${index + 1}: @${challengerUsername} [${round.challengerResult}] vs @${opponentUsername} [${round.opponentResult}] ${resultIcon}\n`;
    }
  });
  
  return result;
}

module.exports = {
  getGameConfig,
  getGameName,
  getTelegramDiceEmoji,
  convertGameNameToEmoji,
  getFormatConfig,
  validateDuelParams,
  generateShortId,
  formatDuelMessage,
  formatRoundResults
};