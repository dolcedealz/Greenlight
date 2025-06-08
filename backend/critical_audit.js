// КРИТИЧЕСКИЙ АУДИТ - ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ
const { User, Game, Transaction, ReferralEarning } = require('./src/models');
const mongoose = require('mongoose');

async function criticalAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n🚨 === КРИТИЧЕСКИЙ АУДИТ СИСТЕМЫ === 🚨');
    
    // ФОКУС НА ПОЛЬЗОВАТЕЛЕ aiuserv
    console.log('\n=== ДЕТАЛЬНЫЙ АНАЛИЗ ПОЛЬЗОВАТЕЛЯ aiuserv ===');
    const aiuserv = await User.findOne({ username: 'aiuserv' });
    
    if (aiuserv) {
      console.log('👤 Пользователь aiuserv найден:');
      console.log(`   _id: ${aiuserv._id}`);
      console.log(`   telegramId: ${aiuserv.telegramId}`);
      console.log(`   Баланс в модели: ${aiuserv.balance} USDT`);
      console.log(`   totalGames: ${aiuserv.totalGames}`);
      console.log(`   totalWagered: ${aiuserv.totalWagered}`);
      console.log(`   totalWon: ${aiuserv.totalWon}`);
      console.log(`   Реферер: ${aiuserv.referrer}`);
      console.log(`   Создан: ${aiuserv.createdAt}`);
      console.log(`   Последняя активность: ${aiuserv.lastActivity}`);
      
      // Все игры пользователя
      const games = await Game.find({ user: aiuserv._id }).sort({ createdAt: 1 });
      console.log(`\n🎮 ВСЕ ИГРЫ ПОЛЬЗОВАТЕЛЯ (${games.length} игр):`);
      
      let runningBalance = 0;
      for (const [index, game] of games.entries()) {
        const prevBalance = runningBalance;
        runningBalance = game.balanceAfter;
        
        console.log(`   ${index + 1}. ${game.createdAt.toISOString()} | ${game.gameType} | Ставка: ${game.bet} | Прибыль: ${game.profit} | ${game.win ? 'WIN' : 'LOSS'}`);
        console.log(`      Баланс: ${game.balanceBefore} → ${game.balanceAfter} (расчет: ${prevBalance + game.profit})`);
        
        // Проверяем логику баланса
        if (Math.abs(game.balanceAfter - (game.balanceBefore + game.profit)) > 0.01) {
          console.log(`      ❌ ОШИБКА БАЛАНСА В ИГРЕ!`);
        }
      }
      
      // Все транзакции пользователя
      const transactions = await Transaction.find({ user: aiuserv._id }).sort({ createdAt: 1 });
      console.log(`\n💰 ВСЕ ТРАНЗАКЦИИ ПОЛЬЗОВАТЕЛЯ (${transactions.length} транзакций):`);
      
      let transactionSum = 0;
      for (const [index, tx] of transactions.entries()) {
        transactionSum += tx.amount;
        console.log(`   ${index + 1}. ${tx.createdAt.toISOString()} | ${tx.type} | ${tx.amount} USDT | Сумма: ${transactionSum.toFixed(2)}`);
        console.log(`      Описание: ${tx.description}`);
        console.log(`      Баланс: ${tx.balanceBefore} → ${tx.balanceAfter}`);
        
        if (tx.game) {
          const relatedGame = games.find(g => g._id.toString() === tx.game.toString());
          if (relatedGame) {
            console.log(`      Связанная игра: ${relatedGame.gameType} ${relatedGame.bet} USDT`);
          }
        }
      }
      
      console.log(`\n📊 ИТОГОВАЯ ПРОВЕРКА aiuserv:`);
      console.log(`   Баланс в User модели: ${aiuserv.balance} USDT`);
      console.log(`   Сумма всех транзакций: ${transactionSum.toFixed(2)} USDT`);
      console.log(`   Последний balanceAfter в играх: ${games.length > 0 ? games[games.length - 1].balanceAfter : 'N/A'} USDT`);
      console.log(`   Разница (модель - транзакции): ${(aiuserv.balance - transactionSum).toFixed(2)} USDT`);
      
      // Проверяем реферальные комиссии с этого пользователя
      const referalEarnings = await ReferralEarning.find({ referral: aiuserv._id });
      console.log(`\n🤝 РЕФЕРАЛЬНЫЕ КОМИССИИ С ПОЛЬЗОВАТЕЛЯ:`);
      for (const earning of referalEarnings) {
        const partner = await User.findById(earning.partner);
        console.log(`   Партнер: ${partner?.username} получил ${earning.calculation.earnedAmount} USDT`);
        console.log(`   Процент: ${earning.calculation.commissionPercent}% с суммы ${earning.calculation.baseAmount}`);
        console.log(`   Дата: ${earning.createdAt.toISOString()}`);
      }
    }
    
    // ПРОВЕРЯЕМ СИСТЕМНЫЕ ПРОБЛЕМЫ
    console.log('\n=== СИСТЕМНЫЕ ПРОБЛЕМЫ ===');
    
    // 1. Проверяем логику создания депозитов
    console.log('\n💳 ПРОВЕРКА ДЕПОЗИТОВ:');
    const deposits = await Transaction.find({ type: 'deposit' }).sort({ createdAt: -1 }).limit(10);
    console.log(`Найдено депозитов: ${deposits.length}`);
    
    for (const deposit of deposits) {
      const user = await User.findById(deposit.user);
      console.log(`   ${user?.username} | ${deposit.amount} USDT | ${deposit.createdAt.toISOString().split('T')[0]}`);
      console.log(`   Баланс: ${deposit.balanceBefore} → ${deposit.balanceAfter}`);
    }
    
    // 2. Проверяем логику начальных балансов
    console.log('\n🏦 АНАЛИЗ НАЧАЛЬНЫХ БАЛАНСОВ:');
    const allUsers = await User.find({}).sort({ createdAt: 1 });
    
    for (const user of allUsers) {
      const firstTransaction = await Transaction.findOne({ user: user._id }).sort({ createdAt: 1 });
      const firstGame = await Game.findOne({ user: user._id }).sort({ createdAt: 1 });
      
      console.log(`\n👤 ${user.username || user.telegramId}:`);
      console.log(`   Текущий баланс: ${user.balance} USDT`);
      console.log(`   Первая транзакция: ${firstTransaction ? `${firstTransaction.type} ${firstTransaction.amount} (${firstTransaction.balanceBefore} → ${firstTransaction.balanceAfter})` : 'НЕТ'}`);
      console.log(`   Первая игра: ${firstGame ? `${firstGame.gameType} ${firstGame.bet} (${firstGame.balanceBefore} → ${firstGame.balanceAfter})` : 'НЕТ'}`);
      
      // Проверяем откуда появился первоначальный баланс
      if (firstGame && firstGame.balanceBefore > 0 && !firstTransaction) {
        console.log(`   ❌ ПРОБЛЕМА: Игра началась с баланса ${firstGame.balanceBefore} без транзакций!`);
      }
      
      if (firstTransaction && firstTransaction.balanceBefore > 0 && firstTransaction.type !== 'deposit') {
        console.log(`   ❌ ПРОБЛЕМА: Первая транзакция ${firstTransaction.type} началась с баланса ${firstTransaction.balanceBefore}!`);
      }
    }
    
    // 3. ПРОВЕРЯЕМ ЛОГИКУ ОБНОВЛЕНИЯ БАЛАНСОВ В ИГРАХ
    console.log('\n🎮 ПРОВЕРКА ЛОГИКИ ИГР:');
    
    // Находим игры с неправильной логикой баланса
    const problematicGames = await Game.aggregate([
      {
        $addFields: {
          calculatedBalanceAfter: { $add: ['$balanceBefore', '$profit'] }
        }
      },
      {
        $match: {
          $expr: {
            $gt: [
              { $abs: { $subtract: ['$balanceAfter', '$calculatedBalanceAfter'] } },
              0.01
            ]
          }
        }
      },
      {
        $limit: 10
      }
    ]);
    
    console.log(`Игр с неправильной логикой баланса: ${problematicGames.length}`);
    
    for (const game of problematicGames) {
      const user = await User.findById(game.user);
      console.log(`   ${user?.username} | ${game.gameType} | ${game.bet} USDT`);
      console.log(`   Должно быть: ${game.balanceBefore} + ${game.profit} = ${game.balanceBefore + game.profit}`);
      console.log(`   Фактически: ${game.balanceAfter}`);
      console.log(`   Разница: ${(game.balanceAfter - (game.balanceBefore + game.profit)).toFixed(4)}`);
    }
    
    // 4. ПРОВЕРЯЕМ ДУБЛИРОВАНИЕ ТРАНЗАКЦИЙ
    console.log('\n🔄 ПРОВЕРКА ДУБЛИРОВАНИЯ ТРАНЗАКЦИЙ:');
    
    const duplicateTransactions = await Transaction.aggregate([
      {
        $group: {
          _id: {
            user: '$user',
            type: '$type',
            amount: '$amount',
            game: '$game',
            createdAt: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', date: '$createdAt' } }
          },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`Групп дублированных транзакций: ${duplicateTransactions.length}`);
    
    for (const dup of duplicateTransactions.slice(0, 5)) {
      console.log(`   Пользователь: ${dup._id.user} | ${dup._id.type} | ${dup._id.amount} USDT | Дублей: ${dup.count}`);
    }
    
    console.log('\n✅ Критический аудит завершен');
    
  } catch (error) {
    console.error('❌ Ошибка при аудите:', error);
  } finally {
    mongoose.disconnect();
  }
}

criticalAudit();