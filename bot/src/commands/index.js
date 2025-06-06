// bot/src/commands/index.js
const startCommand = require('./start.command');
const helpCommand = require('./help.command');
const playCommand = require('./play.command');
const profileCommand = require('./profile.command');
const depositCommand = require('./deposit.command');
const balanceCommand = require('./balance.command');
const withdrawCommand = require('./withdraw.command');
const promocodeCommand = require('./promocode.command');
// Регистрация команд бота (без дуэлей - они в handlers/duel/)
function registerCommands(bot) {
  console.log('🔧 Регистрируем команды бота (без дуэлей)...');
  
  // Регистрируем основные команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('play', playCommand);
  bot.command('profile', profileCommand);
  bot.command('deposit', depositCommand);
  bot.command('balance', balanceCommand);
  bot.command('withdraw', withdrawCommand);
  bot.command('promocode', promocodeCommand);
  
  // Команды дуэлей теперь обрабатываются в handlers/duel/group-duel.handler.js
  
  // Добавляем обработчики для других команд по мере необходимости
  
  console.log('✅ Команды бота зарегистрированы');
  return bot;
}

module.exports = {
  registerCommands
};