// debug_balance_discrepancy.js - Анализ расхождения между CryptoBot и базой данных
require('dotenv').config();
const mongoose = require('mongoose');

// Подключение к базе данных
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB установлено');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

// Импортируем модели
const { Transaction, Deposit, Withdrawal, CasinoFinance } = require('./src/models');

async function debugBalanceDiscrepancy() {
  try {
    console.log('🔍 АНАЛИЗ РАСХОЖДЕНИЯ БАЛАНСОВ');
    console.log('CryptoBot баланс: 3.28 USDT');
    console.log('Админка показывает: 4.72 USDT');
    console.log('Расхождение: 1.44 USDT\n');

    // 1. Анализируем все депозиты
    const deposits = await Deposit.find({ status: 'paid' });
    let totalDepositsGross = 0;
    let totalDepositsNet = 0;
    let totalDepositFees = 0;

    console.log('📥 ДЕПОЗИТЫ:');
    deposits.forEach(deposit => {
      const amount = deposit.amount || 0;
      const fee = deposit.cryptoBotData?.fee || (amount * 0.03); // 3% комиссия
      const netAmount = deposit.cryptoBotData?.netAmount || (amount - fee);
      
      totalDepositsGross += amount;
      totalDepositsNet += netAmount;
      totalDepositFees += fee;
      
      console.log(`  Депозит: ${amount} USDT, комиссия: ${fee.toFixed(2)} USDT, чистыми: ${netAmount.toFixed(2)} USDT`);
    });

    console.log(`  ИТОГО депозитов: ${totalDepositsGross.toFixed(2)} USDT (валовых)`);
    console.log(`  ИТОГО чистыми: ${totalDepositsNet.toFixed(2)} USDT`);
    console.log(`  ИТОГО комиссий: ${totalDepositFees.toFixed(2)} USDT\n`);

    // 2. Анализируем все выводы
    const withdrawals = await Withdrawal.find({ 
      status: { $in: ['completed', 'processing', 'pending'] } 
    });
    let totalWithdrawalsGross = 0;
    let totalWithdrawalsNet = 0;
    let totalWithdrawalFees = 0;

    console.log('📤 ВЫВОДЫ:');
    withdrawals.forEach(withdrawal => {
      const amount = withdrawal.amount || 0;
      const fee = withdrawal.cryptoBotData?.fee || (amount * 0.03); // 3% комиссия
      const netAmount = withdrawal.cryptoBotData?.netAmount || (amount - fee);
      
      totalWithdrawalsGross += amount;
      totalWithdrawalsNet += netAmount;
      totalWithdrawalFees += fee;
      
      console.log(`  Вывод: ${amount} USDT, комиссия: ${fee.toFixed(2)} USDT, переведено: ${netAmount.toFixed(2)} USDT, статус: ${withdrawal.status}`);
    });

    console.log(`  ИТОГО выводов: ${totalWithdrawalsGross.toFixed(2)} USDT (валовых)`);
    console.log(`  ИТОГО переведено: ${totalWithdrawalsNet.toFixed(2)} USDT`);
    console.log(`  ИТОГО комиссий: ${totalWithdrawalFees.toFixed(2)} USDT\n`);

    // 3. Рассчитываем ожидаемый баланс CryptoBot
    const expectedCryptoBotBalance = totalDepositsGross - totalWithdrawalsNet;
    console.log('🧮 РАСЧЕТ ОЖИДАЕМОГО БАЛАНСА CRYPTOBOT:');
    console.log(`  Поступило: ${totalDepositsGross.toFixed(2)} USDT`);
    console.log(`  Выведено: ${totalWithdrawalsNet.toFixed(2)} USDT`);
    console.log(`  Ожидаемый баланс: ${expectedCryptoBotBalance.toFixed(2)} USDT`);
    console.log(`  Фактический баланс: 3.28 USDT`);
    console.log(`  Расхождение: ${(expectedCryptoBotBalance - 3.28).toFixed(2)} USDT\n`);

    // 4. Анализируем транзакции с комиссиями
    const transactionsWithFees = await Transaction.find({
      'payment.fee': { $exists: true, $gt: 0 }
    });

    console.log('💰 ТРАНЗАКЦИИ С КОМИССИЯМИ:');
    let totalTrackedFees = 0;
    transactionsWithFees.forEach(tx => {
      const fee = tx.payment.fee || 0;
      totalTrackedFees += fee;
      console.log(`  ${tx.type}: ${tx.amount} USDT, комиссия: ${fee.toFixed(2)} USDT`);
    });
    console.log(`  ИТОГО отслеженных комиссий: ${totalTrackedFees.toFixed(2)} USDT\n`);

    // 5. Анализируем casino finance
    const finance = await CasinoFinance.findOne();
    if (finance) {
      console.log('🏦 CASINO FINANCE:');
      console.log(`  totalDeposits: ${finance.totalDeposits?.toFixed(2) || 0} USDT`);
      console.log(`  totalWithdrawals: ${finance.totalWithdrawals?.toFixed(2) || 0} USDT`);
      console.log(`  totalCryptoBotFees: ${finance.totalCryptoBotFees?.toFixed(2) || 0} USDT`);
      console.log(`  operationalBalance: ${finance.operationalBalance?.toFixed(2) || 0} USDT`);
    }

    // 6. Проверяем статистику игр для поиска "потерянного доллара"
    console.log('\n🎮 ПОИСК ПРОБЛЕМ В ИГРАХ:');
    const gameTransactions = await Transaction.find({
      type: { $in: ['bet', 'win'] }
    });

    let totalBets = 0;
    let totalWins = 0;
    gameTransactions.forEach(tx => {
      if (tx.type === 'bet') {
        totalBets += Math.abs(tx.amount);
      } else if (tx.type === 'win') {
        totalWins += tx.amount;
      }
    });

    console.log(`  Всего ставок: ${totalBets.toFixed(2)} USDT`);
    console.log(`  Всего выигрышей: ${totalWins.toFixed(2)} USDT`);
    console.log(`  Profit/Loss: ${(totalBets - totalWins).toFixed(2)} USDT`);

  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
  }
}

async function main() {
  await connectDB();
  await debugBalanceDiscrepancy();
  await mongoose.disconnect();
  console.log('🔌 Соединение с БД закрыто');
  process.exit(0);
}

// Запуск скрипта
main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});