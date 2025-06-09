// analyze_commission_logic.js - Анализ логики комиссий
require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключение к MongoDB установлено');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

const { Transaction, Deposit, Withdrawal, User, CasinoFinance } = require('./src/models');

async function analyzeCommissionLogic() {
  try {
    console.log('💰 АНАЛИЗ ЛОГИКИ КОМИССИЙ\n');

    // 1. Проверяем текущий operationalBalance
    const finance = await CasinoFinance.findOne();
    if (finance) {
      console.log('🏦 ТЕКУЩИЕ ФИНАНСЫ КАЗИНО:');
      console.log(`  Общий баланс пользователей: ${finance.totalUserBalance?.toFixed(2) || 0} USDT`);
      console.log(`  Оперативный баланс: ${finance.operationalBalance?.toFixed(2) || 0} USDT`);
      console.log(`  Комиссии CryptoBot: ${finance.totalCryptoBotFees?.toFixed(2) || 0} USDT`);
      console.log(`  Всего ставок: ${finance.totalBets?.toFixed(2) || 0} USDT`);
      console.log(`  Всего выигрышей: ${finance.totalWins?.toFixed(2) || 0} USDT`);
      console.log(`  Профит от игр: ${((finance.totalBets || 0) - (finance.totalWins || 0)).toFixed(2)} USDT\n`);
    }

    // 2. Считаем реальный баланс пользователей
    const users = await User.find({ isBlocked: false });
    const realUserBalance = users.reduce((sum, user) => {
      const balance = user.balance || 0;
      const referralBalance = user.referralStats?.referralBalance || 0;
      return sum + balance + referralBalance;
    }, 0);

    console.log(`💸 РЕАЛЬНЫЙ БАЛАНС ПОЛЬЗОВАТЕЛЕЙ: ${realUserBalance.toFixed(2)} USDT\n`);

    // 3. Анализируем CryptoBot операции
    console.log('💳 АНАЛИЗ CRYPTOBOT ОПЕРАЦИЙ:');
    
    // Депозиты
    const deposits = await Deposit.find({ status: 'paid' });
    let depositsGross = 0, depositsNet = 0, depositFees = 0;
    
    deposits.forEach(deposit => {
      const gross = deposit.amount || 0;
      const fee = deposit.cryptoBotData?.fee || 0;
      const net = deposit.cryptoBotData?.netAmount || gross;
      
      depositsGross += gross;
      depositsNet += net;
      depositFees += fee;
    });

    console.log(`  Депозиты (валовые): ${depositsGross.toFixed(2)} USDT`);
    console.log(`  Депозиты (чистые): ${depositsNet.toFixed(2)} USDT`);
    console.log(`  Комиссии депозитов: ${depositFees.toFixed(2)} USDT`);

    // Выводы
    const withdrawals = await Withdrawal.find({ status: 'completed' });
    let withdrawalsGross = 0, withdrawalsNet = 0, withdrawalFees = 0;
    
    withdrawals.forEach(withdrawal => {
      const gross = withdrawal.amount || 0;
      const fee = withdrawal.cryptoBotData?.fee || 0;
      const net = withdrawal.cryptoBotData?.netAmount || gross;
      
      withdrawalsGross += gross;
      withdrawalsNet += net;
      withdrawalFees += fee;
    });

    console.log(`  Выводы (валовые): ${withdrawalsGross.toFixed(2)} USDT`);
    console.log(`  Выводы (чистые): ${withdrawalsNet.toFixed(2)} USDT`);
    console.log(`  Комиссии выводов: ${withdrawalFees.toFixed(2)} USDT`);

    const totalCryptoBotFees = depositFees + withdrawalFees;
    console.log(`  ВСЕГО комиссий CryptoBot: ${totalCryptoBotFees.toFixed(2)} USDT\n`);

    // 4. Рассчитываем что должно быть на CryptoBot
    const expectedCryptoBotBalance = depositsGross - withdrawalsNet;
    console.log('🧮 ОЖИДАЕМЫЙ БАЛАНС CRYPTOBOT:');
    console.log(`  Поступило от пользователей: ${depositsGross.toFixed(2)} USDT`);
    console.log(`  Выведено пользователям: ${withdrawalsNet.toFixed(2)} USDT`);
    console.log(`  Ожидаемый остаток: ${expectedCryptoBotBalance.toFixed(2)} USDT`);
    console.log(`  Фактический баланс: 3.28 USDT`);
    console.log(`  Расхождение: ${(expectedCryptoBotBalance - 3.28).toFixed(2)} USDT\n`);

    // 5. Проверяем логику operationalBalance
    console.log('🔧 ПРАВИЛЬНЫЙ РАСЧЕТ ОПЕРАТИВНОГО БАЛАНСА:');
    
    // Оперативный баланс = прибыль от игр + комиссии с дуэлей - промокоды
    // НЕ включаем комиссии CryptoBot (это расходы внешнего сервиса)
    const gameProfit = (finance?.totalBets || 0) - (finance?.totalWins || 0);
    const duelCommissions = finance?.commissionBreakdown?.duels || 0;
    const promocodeExpenses = finance?.totalPromocodeExpenses || 0;
    
    const correctOperationalBalance = gameProfit + duelCommissions - promocodeExpenses;
    
    console.log(`  Прибыль от игр: ${gameProfit.toFixed(2)} USDT`);
    console.log(`  Комиссии с дуэлей: ${duelCommissions.toFixed(2)} USDT`);
    console.log(`  Расходы на промокоды: ${promocodeExpenses.toFixed(2)} USDT`);
    console.log(`  ПРАВИЛЬНЫЙ оперативный баланс: ${correctOperationalBalance.toFixed(2)} USDT`);
    console.log(`  ТЕКУЩИЙ оперативный баланс: ${(finance?.operationalBalance || 0).toFixed(2)} USDT`);
    console.log(`  Разница: ${(correctOperationalBalance - (finance?.operationalBalance || 0)).toFixed(2)} USDT\n`);

    // 6. Диагностика
    console.log('🔍 ДИАГНОСТИКА ПРОБЛЕМ:');
    
    if (Math.abs(expectedCryptoBotBalance - 3.28) > 0.1) {
      console.log(`  ❌ Расхождение с CryptoBot: ${(expectedCryptoBotBalance - 3.28).toFixed(2)} USDT`);
    }
    
    if (Math.abs(correctOperationalBalance - (finance?.operationalBalance || 0)) > 0.1) {
      console.log(`  ❌ Неправильный operationalBalance: разница ${(correctOperationalBalance - (finance?.operationalBalance || 0)).toFixed(2)} USDT`);
    }
    
    if (Math.abs(realUserBalance - (finance?.totalUserBalance || 0)) > 0.1) {
      console.log(`  ❌ Неправильный totalUserBalance: разница ${(realUserBalance - (finance?.totalUserBalance || 0)).toFixed(2)} USDT`);
    }

  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
  }
}

async function main() {
  await connectDB();
  await analyzeCommissionLogic();
  await mongoose.disconnect();
  console.log('🔌 Соединение с БД закрыто');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});