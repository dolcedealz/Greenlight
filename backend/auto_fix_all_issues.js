// АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ВСЕХ ВЫЯВЛЕННЫХ ПРОБЛЕМ
const { 
  User, Game, Transaction, ReferralEarning, ReferralPayout,
  EventBet, CrashRound, DuelRound, Duel, Event 
} = require('./src/models');
const mongoose = require('mongoose');

async function autoFixAllIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено\n');
    
    console.log('🔧 === АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ ===\n');
    
    const fixResults = {
      balancesFixed: 0,
      statisticsFixed: 0,
      transactionsFixed: 0,
      referralsFixed: 0,
      orphansRemoved: 0,
      mathErrorsFixed: 0,
      suspiciousAccountsFound: []
    };
    
    // ==========================================
    // 1. ИСПРАВЛЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЕЙ
    // ==========================================
    console.log('=== 1. ИСПРАВЛЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЕЙ ===');
    
    const allUsers = await User.find({});
    
    for (const user of allUsers) {
      // Подсчитываем правильную статистику из игр
      const games = await Game.find({ user: user._id });
      const gameStats = games.reduce((acc, game) => {
        acc.totalGames += 1;
        acc.totalWagered += game.bet;
        if (game.win) {
          acc.totalWon += game.bet + game.profit;
          acc.wins += 1;
        }
        acc.totalProfit += game.profit;
        return acc;
      }, { totalGames: 0, totalWagered: 0, totalWon: 0, totalProfit: 0, wins: 0 });
      
      // Проверяем, нужно ли обновление статистики
      const statsNeedUpdate = (
        user.totalGames !== gameStats.totalGames ||
        Math.abs(user.totalWagered - gameStats.totalWagered) > 0.01 ||
        Math.abs(user.totalWon - gameStats.totalWon) > 0.01
      );
      
      if (statsNeedUpdate) {
        await User.findByIdAndUpdate(user._id, {
          totalGames: gameStats.totalGames,
          totalWagered: gameStats.totalWagered,
          totalWon: gameStats.totalWon
        });
        
        console.log(`✅ Исправлена статистика: ${user.username || user.telegramId}`);
        fixResults.statisticsFixed++;
      }
      
      // Исправляем балансы на основе транзакций
      const transactions = await Transaction.find({ user: user._id }).sort({ createdAt: 1 });
      const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      
      // Определяем начальный баланс
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
      
      // Исправляем только значительные расхождения (больше 0.01 USDT)
      if (Math.abs(balanceDifference) > 0.01) {
        // Для критических случаев (разница > 50 USDT) требуется ручная проверка
        if (Math.abs(balanceDifference) > 50 && gameStats.totalGames === 0) {
          fixResults.suspiciousAccountsFound.push({
            username: user.username || user.telegramId,
            currentBalance: user.balance,
            expectedBalance: expectedBalance,
            difference: balanceDifference,
            gamesPlayed: gameStats.totalGames,
            transactionsCount: transactions.length
          });
          console.log(`⚠️  ПОДОЗРИТЕЛЬНЫЙ АККАУНТ: ${user.username || user.telegramId} - баланс ${user.balance}, ожидается ${expectedBalance.toFixed(2)}`);
        } else {
          // Исправляем незначительные расхождения
          await User.findByIdAndUpdate(user._id, {
            balance: expectedBalance
          });
          
          console.log(`✅ Исправлен баланс: ${user.username || user.telegramId} (${user.balance} → ${expectedBalance.toFixed(2)})`);
          fixResults.balancesFixed++;
        }
      }
    }
    
    // ==========================================
    // 2. ИСПРАВЛЕНИЕ ТРАНЗАКЦИЙ
    // ==========================================
    console.log('\n=== 2. ИСПРАВЛЕНИЕ ТРАНЗАКЦИЙ ===');
    
    // Исправляем транзакции выигрышей с неправильными balanceBefore
    const winTransactions = await Transaction.find({ type: 'win' });
    
    for (const transaction of winTransactions) {
      const correctBalanceBefore = transaction.balanceAfter - transaction.amount;
      
      if (Math.abs(transaction.balanceBefore - correctBalanceBefore) > 0.01) {
        await Transaction.findByIdAndUpdate(transaction._id, {
          balanceBefore: correctBalanceBefore
        });
        
        fixResults.transactionsFixed++;
      }
    }
    
    // Исправляем транзакции ставок с неправильными balanceAfter
    const betTransactions = await Transaction.find({ type: 'bet' });
    
    for (const transaction of betTransactions) {
      const correctBalanceAfter = transaction.balanceBefore + transaction.amount;
      
      if (Math.abs(transaction.balanceAfter - correctBalanceAfter) > 0.01) {
        await Transaction.findByIdAndUpdate(transaction._id, {
          balanceAfter: correctBalanceAfter
        });
        
        fixResults.transactionsFixed++;
      }
    }
    
    console.log(`✅ Исправлено транзакций: ${fixResults.transactionsFixed}`);
    
    // ==========================================
    // 3. ИСПРАВЛЕНИЕ РЕФЕРАЛЬНОЙ СИСТЕМЫ
    // ==========================================
    console.log('\n=== 3. ИСПРАВЛЕНИЕ РЕФЕРАЛЬНОЙ СИСТЕМЫ ===');
    
    const partners = await User.find({ 
      $or: [
        { partnerLevel: { $ne: 'none' } },
        { 'referralStats.totalReferrals': { $gt: 0 } }
      ]
    });
    
    for (const partner of partners) {
      // Пересчитываем реферальные начисления
      const earnings = await ReferralEarning.find({ partner: partner._id });
      const totalEarnedFromDB = earnings.reduce((sum, e) => sum + (e.calculation?.earnedAmount || 0), 0);
      
      // Пересчитываем выплаты
      const payouts = await ReferralPayout.find({ partner: partner._id });
      const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
      
      const correctReferralBalance = totalEarnedFromDB - totalPaidOut;
      
      // Проверяем и исправляем статистику
      const needsReferralUpdate = (
        Math.abs((partner.referralStats?.totalEarned || 0) - totalEarnedFromDB) > 0.01 ||
        Math.abs((partner.referralStats?.referralBalance || 0) - correctReferralBalance) > 0.01 ||
        Math.abs((partner.referralStats?.totalWithdrawn || 0) - totalPaidOut) > 0.01
      );
      
      if (needsReferralUpdate) {
        await User.findByIdAndUpdate(partner._id, {
          'referralStats.totalEarned': totalEarnedFromDB,
          'referralStats.referralBalance': Math.max(0, correctReferralBalance),
          'referralStats.totalWithdrawn': totalPaidOut
        });
        
        console.log(`✅ Исправлена реферальная статистика: ${partner.username || partner.telegramId}`);
        fixResults.referralsFixed++;
      }
    }
    
    // ==========================================
    // 4. УДАЛЕНИЕ СИРОТСКИХ ЗАПИСЕЙ
    // ==========================================
    console.log('\n=== 4. ОЧИСТКА СИРОТСКИХ ЗАПИСЕЙ ===');
    
    // Удаляем игры без пользователей
    const orphanGamesResult = await Game.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $match: { userDoc: { $size: 0 } } }
    ]);
    
    if (orphanGamesResult.length > 0) {
      const orphanGameIds = orphanGamesResult.map(g => g._id);
      await Game.deleteMany({ _id: { $in: orphanGameIds } });
      console.log(`🗑️  Удалено игр без пользователей: ${orphanGamesResult.length}`);
      fixResults.orphansRemoved += orphanGamesResult.length;
    }
    
    // Удаляем транзакции без пользователей
    const orphanTransactionsResult = await Transaction.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $match: { userDoc: { $size: 0 } } }
    ]);
    
    if (orphanTransactionsResult.length > 0) {
      const orphanTxIds = orphanTransactionsResult.map(t => t._id);
      await Transaction.deleteMany({ _id: { $in: orphanTxIds } });
      console.log(`🗑️  Удалено транзакций без пользователей: ${orphanTransactionsResult.length}`);
      fixResults.orphansRemoved += orphanTransactionsResult.length;
    }
    
    // ==========================================
    // 5. ИСПРАВЛЕНИЕ МАТЕМАТИЧЕСКИХ ОШИБОК
    // ==========================================
    console.log('\n=== 5. ИСПРАВЛЕНИЕ МАТЕМАТИЧЕСКИХ ОШИБОК ===');
    
    // Исправляем игры с неправильной математикой баланса
    const problematicGames = await Game.find({});
    
    for (const game of problematicGames) {
      const expectedBalanceAfter = game.balanceBefore + game.profit;
      
      if (Math.abs(game.balanceAfter - expectedBalanceAfter) > 0.01) {
        await Game.findByIdAndUpdate(game._id, {
          balanceAfter: expectedBalanceAfter
        });
        
        fixResults.mathErrorsFixed++;
      }
    }
    
    console.log(`✅ Исправлено математических ошибок: ${fixResults.mathErrorsFixed}`);
    
    // ==========================================
    // 6. ИТОГОВЫЙ ОТЧЕТ
    // ==========================================
    console.log('\n\n🎯 === ИТОГОВЫЙ ОТЧЕТ ИСПРАВЛЕНИЙ ===');
    
    console.log(`✅ Исправлено балансов: ${fixResults.balancesFixed}`);
    console.log(`✅ Исправлено статистик: ${fixResults.statisticsFixed}`);
    console.log(`✅ Исправлено транзакций: ${fixResults.transactionsFixed}`);
    console.log(`✅ Исправлено реферальных записей: ${fixResults.referralsFixed}`);
    console.log(`🗑️  Удалено сиротских записей: ${fixResults.orphansRemoved}`);
    console.log(`🔧 Исправлено математических ошибок: ${fixResults.mathErrorsFixed}`);
    
    if (fixResults.suspiciousAccountsFound.length > 0) {
      console.log(`\n⚠️  ПОДОЗРИТЕЛЬНЫЕ АККАУНТЫ (ТРЕБУЮТ РУЧНОЙ ПРОВЕРКИ):`);
      fixResults.suspiciousAccountsFound.forEach(account => {
        console.log(`   🚨 ${account.username}:`);
        console.log(`      Текущий баланс: ${account.currentBalance} USDT`);
        console.log(`      Ожидаемый баланс: ${account.expectedBalance.toFixed(2)} USDT`);
        console.log(`      Разница: ${account.difference.toFixed(2)} USDT`);
        console.log(`      Игр: ${account.gamesPlayed}`);
        console.log(`      Транзакций: ${account.transactionsCount}`);
      });
      
      console.log(`\n💡 РЕКОМЕНДАЦИИ ДЛЯ ПОДОЗРИТЕЛЬНЫХ АККАУНТОВ:`);
      console.log(`   1. Проверьте историю пополнений/выводов`);
      console.log(`   2. Убедитесь, что не было ручных начислений`);
      console.log(`   3. Проверьте логи административных действий`);
      console.log(`   4. При необходимости скорректируйте баланс вручную`);
    }
    
    const totalFixed = fixResults.balancesFixed + fixResults.statisticsFixed + 
                      fixResults.transactionsFixed + fixResults.referralsFixed + 
                      fixResults.orphansRemoved + fixResults.mathErrorsFixed;
    
    console.log(`\n🏆 ОБЩИЙ РЕЗУЛЬТАТ: Исправлено ${totalFixed} проблем`);
    
    if (totalFixed === 0 && fixResults.suspiciousAccountsFound.length === 0) {
      console.log(`🎉 Система находится в идеальном состоянии!`);
    } else if (fixResults.suspiciousAccountsFound.length === 0) {
      console.log(`🎊 Все проблемы успешно исправлены!`);
    } else {
      console.log(`✨ Большинство проблем исправлено. Остались подозрительные аккаунты для ручной проверки.`);
    }
    
    console.log('\n✅ Автоматическое исправление завершено');
    
    return fixResults;
    
  } catch (error) {
    console.error('❌ Критическая ошибка при исправлении:', error);
    throw error;
  } finally {
    mongoose.disconnect();
  }
}

autoFixAllIssues().catch(console.error);