// bot/src/utils/chat-utils.js

/**
 * Проверка типа чата для команд
 */
function checkChatType(ctx, allowedTypes = ['private']) {
  const chatType = ctx.chat.type;
  
  if (!allowedTypes.includes(chatType)) {
    return {
      isAllowed: false,
      chatType,
      message: getChatTypeMessage(chatType, allowedTypes)
    };
  }
  
  return {
    isAllowed: true,
    chatType
  };
}

/**
 * Получение сообщения для неподходящего типа чата
 */
function getChatTypeMessage(currentType, allowedTypes) {
  if (currentType === 'private' && !allowedTypes.includes('private')) {
    // Команда не работает в ЛС
    return '🤖 Эта команда доступна только в группах.\n\n' +
           '👥 Добавьте бота в группу для использования этой функции.';
  }
  
  if ((currentType === 'group' || currentType === 'supergroup') && !allowedTypes.includes('group')) {
    // Команда не работает в группах
    return '🤖 Эта команда доступна только в личных сообщениях.\n\n' +
           '💬 Напишите боту в личные сообщения для использования этой функции.\n' +
           '🎯 В группах доступны только дуэли: `/duel сумма игра формат`';
  }
  
  return '🤖 Команда недоступна в этом типе чата.';
}

/**
 * Middleware для проверки типа чата
 */
function requireChatType(allowedTypes = ['private']) {
  return async (ctx, next) => {
    const check = checkChatType(ctx, allowedTypes);
    
    if (!check.isAllowed) {
      await ctx.reply(check.message, { parse_mode: 'Markdown' });
      return;
    }
    
    return next();
  };
}

/**
 * Быстрые проверки для удобства
 */
const requirePrivateChat = () => requireChatType(['private']);
const requireGroupChat = () => requireChatType(['group', 'supergroup']);
const allowAnyChat = () => requireChatType(['private', 'group', 'supergroup']);

module.exports = {
  checkChatType,
  getChatTypeMessage,
  requireChatType,
  requirePrivateChat,
  requireGroupChat,
  allowAnyChat
};