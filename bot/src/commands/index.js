// bot/src/commands/index.js
const startCommand = require('./start.command');
const helpCommand = require('./help.command');
const playCommand = require('./play.command');
const profileCommand = require('./profile.command');
const depositCommand = require('./deposit.command');
const balanceCommand = require('./balance.command');
const withdrawCommand = require('./withdraw.command');
const duelCommands = require('./duel.command');

// Регистрация команд бота
function registerCommands(bot) {
  console.log('🔧 Регистрируем команды бота...');
  
  // Регистрируем команды
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('play', playCommand);
  bot.command('profile', profileCommand);
  bot.command('deposit', depositCommand);
  bot.command('balance', balanceCommand);
  bot.command('withdraw', withdrawCommand);
  
  // Команды дуэлей
  bot.command('duel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    // Если есть аргументы и первый начинается с @, то это персональный вызов
    if (args.length > 0 && args[0].startsWith('@')) {
      return duelCommands.createPersonalDuel(ctx);
    } else {
      return duelCommands.createOpenDuel(ctx);
    }
  });
  bot.command('duel_help', duelCommands.showDuelHelp);
  bot.command('duel_stats', duelCommands.showDuelStats);
  bot.command('duel_history', duelCommands.showDuelHistory);
  bot.command('duel_cancel', duelCommands.cancelDuel);
  
  // Добавляем обработчики для других команд по мере необходимости
  
  console.log('✅ Команды бота зарегистрированы');
  return bot;
}

module.exports = {
  registerCommands
};