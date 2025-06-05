// bot/src/handlers/duel/index.js

const inlineDuelHandler = require('./inline-duel.handler');
const groupDuelHandler = require('./group-duel.handler');

/**
 * Инициализация всех обработчиков дуэлей
 */
function initializeDuelHandlers(bot) {
  console.log('🎮 Инициализация обработчиков дуэлей...');
  
  try {
    // Инициализация inline дуэлей (для личных сообщений)
    console.log('📱 Инициализация inline дуэлей...');
    inlineDuelHandler.handleInlineQuery(bot);
    inlineDuelHandler.handleInlineCallbacks(bot);
    inlineDuelHandler.handleGameActions(bot);
    
    // Инициализация групповых дуэлей
    console.log('👥 Инициализация групповых дуэлей...');
    groupDuelHandler.handleDuelCommands(bot);
    groupDuelHandler.handleGroupCallbacks(bot);
    groupDuelHandler.handleGroupGameActions(bot);
    
    console.log('✅ Все обработчики дуэлей инициализированы');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации обработчиков дуэлей:', error);
    throw error;
  }
}

module.exports = {
  initializeDuelHandlers,
  inlineDuelHandler,
  groupDuelHandler
};