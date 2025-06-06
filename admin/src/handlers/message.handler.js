// admin/src/handlers/message.handler.js

// Import command modules
const eventsCommands = require('../commands/events.command');
const usersCommands = require('../commands/users.command');
const transactionsCommands = require('../commands/transactions.command');
const promoCommands = require('../commands/promo.command');

/**
 *  538AB@8@C5B >1@01>BG8:8 B5:AB>2KE A>>1I5=89 4;O 04<8=-1>B0
 * @param {Object} bot - -:75<?;O@ Telegraf
 */
function registerMessageHandlers(bot) {
  console.log('=Ý  538AB@0F8O message handlers...');

  // 1@01>B:0 B5:AB>2KE A>>1I5=89
  bot.on('text', async (ctx, next) => {
    console.log('ADMIN: >;CG5=> B5:AB>2>5 A>>1I5=85:', ctx.message.text);
    
    try {
      // @>25@O5<, 5A;8 MB> ?@>F5AA A>740=8O A>1KB8O
      if (ctx.session && ctx.session.creatingEvent) {
        console.log('ADMIN: 1@010BK205< A>740=85 A>1KB8O');
        await eventsCommands.handleEventCreation(ctx);
        return;
      }
      
      // @>25@O5<, 5A;8 MB> ?@>F5AA 7025@H5=8O A>1KB8O
      if (ctx.session && ctx.session.finishingEvent) {
        console.log('ADMIN: 1@010BK205< 7025@H5=85 A>1KB8O');
        await eventsCommands.handleEventFinishing(ctx);
        return;
      }

      // @>25@O5< ?>8A: ?>;L7>20B5;59
      if (ctx.session && ctx.session.searchingUser) {
        console.log('ADMIN: 1@010BK205< ?>8A: ?>;L7>20B5;O');
        await usersCommands.handleUserSearch(ctx);
        return;
      }

      // @>25@O5< 87<5=5=85 10;0=A0 ?>;L7>20B5;O
      if (ctx.session && ctx.session.adjustingBalance) {
        console.log('ADMIN: 1@010BK205< 87<5=5=85 10;0=A0 ?>;L7>20B5;O');
        await usersCommands.handleBalanceAdjustment(ctx);
        return;
      }

      // @>25@O5< >B:;>=5=85 2K2>40
      if (ctx.session && ctx.session.rejectingWithdrawal) {
        console.log('ADMIN: 1@010BK205< >B:;>=5=85 2K2>40');
        await transactionsCommands.handleWithdrawalRejection(ctx);
        return;
      }

      // @>25@O5< A>740=85 ?@><>:>40
      if (ctx.session && ctx.session.creatingPromo) {
        console.log('ADMIN: 1@010BK205< A>740=85 ?@><>:>40');
        await promoCommands.handlePromoCreation(ctx);
        return;
      }

      // A;8 MB> :><0=40 8;8 >1KG=>5 A>>1I5=85 157 0:B82=>9 A5AA88
      console.log('ADMIN: "5:AB>2>5 A>>1I5=85 157 0:B82=>9 A5AA88, ?5@5405< 40;LH5');
      return next();
      
    } catch (error) {
      console.error('ADMIN: H81:0 >1@01>B:8 B5:AB>2>3> A>>1I5=8O:', error);
      await ctx.reply('L @>87>H;0 >H81:0 ?@8 >1@01>B:5 A>>1I5=8O. >?@>1C9B5 5I5 @07.');
    }
  });

  console.log(' Message handlers 70@538AB@8@>20=K CA?5H=>');
}

module.exports = {
  registerMessageHandlers
};