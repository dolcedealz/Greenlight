// ИСЧЕРПЫВАЮЩИЙ АУДИТ ВСЕЙ СИСТЕМЫ GREENLIGHT CASINO
const { 
  User, Game, Transaction, ReferralEarning, ReferralPayout, 
  EventBet, CrashRound, DuelRound, Duel, Event, Promocode,
  CasinoFinance, GameSettings, Deposit, Withdrawal 
} = require('./src/models');
const mongoose = require('mongoose');

async function ultimateSystemAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено\n');
    
    console.log('🔍 === ИСЧЕРПЫВАЮЩИЙ АУДИТ СИСТЕМЫ GREENLIGHT === 🔍\n');
    
    const auditResults = {
      criticalIssues: [],
      warnings: [],
      statistics: {},
      balanceDiscrepancies: [],
      orphanedRecords: [],
      dataInconsistencies: []
    };
    
    // ==========================================
    // 1. БАЗОВАЯ СТАТИСТИКА СИСТЕМЫ
    // ==========================================
    console.log('=== 1. БАЗОВАЯ СТАТИСТИКА ===');
    
    const stats = {
      users: await User.countDocuments(),
      games: await Game.countDocuments(),
      transactions: await Transaction.countDocuments(),
      referralEarnings: await ReferralEarning.countDocuments(),
      referralPayouts: await ReferralPayout.countDocuments(),
      eventBets: await EventBet.countDocuments(),
      events: await Event.countDocuments(),
      duels: await Duel.countDocuments(),
      crashRounds: await CrashRound.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments()
    };
    
    auditResults.statistics = stats;
    
    console.log(`👥 Пользователей: ${stats.users}`);
    console.log(`🎮 Игр: ${stats.games}`);
    console.log(`💰 Транзакций: ${stats.transactions}`);
    console.log(`🤝 Реферальных начислений: ${stats.referralEarnings}`);
    console.log(`💸 Реферальных выплат: ${stats.referralPayouts}`);
    console.log(`🎯 Ставок на события: ${stats.eventBets}`);
    console.log(`📅 События: ${stats.events}`);
    console.log(`⚔️  Дуэли: ${stats.duels}`);
    console.log(`💥 Краш раундов: ${stats.crashRounds}`);
    console.log(`💳 Депозитов: ${stats.deposits}`);
    console.log(`🏦 Выводов: ${stats.withdrawals}`);
    
    // ==========================================
    // 2. ДЕТАЛЬНЫЙ АУДИТ КАЖДОГО ПОЛЬЗОВАТЕЛЯ
    // ==========================================
    console.log('\n\n=== 2. ДЕТАЛЬНЫЙ АУДИТ ПОЛЬЗОВАТЕЛЕЙ ===');
    
    const allUsers = await User.find({}).sort({ createdAt: 1 });
    
    for (const user of allUsers) {
      console.log(`\n👤 АУДИТ: ${user.username || user.telegramId} (ID: ${user._id})`);
      
      const userAudit = {
        userId: user._id,
        username: user.username || user.telegramId,
        issues: [],
        calculations: {}
      };
      
      // === ТРАНЗАКЦИИ ===
      const transactions = await Transaction.find({ user: user._id }).sort({ createdAt: 1 });
      const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      
      // === ИГРЫ ===
      const games = await Game.find({ user: user._id }).sort({ createdAt: 1 });
      const gameStats = games.reduce((acc, game) => {
        acc.totalGames += 1;
        acc.totalWagered += game.bet;
        if (game.win) {
          acc.totalWon += game.bet + game.profit; // Полная сумма возврата
          acc.wins += 1;
        }
        acc.totalProfit += game.profit;
        return acc;
      }, { totalGames: 0, totalWagered: 0, totalWon: 0, totalProfit: 0, wins: 0 });
      
      // === ДЕПОЗИТЫ И ВЫВОДЫ ===
      const deposits = await Deposit.find({ user: user._id });
      const withdrawals = await Withdrawal.find({ user: user._id });
      const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
      
      // === РЕФЕРАЛЬНАЯ СИСТЕМА ===
      const referralEarnings = await ReferralEarning.find({ partner: user._id });
      const referralPayouts = await ReferralPayout.find({ partner: user._id });
      const totalReferralEarned = referralEarnings.reduce((sum, e) => sum + (e.calculation?.earnedAmount || 0), 0);
      const totalReferralPaid = referralPayouts.reduce((sum, p) => sum + p.amount, 0);
      
      // === РАСЧЕТ ОЖИДАЕМОГО БАЛАНСА ===
      // Начальный баланс из первой транзакции или 0
      let initialBalance = 0;
      if (transactions.length > 0) {
        const firstTx = transactions[0];
        if (firstTx.balanceBefore > 0 && firstTx.type !== 'deposit') {
          initialBalance = firstTx.balanceBefore;
          if (firstTx.amount < 0) initialBalance += Math.abs(firstTx.amount);
        }
      }
      
      const expectedBalance = initialBalance + transactionBalance;
      const balanceDifference = user.balance - expectedBalance;
      
      userAudit.calculations = {
        currentBalance: user.balance,
        initialBalance,
        transactionBalance,
        expectedBalance,
        balanceDifference,
        totalDeposits,
        totalWithdrawals,
        gameStats,
        referralStats: {
          earned: totalReferralEarned,
          paid: totalReferralPaid,
          balance: user.referralStats?.referralBalance || 0
        }
      };
      
      // === ПРОВЕРКИ И ВЫЯВЛЕНИЕ ПРОБЛЕМ ===
      
      // 1. Критические проблемы с балансом
      if (Math.abs(balanceDifference) > 0.01) {
        const issue = `Баланс не сходится: ${user.balance} != ${expectedBalance.toFixed(2)} (разница: ${balanceDifference.toFixed(2)})`;
        userAudit.issues.push(issue);
        if (Math.abs(balanceDifference) > 50) {
          auditResults.criticalIssues.push(`${user.username || user.telegramId}: ${issue}`);
        } else {
          auditResults.warnings.push(`${user.username || user.telegramId}: ${issue}`);
        }
      }
      
      // 2. Подозрительные балансы без активности
      if (user.balance > 50 && gameStats.totalGames === 0 && totalDeposits === 0) {
        const issue = `Подозрительный баланс ${user.balance} USDT без игр и депозитов`;
        userAudit.issues.push(issue);
        auditResults.criticalIssues.push(`${user.username || user.telegramId}: ${issue}`);
      }
      
      // 3. Несоответствие статистики игр
      if (user.totalGames !== gameStats.totalGames || 
          Math.abs(user.totalWagered - gameStats.totalWagered) > 0.01 ||
          Math.abs(user.totalWon - gameStats.totalWon) > 0.01) {
        const issue = `Статистика игр не сходится: модель(${user.totalGames}/${user.totalWagered}/${user.totalWon}) != факт(${gameStats.totalGames}/${gameStats.totalWagered}/${gameStats.totalWon})`;
        userAudit.issues.push(issue);
        auditResults.dataInconsistencies.push(`${user.username || user.telegramId}: ${issue}`);
      }
      
      // 4. Реферальные проблемы
      if (Math.abs((user.referralStats?.totalEarned || 0) - totalReferralEarned) > 0.01) {
        const issue = `Реферальные начисления не сходятся: модель(${user.referralStats?.totalEarned || 0}) != факт(${totalReferralEarned.toFixed(2)})`;
        userAudit.issues.push(issue);
        auditResults.dataInconsistencies.push(`${user.username || user.telegramId}: ${issue}`);
      }
      
      // 5. Отрицательные балансы
      if (user.balance < 0) {
        const issue = `Отрицательный баланс: ${user.balance}`;
        userAudit.issues.push(issue);
        auditResults.criticalIssues.push(`${user.username || user.telegramId}: ${issue}`);
      }
      
      // === ДЕТАЛЬНЫЙ ВЫВОД ДЛЯ ПРОБЛЕМНЫХ ПОЛЬЗОВАТЕЛЕЙ ===
      if (userAudit.issues.length > 0) {
        console.log(`   ❌ ПРОБЛЕМЫ (${userAudit.issues.length}):`);
        userAudit.issues.forEach(issue => console.log(`      - ${issue}`));
        
        console.log(`   📊 ДЕТАЛИ:`);
        console.log(`      Баланс: ${user.balance} USDT`);
        console.log(`      Начальный: ${initialBalance} USDT`);
        console.log(`      Транзакций: ${transactions.length} (сумма: ${transactionBalance.toFixed(2)})`);
        console.log(`      Игр: ${gameStats.totalGames} (ставок: ${gameStats.totalWagered}, выигрышей: ${gameStats.totalWon})`);
        console.log(`      Депозиты: ${totalDeposits} USDT`);
        console.log(`      Выводы: ${totalWithdrawals} USDT`);
        
        // Показываем первые транзакции
        if (transactions.length > 0) {
          console.log(`      Первые транзакции:`);
          transactions.slice(0, 3).forEach((tx, i) => {
            console.log(`        ${i+1}. ${tx.type}: ${tx.amount} USDT (${tx.balanceBefore} → ${tx.balanceAfter}) ${tx.createdAt.toISOString().split('T')[0]}`);
          });
        }
        
        auditResults.balanceDiscrepancies.push(userAudit);
      } else {
        console.log(`   ✅ Все проверки пройдены`);
      }
    }
    
    // ==========================================
    // 3. АУДИТ ЦЕЛОСТНОСТИ ДАННЫХ
    // ==========================================
    console.log('\n\n=== 3. АУДИТ ЦЕЛОСТНОСТИ ДАННЫХ ===');
    
    // === ИГРЫ БЕЗ ПОЛЬЗОВАТЕЛЕЙ ===
    const orphanGames = await Game.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $match: { userDoc: { $size: 0 } } },
      { $count: 'count' }
    ]);
    
    if (orphanGames[0]?.count > 0) {
      auditResults.orphanedRecords.push(`Игр без пользователей: ${orphanGames[0].count}`);
      console.log(`❌ Игр без пользователей: ${orphanGames[0].count}`);
    }
    
    // === ТРАНЗАКЦИИ БЕЗ ПОЛЬЗОВАТЕЛЕЙ ===
    const orphanTransactions = await Transaction.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $match: { userDoc: { $size: 0 } } },
      { $count: 'count' }
    ]);
    
    if (orphanTransactions[0]?.count > 0) {
      auditResults.orphanedRecords.push(`Транзакций без пользователей: ${orphanTransactions[0].count}`);
      console.log(`❌ Транзакций без пользователей: ${orphanTransactions[0].count}`);
    }
    
    // === ИГРЫ БЕЗ СВЯЗАННЫХ ТРАНЗАКЦИЙ ===
    const gamesWithoutTransactions = await Game.aggregate([
      {
        $lookup: {
          from: 'transactions',
          localField: '_id',
          foreignField: 'game',
          as: 'transactions'
        }
      },
      { $match: { transactions: { $size: 0 } } },
      { $count: 'count' }
    ]);
    
    if (gamesWithoutTransactions[0]?.count > 0) {
      auditResults.orphanedRecords.push(`Игр без транзакций: ${gamesWithoutTransactions[0].count}`);
      console.log(`⚠️  Игр без транзакций: ${gamesWithoutTransactions[0].count}`);
    }
    
    // === ВЫИГРЫШНЫЕ ИГРЫ БЕЗ WIN ТРАНЗАКЦИЙ ===
    const winGamesWithoutWinTransactions = await Game.aggregate([
      { $match: { win: true } },
      {
        $lookup: {
          from: 'transactions',
          let: { gameId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$game', '$$gameId'] },
              { $eq: ['$type', 'win'] }
            ]}}}
          ],
          as: 'winTransactions'
        }
      },
      { $match: { winTransactions: { $size: 0 } } },
      { $count: 'count' }
    ]);
    
    if (winGamesWithoutWinTransactions[0]?.count > 0) {
      auditResults.orphanedRecords.push(`Выигрышных игр без win транзакций: ${winGamesWithoutWinTransactions[0].count}`);
      console.log(`❌ Выигрышных игр без win транзакций: ${winGamesWithoutWinTransactions[0].count}`);
    }
    
    // ==========================================
    // 4. АУДИТ МАТЕМАТИЧЕСКОЙ ЦЕЛОСТНОСТИ
    // ==========================================
    console.log('\n\n=== 4. АУДИТ МАТЕМАТИЧЕСКОЙ ЦЕЛОСТНОСТИ ===');
    
    // === ПРОВЕРКА БАЛАНСОВ В ИГРАХ ===
    const gamesWithWrongBalance = await Game.aggregate([
      {
        $addFields: {
          expectedBalanceAfter: { $add: ['$balanceBefore', '$profit'] }
        }
      },
      {
        $match: {
          $expr: {
            $gt: [
              { $abs: { $subtract: ['$balanceAfter', '$expectedBalanceAfter'] } },
              0.01
            ]
          }
        }
      },
      { $count: 'count' }
    ]);
    
    if (gamesWithWrongBalance[0]?.count > 0) {
      auditResults.dataInconsistencies.push(`Игр с неправильной математикой баланса: ${gamesWithWrongBalance[0].count}`);
      console.log(`❌ Игр с неправильной математикой баланса: ${gamesWithWrongBalance[0].count}`);
    }
    
    // === ПРОВЕРКА ТРАНЗАКЦИЙ ===
    const transactionsWithWrongBalance = await Transaction.aggregate([
      {
        $match: {
          $expr: {
            $gt: [
              { $abs: { $subtract: ['$balanceAfter', { $add: ['$balanceBefore', '$amount'] }] } },
              0.01
            ]
          }
        }
      },
      { $count: 'count' }
    ]);
    
    if (transactionsWithWrongBalance[0]?.count > 0) {
      auditResults.dataInconsistencies.push(`Транзакций с неправильной математикой: ${transactionsWithWrongBalance[0].count}`);
      console.log(`❌ Транзакций с неправильной математикой: ${transactionsWithWrongBalance[0].count}`);
    }
    
    // ==========================================
    // 5. ОБЩИЕ ФИНАНСОВЫЕ ПОКАЗАТЕЛИ
    // ==========================================
    console.log('\n\n=== 5. ОБЩИЕ ФИНАНСОВЫЕ ПОКАЗАТЕЛИ ===');
    
    const financialStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUserBalance: { $sum: '$balance' },
          totalReferralBalance: { $sum: '$referralStats.referralBalance' },
          totalEarned: { $sum: '$referralStats.totalEarned' },
          usersWithBalance: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
          usersWithNegativeBalance: { $sum: { $cond: [{ $lt: ['$balance', 0] }, 1, 0] } }
        }
      }
    ]);
    
    const totalGameProfit = await Game.aggregate([
      { $group: { _id: null, totalProfit: { $sum: '$profit' } } }
    ]);
    
    const fs = financialStats[0] || {};
    const gameProfit = totalGameProfit[0]?.totalProfit || 0;
    
    console.log(`💰 Общий баланс пользователей: ${(fs.totalUserBalance || 0).toFixed(2)} USDT`);
    console.log(`🤝 Общий реферальный баланс: ${(fs.totalReferralBalance || 0).toFixed(2)} USDT`);
    console.log(`📈 Общая прибыль/убыток от игр: ${gameProfit.toFixed(2)} USDT`);
    console.log(`👥 Пользователей с балансом: ${fs.usersWithBalance || 0}`);
    console.log(`❌ Пользователей с отрицательным балансом: ${fs.usersWithNegativeBalance || 0}`);
    
    // ==========================================
    // 6. ИТОГОВЫЙ ОТЧЕТ
    // ==========================================
    console.log('\n\n🎯 === ИТОГОВЫЙ ОТЧЕТ АУДИТА ===');
    
    console.log(`\n🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (${auditResults.criticalIssues.length}):`);
    auditResults.criticalIssues.forEach(issue => console.log(`   ❌ ${issue}`));
    
    console.log(`\n🟡 ПРЕДУПРЕЖДЕНИЯ (${auditResults.warnings.length}):`);
    auditResults.warnings.forEach(warning => console.log(`   ⚠️  ${warning}`));
    
    console.log(`\n🔵 ПРОБЛЕМЫ ЦЕЛОСТНОСТИ ДАННЫХ (${auditResults.dataInconsistencies.length}):`);
    auditResults.dataInconsistencies.forEach(issue => console.log(`   📊 ${issue}`));
    
    console.log(`\n🗑️  СИРОТСКИЕ ЗАПИСИ (${auditResults.orphanedRecords.length}):`);
    auditResults.orphanedRecords.forEach(issue => console.log(`   🗃️  ${issue}`));
    
    console.log(`\n📈 ОБЩЕЕ СОСТОЯНИЕ СИСТЕМЫ:`);
    const totalIssues = auditResults.criticalIssues.length + auditResults.warnings.length + 
                       auditResults.dataInconsistencies.length + auditResults.orphanedRecords.length;
    
    if (totalIssues === 0) {
      console.log(`   ✅ Система в отличном состоянии! Проблем не обнаружено.`);
    } else if (auditResults.criticalIssues.length === 0) {
      console.log(`   🟡 Система в хорошем состоянии. Есть ${totalIssues} незначительных проблем.`);
    } else {
      console.log(`   🔴 Система требует внимания! Обнаружено ${auditResults.criticalIssues.length} критических проблем.`);
    }
    
    console.log('\n✅ Исчерпывающий аудит завершен');
    
    return auditResults;
    
  } catch (error) {
    console.error('❌ Критическая ошибка при аудите:', error);
    throw error;
  } finally {
    mongoose.disconnect();
  }
}

ultimateSystemAudit().catch(console.error);