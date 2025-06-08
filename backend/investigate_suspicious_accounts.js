// РАССЛЕДОВАНИЕ ПОДОЗРИТЕЛЬНЫХ АККАУНТОВ
const { 
  User, Game, Transaction, ReferralEarning, ReferralPayout,
  EventBet, CrashRound, DuelRound, Duel, Event, Deposit, Withdrawal 
} = require('./src/models');
const mongoose = require('mongoose');

async function investigateSuspiciousAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено\n');
    
    console.log('🕵️ === РАССЛЕДОВАНИЕ ПОДОЗРИТЕЛЬНЫХ АККАУНТОВ ===\n');
    
    // Найдем всех пользователей с подозрительными балансами
    const allUsers = await User.find({});
    const suspiciousAccounts = [];
    
    for (const user of allUsers) {
      const transactions = await Transaction.find({ user: user._id }).sort({ createdAt: 1 });
      const games = await Game.find({ user: user._id });
      const deposits = await Deposit.find({ user: user._id });
      const withdrawals = await Withdrawal.find({ user: user._id });
      
      const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
      
      // Определяем начальный баланс
      let initialBalance = 0;
      let balanceSource = 'zero';
      
      if (transactions.length > 0) {
        const firstTx = transactions[0];
        if (firstTx.balanceBefore > 0 && firstTx.type !== 'deposit') {
          initialBalance = firstTx.balanceBefore;
          if (firstTx.amount < 0) initialBalance += Math.abs(firstTx.amount);
          balanceSource = 'first_transaction';
        }
      }
      
      const expectedBalance = initialBalance + transactionBalance;
      const balanceDifference = user.balance - expectedBalance;
      
      // Критерии подозрительности
      const isSuspicious = (
        // Большая разница в балансе
        Math.abs(balanceDifference) > 10 ||
        // Большой баланс без игр
        (user.balance > 50 && games.length === 0 && totalDeposits === 0) ||
        // Отрицательный баланс
        user.balance < 0 ||
        // Больше выводов чем депозитов + выигрышей
        totalWithdrawals > (totalDeposits + Math.max(0, transactionBalance))
      );
      
      if (isSuspicious) {
        suspiciousAccounts.push({
          user,
          transactions,
          games,
          deposits,
          withdrawals,
          analysis: {
            currentBalance: user.balance,
            initialBalance,
            balanceSource,
            transactionBalance,
            expectedBalance,
            balanceDifference,
            totalDeposits,
            totalWithdrawals,
            totalGames: games.length,
            suspicionReasons: []
          }
        });
        
        // Определяем причины подозрений
        const account = suspiciousAccounts[suspiciousAccounts.length - 1];
        if (Math.abs(balanceDifference) > 10) {
          account.analysis.suspicionReasons.push(`Разница в балансе: ${balanceDifference.toFixed(2)} USDT`);
        }
        if (user.balance > 50 && games.length === 0 && totalDeposits === 0) {
          account.analysis.suspicionReasons.push(`Большой баланс без активности: ${user.balance} USDT`);
        }
        if (user.balance < 0) {
          account.analysis.suspicionReasons.push(`Отрицательный баланс: ${user.balance} USDT`);
        }
        if (totalWithdrawals > (totalDeposits + Math.max(0, transactionBalance))) {
          account.analysis.suspicionReasons.push(`Выводы превышают депозиты + выигрыши`);
        }
      }
    }
    
    console.log(`🚨 Найдено подозрительных аккаунтов: ${suspiciousAccounts.length}\n`);
    
    // Детальный анализ каждого подозрительного аккаунта
    for (const account of suspiciousAccounts) {
      const { user, transactions, games, deposits, withdrawals, analysis } = account;
      
      console.log(`🕵️ === АНАЛИЗ: ${user.username || user.telegramId} ===`);
      console.log(`ID: ${user._id}`);
      console.log(`Создан: ${user.createdAt?.toISOString() || 'Неизвестно'}`);
      console.log(`Последняя активность: ${user.lastActivity?.toISOString() || 'Неизвестно'}`);
      
      console.log(`\n📊 ФИНАНСОВЫЕ ДАННЫЕ:`);
      console.log(`   Текущий баланс: ${analysis.currentBalance} USDT`);
      console.log(`   Начальный баланс: ${analysis.initialBalance} USDT (источник: ${analysis.balanceSource})`);
      console.log(`   Баланс из транзакций: ${analysis.transactionBalance.toFixed(2)} USDT`);
      console.log(`   Ожидаемый баланс: ${analysis.expectedBalance.toFixed(2)} USDT`);
      console.log(`   Разница: ${analysis.balanceDifference.toFixed(2)} USDT`);
      
      console.log(`\n💰 ДЕПОЗИТЫ И ВЫВОДЫ:`);
      console.log(`   Депозитов: ${deposits.length} на сумму ${analysis.totalDeposits} USDT`);
      console.log(`   Выводов: ${withdrawals.length} на сумму ${analysis.totalWithdrawals} USDT`);
      
      console.log(`\n🎮 ИГРОВАЯ АКТИВНОСТЬ:`);
      console.log(`   Игр сыграно: ${analysis.totalGames}`);
      console.log(`   Статистика пользователя: ${user.totalGames} игр, ${user.totalWagered} ставок, ${user.totalWon} выигрышей`);
      
      if (games.length > 0) {
        const gamesByType = games.reduce((acc, game) => {
          acc[game.gameType] = (acc[game.gameType] || 0) + 1;
          return acc;
        }, {});
        console.log(`   По типам игр:`, gamesByType);
        
        const winRate = (games.filter(g => g.win).length / games.length * 100).toFixed(1);
        const totalProfit = games.reduce((sum, g) => sum + g.profit, 0);
        console.log(`   Винрейт: ${winRate}%`);
        console.log(`   Общая прибыль/убыток: ${totalProfit.toFixed(2)} USDT`);
      }
      
      console.log(`\n🤝 РЕФЕРАЛЬНАЯ СИСТЕМА:`);
      console.log(`   Реферер: ${user.referrer ? 'Да' : 'Нет'}`);
      console.log(`   Партнерский уровень: ${user.partnerLevel || 'none'}`);
      console.log(`   Реферальный баланс: ${user.referralStats?.referralBalance || 0} USDT`);
      console.log(`   Всего заработано: ${user.referralStats?.totalEarned || 0} USDT`);
      
      console.log(`\n📜 ИСТОРИЯ ТРАНЗАКЦИЙ (последние 10):`);
      const recentTransactions = transactions.slice(-10);
      if (recentTransactions.length === 0) {
        console.log(`   Транзакций нет`);
      } else {
        recentTransactions.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.createdAt.toISOString().split('T')[0]} | ${tx.type} | ${tx.amount} USDT | ${tx.balanceBefore} → ${tx.balanceAfter}`);
          if (tx.description) console.log(`      "${tx.description}"`);
        });
      }
      
      console.log(`\n🚩 ПРИЧИНЫ ПОДОЗРЕНИЙ:`);
      analysis.suspicionReasons.forEach(reason => {
        console.log(`   ❌ ${reason}`);
      });
      
      console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
      
      if (analysis.balanceDifference > 100 && games.length === 0) {
        console.log(`   🔍 ВЫСОКИЙ ПРИОРИТЕТ: Проверить источник баланса ${analysis.currentBalance} USDT`);
        console.log(`   📋 Действия: Проверить логи администратора на ручные начисления`);
      }
      
      if (analysis.balanceDifference < -50) {
        console.log(`   ⚠️  Возможная нехватка средств: ${Math.abs(analysis.balanceDifference).toFixed(2)} USDT`);
        console.log(`   📋 Действия: Проверить не было ли технических ошибок при выводах`);
      }
      
      if (games.length === 0 && transactions.length > 0) {
        console.log(`   🤔 Только транзакции без игр - возможно тестовый аккаунт`);
      }
      
      if (user.balance < 0) {
        console.log(`   🚨 КРИТИЧНО: Отрицательный баланс требует немедленного исправления`);
      }
      
      // Специальная проверка для случая aastaxovv
      if (analysis.balanceDifference > 500 && games.length === 0) {
        console.log(`   🎯 СЛУЧАЙ ТИПА AASTAXOVV: Phantom balance`);
        console.log(`   📋 Возможные причины:`);
        console.log(`      - Ошибка в скрипте начального начисления`);
        console.log(`      - Дублирование тестового баланса`);
        console.log(`      - Технический сбой в системе депозитов`);
        console.log(`   🔧 Рекомендуемое действие: Сбросить баланс до ожидаемого значения`);
      }
      
      console.log(`\n${'='.repeat(80)}\n`);
    }
    
    // Общие выводы
    console.log(`📈 === ОБЩИЙ АНАЛИЗ ПОДОЗРИТЕЛЬНЫХ АККАУНТОВ ===`);
    
    const totalPhantomBalance = suspiciousAccounts
      .filter(acc => acc.analysis.balanceDifference > 10)
      .reduce((sum, acc) => sum + acc.analysis.balanceDifference, 0);
      
    const accountsWithPhantomBalance = suspiciousAccounts
      .filter(acc => acc.analysis.balanceDifference > 10).length;
    
    const accountsWithNegativeBalance = suspiciousAccounts
      .filter(acc => acc.user.balance < 0).length;
      
    const inactiveAccountsWithBalance = suspiciousAccounts
      .filter(acc => acc.games.length === 0 && acc.user.balance > 50).length;
    
    console.log(`💸 Общий phantom balance: ${totalPhantomBalance.toFixed(2)} USDT`);
    console.log(`👻 Аккаунтов с phantom balance: ${accountsWithPhantomBalance}`);
    console.log(`❌ Аккаунтов с отрицательным балансом: ${accountsWithNegativeBalance}`);
    console.log(`😴 Неактивных аккаунтов с балансом: ${inactiveAccountsWithBalance}`);
    
    if (totalPhantomBalance > 100) {
      console.log(`\n🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Обнаружен значительный phantom balance!`);
      console.log(`💡 Рекомендация: Срочно исправить балансы проблемных аккаунтов`);
    }
    
    console.log('\n✅ Расследование завершено');
    
    return {
      suspiciousAccounts,
      summary: {
        totalSuspicious: suspiciousAccounts.length,
        totalPhantomBalance: totalPhantomBalance,
        accountsWithPhantomBalance,
        accountsWithNegativeBalance,
        inactiveAccountsWithBalance
      }
    };
    
  } catch (error) {
    console.error('❌ Ошибка при расследовании:', error);
    throw error;
  } finally {
    mongoose.disconnect();
  }
}

investigateSuspiciousAccounts().catch(console.error);