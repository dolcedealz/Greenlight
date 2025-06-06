// admin/src/commands/users.command.js
const { Markup } = require('telegraf');
const axios = require('axios');

// >;CG05< API URL 8 B>:5= 87 ?5@5<5==KE >:@C65=8O
const apiUrl = process.env.API_URL || 'https://greenlight-api-ghqh.onrender.com/api';
const adminToken = process.env.ADMIN_API_TOKEN;

// !>7405< axios instance A ?@54CAB0=>2;5==K<8 703>;>2:0<8
const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * >:070BL A?8A>: ?>;L7>20B5;59
 */
async function showUsersList(ctx, page = 1) {
  console.log('ADMIN: 0?@>A A?8A:0 ?>;L7>20B5;59, AB@0=8F0:', page);
  
  try {
    const response = await apiClient.get('/admin/users', {
      params: { 
        page: page,
        limit: 10
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'H81:0 ?>;CG5=8O ?>;L7>20B5;59');
    }
    
    const data = response.data.data;
    const users = data.users;
    const pagination = data.pagination;
    
    if (users.length === 0) {
      const message = '=e *!?8A>: ?>;L7>20B5;59*\n\n>;L7>20B5;8 =5 =0945=K.';
      const keyboard = Markup.inlineKeyboard([[
        Markup.button.callback('À 0704', 'users_menu')
      ]]);
      
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
      return;
    }
    
    let message = `=e *!?8A>: ?>;L7>20B5;59* (AB@. ${pagination.current}/${pagination.pages})\n\n`;
    
    users.forEach((user, index) => {
      const userNum = (pagination.current - 1) * 10 + index + 1;
      const statusEmoji = user.isBlocked ? '=«' : '';
      const username = user.username ? `@${user.username}` : '5B username';
      
      message += `${userNum}. ${statusEmoji} *${user.firstName} ${user.lastName || ''}*\n`;
      message += `   ${username}\n`;
      message += `   =° 0;0=A: ${user.balance.toFixed(2)} USDT\n`;
      message += `   =Ê @81K;L: ${((user.totalWon || 0) - (user.totalWagered || 0)).toFixed(2)} USDT\n`;
      message += `   <® 3@: ${user.totalGames || 0}\n`;
      message += `   =Å  538AB@0F8O: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}\n\n`;
    });
    
    // !>7405< :;0280BC@C A :=>?:0<8 =02830F88 8 459AB28O<8
    const buttons = [];
    
    // =>?:8 =02830F88
    if (pagination.current > 1 || pagination.current < pagination.pages) {
      const navButtons = [];
      if (pagination.current > 1) {
        navButtons.push(Markup.button.callback(' @54.', `users_list_${pagination.current - 1}`));
      }
      if (pagination.current < pagination.pages) {
        navButtons.push(Markup.button.callback('!;54. ¡', `users_list_${pagination.current + 1}`));
      }
      buttons.push(navButtons);
    }
    
    // A=>2=K5 459AB28O
    buttons.push([
      Markup.button.callback('= >8A:', 'users_search'),
      Markup.button.callback('=Ê !B0B8AB8:0', 'users_stats')
    ]);
    
    buttons.push([Markup.button.callback('= 1=>28BL', 'users_list')]);
    buttons.push([Markup.button.callback('À 0704', 'users_menu')]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
    
  } catch (error) {
    console.error('ADMIN: H81:0 ?>;CG5=8O A?8A:0 ?>;L7>20B5;59:', error);
    const errorMessage = `L H81:0 ?>;CG5=8O ?>;L7>20B5;59: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * 0G0BL ?>8A: ?>;L7>20B5;O
 */
async function startUserSearch(ctx) {
  console.log('ADMIN: 0G0;> ?>8A:0 ?>;L7>20B5;O');
  
  ctx.session = ctx.session || {};
  ctx.session.searchingUser = {
    step: 'query'
  };
  
  const message = '= *>8A: ?>;L7>20B5;O*\n\n2548B5:\n" Telegram ID\n" Username (157 @)\n" <O 8;8 D0<8;8N\n" Email';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('L B<5=0', 'users_search_cancel')
  ]]);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  }
}

/**
 * 1@01>B0BL ?>8A: ?>;L7>20B5;O
 */
async function handleUserSearch(ctx) {
  if (!ctx.session || !ctx.session.searchingUser) {
    return;
  }
  
  const query = ctx.message.text.trim();
  console.log('ADMIN: >8A: ?>;L7>20B5;O ?> 70?@>AC:', query);
  
  try {
    const response = await apiClient.get('/admin/users', {
      params: { 
        search: query,
        limit: 20
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'H81:0 ?>8A:0');
    }
    
    const users = response.data.data.users;
    
    if (users.length === 0) {
      await ctx.reply(
        'L >;L7>20B5;8 =5 =0945=K.\n\n>?@>1C9B5 4@C3>9 70?@>A:',
        Markup.inlineKeyboard([[
          Markup.button.callback('L B<5=0', 'users_search_cancel')
        ]])
      );
      return;
    }
    
    let message = `= * 57C;LB0BK ?>8A:0* (=0945=>: ${users.length})\n\n`;
    
    const buttons = [];
    
    users.slice(0, 10).forEach((user, index) => {
      const statusEmoji = user.isBlocked ? '=«' : '';
      const username = user.username ? `@${user.username}` : '5B username';
      
      message += `${index + 1}. ${statusEmoji} *${user.firstName} ${user.lastName || ''}*\n`;
      message += `   ${username} | ID: \`${user.telegramId}\`\n`;
      message += `   =° ${user.balance.toFixed(2)} USDT | `;
      message += `<® ${user.totalGames || 0} 83@\n\n`;
      
      // >102;O5< :=>?:C 4;O ?@>A<>B@0 45B0;59 ?>;L7>20B5;O
      buttons.push([Markup.button.callback(
        `=d ${user.firstName} ${user.lastName || ''}`, 
        `user_details_${user._id}`
      )]);
    });
    
    if (users.length > 10) {
      message += `\n... 8 5I5 ${users.length - 10} ?>;L7>20B5;59`;
    }
    
    buttons.push([
      Markup.button.callback('= >2K9 ?>8A:', 'users_search'),
      Markup.button.callback('À 0704', 'users_menu')
    ]);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
    
    // G8I05< A5AA8N ?>8A:0
    delete ctx.session.searchingUser;
    
  } catch (error) {
    console.error('ADMIN: H81:0 ?>8A:0 ?>;L7>20B5;O:', error);
    await ctx.reply(`L H81:0 ?>8A:0: ${error.message}`);
  }
}

/**
 * >:070BL 45B0;8 ?>;L7>20B5;O
 */
async function showUserDetails(ctx, userId) {
  console.log('ADMIN: 0?@>A 45B0;59 ?>;L7>20B5;O:', userId);
  
  try {
    const response = await apiClient.get(`/admin/users/${userId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || '>;L7>20B5;L =5 =0945=');
    }
    
    const data = response.data.data;
    const user = data.user;
    const gameStats = data.gameStats || [];
    const recentTransactions = data.recentTransactions || [];
    
    let message = `=d *@>D8;L ?>;L7>20B5;O*\n\n`;
    message += `**A=>2=0O 8=D>@<0F8O:**\n`;
    message += `$: ${user.firstName} ${user.lastName || ''}\n`;
    message += `Username: ${user.username ? `@${user.username}` : '5 C:070='}\n`;
    message += `Telegram ID: \`${user.telegramId}\`\n`;
    message += ` >;L: ${user.role === 'admin' ? '=Q 4<8=8AB@0B>@' : '=d >;L7>20B5;L'}\n`;
    message += `!B0BCA: ${user.isBlocked ? '=« 01;>:8@>20=' : ' :B825='}\n\n`;
    
    message += `**$8=0=AK:**\n`;
    message += `=° 0;0=A: ${user.balance.toFixed(2)} USDT\n`;
    message += `=È A53> ?>AB02;5=>: ${user.totalWagered.toFixed(2)} USDT\n`;
    message += `=É A53> 2K83@0=>: ${user.totalWon.toFixed(2)} USDT\n`;
    message += `=Ê @81K;L/C1KB>:: ${(user.totalWon - user.totalWagered).toFixed(2)} USDT\n\n`;
    
    if (gameStats.length > 0) {
      message += `**!B0B8AB8:0 ?> 83@0<:**\n`;
      gameStats.forEach(stat => {
        const gameEmoji = {
          'coin': '>™',
          'crash': '=€',
          'slots': '<°',
          'mines': '=£'
        }[stat._id] || '<®';
        
        message += `${gameEmoji} ${stat._id}: ${stat.totalGames} 83@, `;
        message += `${stat.totalBet.toFixed(2)} USDT AB02>:\n`;
      });
      message += '\n';
    }
    
    message += `** 5D5@0;L=0O ?@>3@0<<0:**\n`;
    if (user.referralStats) {
      message += `<Æ #@>25=L: ${user.referralStats.level}\n`;
      message += `=e  5D5@0;>2: ${user.referralStats.totalReferrals}\n`;
      message += `=µ 0@01>B0=>: ${user.referralStats.totalEarned.toFixed(2)} USDT\n`;
      message += `<æ 0;0=A @5D5@0;:8: ${user.referralStats.referralBalance.toFixed(2)} USDT\n\n`;
    }
    
    message += `**0BK:**\n`;
    message += `=Å  538AB@0F8O: ${new Date(user.createdAt).toLocaleString('ru-RU')}\n`;
    message += `ð >A;54=OO 0:B82=>ABL: ${new Date(user.lastActivity).toLocaleString('ru-RU')}`;
    
    const buttons = [
      [
        Markup.button.callback(
          user.isBlocked ? '  071;>:8@>20BL' : '=« 01;>:8@>20BL', 
          `user_toggle_block_${user._id}`
        ),
        Markup.button.callback('=° 7<5=8BL 10;0=A', `user_balance_${user._id}`)
      ],
      [
        Markup.button.callback('<¯ >48D8:0B>@K', `user_modifiers_${user._id}`),
        Markup.button.callback('=Ü "@0=70:F88', `user_transactions_${user._id}`)
      ],
      [Markup.button.callback('= 1=>28BL', `user_details_${user._id}`)],
      [Markup.button.callback('À  ?>8A:C', 'users_search')]
    ];
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    }
    
  } catch (error) {
    console.error('ADMIN: H81:0 ?>;CG5=8O 45B0;59 ?>;L7>20B5;O:', error);
    const errorMessage = `L H81:0: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * >:070BL AB0B8AB8:C ?>;L7>20B5;59
 */
async function showUsersStats(ctx) {
  console.log('ADMIN: 0?@>A AB0B8AB8:8 ?>;L7>20B5;59');
  
  try {
    // >;CG05< >1ICN AB0B8AB8:C
    const response = await apiClient.get('/admin/stats');
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'H81:0 ?>;CG5=8O AB0B8AB8:8');
    }
    
    const stats = response.data.data;
    
    let message = '=Ê *!B0B8AB8:0 ?>;L7>20B5;59*\n\n';
    
    message += `**1I0O 8=D>@<0F8O:**\n`;
    message += `=e A53> ?>;L7>20B5;59: ${stats.totalUsers || 0}\n`;
    message += ` :B82=KE: ${stats.activeUsers || 0}\n`;
    message += `=« 01;>:8@>20==KE: ${stats.blockedUsers || 0}\n`;
    message += `=Q 4<8=8AB@0B>@>2: ${stats.adminUsers || 0}\n\n`;
    
    message += `**:B82=>ABL:**\n`;
    message += `=È >2KE 70 ACB:8: ${stats.newUsersToday || 0}\n`;
    message += `=Ê >2KE 70 =545;N: ${stats.newUsersWeek || 0}\n`;
    message += `<® 3@0;8 A53>4=O: ${stats.playedToday || 0}\n`;
    message += `=° !45;0;8 45?>78B: ${stats.usersWithDeposits || 0}\n\n`;
    
    message += `**$8=0=AK:**\n`;
    message += `=µ 1I89 10;0=A 2A5E ?>;L7>20B5;59: ${(stats.totalUserBalances || 0).toFixed(2)} USDT\n`;
    message += `=È !@54=89 10;0=A: ${((stats.totalUserBalances || 0) / (stats.totalUsers || 1)).toFixed(2)} USDT\n`;
    message += `<° 1I89 >1J5< AB02>:: ${(stats.totalWagered || 0).toFixed(2)} USDT\n`;
    message += `<Æ 1I85 2K83@KH8: ${(stats.totalWon || 0).toFixed(2)} USDT`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('= 1=>28BL', 'users_stats')],
      [Markup.button.callback('À 0704', 'users_menu')]
    ]);
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
    
  } catch (error) {
    console.error('ADMIN: H81:0 ?>;CG5=8O AB0B8AB8:8 ?>;L7>20B5;59:', error);
    const errorMessage = `L H81:0 ?>;CG5=8O AB0B8AB8:8: ${error.message}`;
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage);
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * 5@5:;NG8BL 1;>:8@>2:C ?>;L7>20B5;O
 */
async function toggleUserBlock(ctx, userId) {
  console.log('ADMIN: 5@5:;NG5=85 1;>:8@>2:8 ?>;L7>20B5;O:', userId);
  
  try {
    const response = await apiClient.post(`/admin/users/${userId}/block`);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'H81:0 87<5=5=8O AB0BCA0');
    }
    
    const result = response.data.data;
    const status = result.isBlocked ? '701;>:8@>20=' : '@071;>:8@>20=';
    
    await ctx.answerCbQuery(` >;L7>20B5;L ${status}`);
    
    // 1=>2;O5< 8=D>@<0F8N > ?>;L7>20B5;5
    await showUserDetails(ctx, userId);
    
  } catch (error) {
    console.error('ADMIN: H81:0 ?5@5:;NG5=8O 1;>:8@>2:8:', error);
    await ctx.answerCbQuery(`L H81:0: ${error.message}`);
  }
}

/**
 * 0G0BL 87<5=5=85 10;0=A0 ?>;L7>20B5;O
 */
async function startBalanceAdjustment(ctx, userId) {
  console.log('ADMIN: 0G0;> 87<5=5=8O 10;0=A0 ?>;L7>20B5;O:', userId);
  
  ctx.session = ctx.session || {};
  ctx.session.adjustingBalance = {
    userId: userId,
    step: 'amount'
  };
  
  const message = '=° *7<5=5=85 10;0=A0 ?>;L7>20B5;O*\n\n2548B5 AC<<C 87<5=5=8O:\n\n" >;>68B5;L=>5 G8A;> 4;O =0G8A;5=8O\n" B@8F0B5;L=>5 G8A;> 4;O A?8A0=8O\n\n@8<5@: +100 8;8 -50';
  const keyboard = Markup.inlineKeyboard([[
    Markup.button.callback('L B<5=0', `user_details_${userId}`)
  ]]);
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...keyboard
  });
}

/**
 * 1@01>B0BL 87<5=5=85 10;0=A0
 */
async function handleBalanceAdjustment(ctx) {
  if (!ctx.session || !ctx.session.adjustingBalance) {
    return;
  }
  
  const session = ctx.session.adjustingBalance;
  const text = ctx.message.text.trim();
  
  if (session.step === 'amount') {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount === 0) {
      await ctx.reply('L 2548B5 :>@@5:B=CN AC<<C (G8A;>, =5 @02=>5 =C;N):');
      return;
    }
    
    session.amount = amount;
    session.step = 'reason';
    
    await ctx.reply(
      `=° !C<<0: ${amount > 0 ? '+' : ''}${amount.toFixed(2)} USDT\n\n"5?5@L 22548B5 ?@8G8=C 87<5=5=8O:`,
      Markup.inlineKeyboard([[
        Markup.button.callback('L B<5=0', `user_details_${session.userId}`)
      ]])
    );
    
  } else if (session.step === 'reason') {
    const reason = text;
    
    if (reason.length < 5) {
      await ctx.reply('L @8G8=0 4>;6=0 A>45@60BL <8=8<C< 5 A8<2>;>2:');
      return;
    }
    
    try {
      const response = await apiClient.post(`/admin/users/${session.userId}/balance`, {
        amount: session.amount,
        reason: reason
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'H81:0 87<5=5=8O 10;0=A0');
      }
      
      const result = response.data.data;
      
      await ctx.reply(
        ` *0;0=A 87<5=5= CA?5H=>!*\n\n` +
        `=° K;>: ${result.oldBalance.toFixed(2)} USDT\n` +
        `=° !B0;>: ${result.newBalance.toFixed(2)} USDT\n` +
        `=Ý 7<5=5=85: ${result.adjustment > 0 ? '+' : ''}${result.adjustment.toFixed(2)} USDT\n` +
        `=Ë @8G8=0: ${reason}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('=d  ?@>D8;N', `user_details_${session.userId}`)
          ]])
        }
      );
      
      delete ctx.session.adjustingBalance;
      
    } catch (error) {
      console.error('ADMIN: H81:0 87<5=5=8O 10;0=A0:', error);
      await ctx.reply(`L H81:0 87<5=5=8O 10;0=A0: ${error.message}`);
    }
  }
}

module.exports = {
  showUsersList,
  startUserSearch,
  handleUserSearch,
  showUserDetails,
  showUsersStats,
  toggleUserBlock,
  startBalanceAdjustment,
  handleBalanceAdjustment
};