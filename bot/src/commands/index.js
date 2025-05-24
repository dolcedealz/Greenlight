// bot/src/commands/index.js
const startCommand = require('./start.command');
const helpCommand = require('./help.command');
const playCommand = require('./play.command');
const profileCommand = require('./profile.command');
const depositCommand = require('./deposit.command');
const balanceCommand = require('./balance.command');

// Регистрация команд бота
function registerCommands(bot) {
  console.log('🔧 Регистрируем команды бота...');
  
  // Регистрируем команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('play', playCommand);
  bot.command('profile', profileCommand);
  bot.command('deposit', depositCommand);
  bot.command('balance', balanceCommand); // НОВАЯ КОМАНДА
  
  // Добавляем обработчики для других команд по мере необходимости
  
  console.log('✅ Команды бота зарегистрированы');
  return bot;
}

module.exports = {
  registerCommands
};