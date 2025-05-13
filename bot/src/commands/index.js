// index.js
const startCommand = require('./start.command');
const helpCommand = require('./help.command');
const playCommand = require('./play.command');
const profileCommand = require('./profile.command');
const depositCommand = require('./deposit.command');

// Регистрация команд бота
function registerCommands(bot) {
  // Регистрируем команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('play', playCommand);
  bot.command('profile', profileCommand);
  bot.command('deposit', depositCommand);
  
  // Добавляем обработчики для других команд по мере необходимости
  
  return bot;
}

module.exports = {
  registerCommands
};