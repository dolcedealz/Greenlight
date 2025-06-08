// Скрипт для исправления неправильных balanceBefore в транзакциях выигрышей
const { User, Game, Transaction } = require('./src/models');
const mongoose = require('mongoose');

async function fixTransactionBalances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n🔧 === ИСПРАВЛЕНИЕ БАЛАНСОВ В ТРАНЗАКЦИЯХ ===');
    
    // Найти все транзакции выигрышей с неправильными balanceBefore
    const winTransactions = await Transaction.find({ 
      type: 'win',
      description: { $regex: /выигрыш|вывод|автовывод/i }
    }).sort({ createdAt: 1 });
    
    console.log(`\nНайдено транзакций выигрышей: ${winTransactions.length}`);
    
    let fixedCount = 0;
    
    for (const transaction of winTransactions) {
      // Правильный balanceBefore = balanceAfter - amount
      const correctBalanceBefore = transaction.balanceAfter - transaction.amount;
      
      if (Math.abs(transaction.balanceBefore - correctBalanceBefore) > 0.01) {
        console.log(`\n🔧 Исправление транзакции ${transaction._id}:`);
        console.log(`   Пользователь: ${transaction.user}`);
        console.log(`   Сумма: ${transaction.amount} USDT`);
        console.log(`   Было: ${transaction.balanceBefore} → ${transaction.balanceAfter}`);
        console.log(`   Стало: ${correctBalanceBefore} → ${transaction.balanceAfter}`);
        
        await Transaction.findByIdAndUpdate(transaction._id, {
          balanceBefore: correctBalanceBefore
        });
        
        fixedCount++;
      }
    }
    
    console.log(`\n✅ Исправлено транзакций: ${fixedCount}`);
    
    // Также исправим ставочные транзакции, которые могут иметь проблемы
    console.log('\n🔧 Проверка ставочных транзакций...');
    
    const betTransactions = await Transaction.find({ 
      type: 'bet'
    }).sort({ createdAt: 1 });
    
    let betFixedCount = 0;
    
    for (const transaction of betTransactions) {
      // Правильный balanceAfter = balanceBefore + amount (amount отрицательный для ставок)
      const correctBalanceAfter = transaction.balanceBefore + transaction.amount;
      
      if (Math.abs(transaction.balanceAfter - correctBalanceAfter) > 0.01) {
        console.log(`\n🔧 Исправление ставочной транзакции ${transaction._id}:`);
        console.log(`   Сумма: ${transaction.amount} USDT`);
        console.log(`   Было: ${transaction.balanceBefore} → ${transaction.balanceAfter}`);
        console.log(`   Стало: ${transaction.balanceBefore} → ${correctBalanceAfter}`);
        
        await Transaction.findByIdAndUpdate(transaction._id, {
          balanceAfter: correctBalanceAfter
        });
        
        betFixedCount++;
      }
    }
    
    console.log(`✅ Исправлено ставочных транзакций: ${betFixedCount}`);
    console.log('✅ Исправление транзакций завершено');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixTransactionBalances();