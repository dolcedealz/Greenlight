// admin/src/commands/stats.command.js
const axios = require('axios');
const config = require('../config');

async function statsCommand(ctx) {
  try {
    const message = ctx.message.text.split(' ');
    const command = message[1] || 'finance'; // > C<>;G0=8N D8=0=A>20O AB0B8AB8:0
    
    switch (command) {
      case 'finance':
      case 'D8=0=AK':
        await showFinanceStats(ctx);
        break;
        
      case 'users':
      case '?>;L7>20B5;8':
        await showUserStats(ctx);
        break;
        
      case 'games':
      case '83@K':
        await showGameStats(ctx);
        break;
        
      case 'commission':
      case ':><8AA88':
        await showCommissionStats(ctx);
        break;
        
      default:
        await ctx.reply(
          '=Ê <b>!B0B8AB8:0 :078=></b>\n\n' +
          '>ABC?=K5 :><0=4K:\n' +
          '" /stats finance - $8=0=A>20O AB0B8AB8:0\n' +
          '" /stats commission - 5B0;8 ?> :><8AA8O<\n' +
          '" /stats users - !B0B8AB8:0 ?>;L7>20B5;59\n' +
          '" /stats games - !B0B8AB8:0 83@',
          { parse_mode: 'HTML' }
        );
    }
    
  } catch (error) {
    console.error('H81:0 :><0=4K /stats:', error);
    await ctx.reply('L H81:0 ?>;CG5=8O AB0B8AB8:8. >?@>1C9B5 ?>765.');
  }
}

async function showFinanceStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const finance = response.data.data.current;
    
    let message = '=° <b>$!/ !""!"</b>\n\n';
    
    // A=>2=K5 10;0=AK
    message += '=Ê <b>A=>2=K5 10;0=AK:</b>\n';
    message += ` 0;0=A ?>;L7>20B5;59: <code>${finance.totalUserBalance.toFixed(2)} USDT</code>\n`;
    message += ` ?5@0B82=K9 10;0=A: <code>${finance.operationalBalance.toFixed(2)} USDT</code>\n`;
    message += `  575@2 (${finance.reservePercentage}%): <code>${finance.reserveBalance.toFixed(2)} USDT</code>\n`;
    message += ` >ABC?=> 4;O 2K2>40: <code>${finance.availableForWithdrawal.toFixed(2)} USDT</code>\n\n`;
    
    // >E>4K 8 @0AE>4K
    message += '=¸ <b>>E>4K 8 @0AE>4K:</b>\n';
    message += ` 1I85 :><8AA88: <code>${finance.totalCommissions?.toFixed(2) || '0.00'} USDT</code>\n`;
    if (finance.commissionBreakdown) {
      message += `  CM;8: <code>${finance.commissionBreakdown.duels?.toFixed(2) || '0.00'} USDT</code>\n`;
      message += `  !>1KB8O: <code>${finance.commissionBreakdown.events?.toFixed(2) || '0.00'} USDT</code>\n`;
    }
    message += ` @><>:>4K: <code>-${finance.totalPromocodeExpenses?.toFixed(2) || '0.00'} USDT</code>\n\n`;
    
    // @54C?@5645=8O
    if (finance.warnings) {
      const warningsList = [];
      if (finance.warnings.lowReserve) warningsList.push('=4 87:89 @575@2');
      if (finance.warnings.highRiskRatio) warningsList.push('=á KA>:89 @8A:');
      if (finance.warnings.negativeOperational) warningsList.push('=4 B@8F0B5;L=K9 10;0=A');
      
      if (warningsList.length > 0) {
        message += '  <b>@54C?@5645=8O:</b>\n';
        warningsList.forEach(warning => {
          message += `" ${warning}\n`;
        });
        message += '\n';
      }
    }
    
    // $>@<C;0 @0AG5B0
    message += '=È <b>$>@<C;0 >?5@0B82=>3> 10;0=A0:</b>\n';
    message += '<i>!B02:8 - K83@KH8 + ><8AA88 - @><>:>4K</i>\n\n';
    
    message += '=¡ /stats commission - 45B0;8 ?> :><8AA8O<';
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('H81:0 ?>;CG5=8O D8=0=A>2>9 AB0B8AB8:8:', error);
    await ctx.reply('L H81:0 ?>;CG5=8O D8=0=A>2>9 AB0B8AB8:8');
  }
}

async function showCommissionStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const { current, allTime } = response.data.data;
    
    let message = '=° <b>"  !!/</b>\n\n';
    
    //  07182:0 :><8AA89
    message += '=Ê <b>AB>G=8:8 :><8AA89:</b>\n';
    if (current.commissionBreakdown) {
      const duels = current.commissionBreakdown.duels || 0;
      const events = current.commissionBreakdown.events || 0;
      const total = duels + events;
      
      message += ` PvP CM;8: <code>${duels.toFixed(2)} USDT</code>`;
      if (total > 0) message += ` (${((duels/total)*100).toFixed(1)}%)`;
      message += '\n';
      
      message += `  5% A :064>9 4CM;8\n`;
      
      message += ` !>1KB8O: <code>${events.toFixed(2)} USDT</code>`;
      if (total > 0) message += ` (${((events/total)*100).toFixed(1)}%)`;
      message += '\n';
      
      message += `  0@60 2 :>MDD8F85=B0E\n`;
      
      message += ` A53>: <code>${total.toFixed(2)} USDT</code>\n\n`;
    }
    
    //  0AE>4K =0 ?@><>:>4K
    message += '< <b> 0AE>4K =0 ?@><>:>4K:</b>\n';
    message += ` A53>: <code>${current.totalPromocodeExpenses?.toFixed(2) || '0.00'} USDT</code>\n\n`;
    
    // '8AB0O ?@81K;L
    const netProfit = (current.totalCommissions || 0) - (current.totalPromocodeExpenses || 0);
    message += '=Ž <b>'8AB0O ?@81K;L >B :><8AA89:</b>\n';
    message += ` <code>${netProfit.toFixed(2)} USDT</code>\n\n`;
    
    // !B0B8AB8:0 83@
    if (allTime.gameStats) {
      message += '<® <b>@81K;L ?> 83@0<:</b>\n';
      
      Object.entries(allTime.gameStats).forEach(([game, stats]) => {
        if (stats.profit > 0) {
          const gameNames = {
            coin: '>=5B:0',
            mines: '8=K',
            slots: '!;>BK',
            crash: '@0H',
            events: '!>1KB8O'
          };
          
          message += ` ${gameNames[game] || game}: <code>${stats.profit.toFixed(2)} USDT</code>\n`;
        }
      });
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('H81:0 ?>;CG5=8O AB0B8AB8:8 :><8AA89:', error);
    await ctx.reply('L H81:0 ?>;CG5=8O AB0B8AB8:8 :><8AA89');
  }
}

async function showUserStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/stats/users`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const stats = response.data.data;
    
    let message = '=e <b>!""!" ,"</b>\n\n';
    
    message += ` A53> ?>;L7>20B5;59: <code>${stats.totalUsers || 0}</code>\n`;
    message += ` :B82=KE (70 24G): <code>${stats.activeToday || 0}</code>\n`;
    message += ` :B82=KE (70 =545;N): <code>${stats.activeWeek || 0}</code>\n`;
    message += ` ! 45?>78B0<8: <code>${stats.withDeposits || 0}</code>\n`;
    message += ` 01;>:8@>20==KE: <code>${stats.blocked || 0}</code>\n\n`;
    
    if (stats.averageBalance) {
      message += `=° !@54=89 10;0=A: <code>${stats.averageBalance.toFixed(2)} USDT</code>\n`;
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('H81:0 ?>;CG5=8O AB0B8AB8:8 ?>;L7>20B5;59:', error);
    await ctx.reply('L H81:0 ?>;CG5=8O AB0B8AB8:8 ?>;L7>20B5;59');
  }
}

async function showGameStats(ctx) {
  try {
    const response = await axios.get(`${config.apiUrl}/admin/finance/report`, {
      headers: { 'Authorization': `Bearer ${config.adminToken}` },
      timeout: 10000
    });
    
    const { allTime } = response.data.data;
    
    let message = '<® <b>!""!"  </b>\n\n';
    
    if (allTime.gameStats) {
      Object.entries(allTime.gameStats).forEach(([game, stats]) => {
        const gameNames = {
          coin: '>™ >=5B:0',
          mines: '=£ 8=K',
          slots: '<° !;>BK',
          crash: '=€ @0H',
          events: '½ !>1KB8O'
        };
        
        if (stats.totalGames > 0) {
          message += `${gameNames[game] || game}\n`;
          message += ` 3@: <code>${stats.totalGames}</code>\n`;
          message += ` !B02>:: <code>${stats.totalBets.toFixed(2)} USDT</code>\n`;
          message += ` K?;0B: <code>${stats.totalWins.toFixed(2)} USDT</code>\n`;
          message += ` @81K;L: <code>${stats.profit.toFixed(2)} USDT</code>\n`;
          
          if (stats.totalBets > 0) {
            const rtp = ((stats.totalWins / stats.totalBets) * 100);
            message += ` RTP: <code>${rtp.toFixed(1)}%</code>\n\n`;
          } else {
            message += '\n';
          }
        }
      });
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('H81:0 ?>;CG5=8O AB0B8AB8:8 83@:', error);
    await ctx.reply('L H81:0 ?>;CG5=8O AB0B8AB8:8 83@');
  }
}

module.exports = statsCommand;