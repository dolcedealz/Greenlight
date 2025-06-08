// Скрипт для пересчета и начисления упущенных реферальных комиссий
const { User, Game, Transaction, ReferralEarning } = require('./src/models');
const mongoose = require('mongoose');

async function recalculateCommissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/greenlight');
    console.log('🔗 Подключение к базе данных установлено');
    
    console.log('\n💰 === ПЕРЕСЧЕТ РЕФЕРАЛЬНЫХ КОМИССИЙ ===');
    
    // Находим всех партнеров
    const partners = await User.find({ 
      partnerLevel: { $ne: 'none' }
    });
    
    let totalRecalculated = 0;
    let totalAmount = 0;
    
    for (const partner of partners) {
      console.log(`\n🤝 Обработка партнера: ${partner.username} (${partner.partnerLevel})`);
      
      // Определяем процент комиссии
      const commissionPercent = 
        partner.partnerLevel === 'partner_bronze' ? 20 : 
        partner.partnerLevel === 'partner_silver' ? 25 :
        partner.partnerLevel === 'partner_gold' ? 30 : 5;
      
      console.log(`   Процент комиссии: ${commissionPercent}%`);
      
      // Находим всех рефералов партнера
      const referrals = await User.find({ referrer: partner._id });
      
      for (const referral of referrals) {
        // Находим все проигрышные игры реферала
        const lostGames = await Game.find({ 
          user: referral._id,
          win: false 
        }).sort({ createdAt: 1 });
        
        // Получаем существующие начисления
        const existingEarnings = await ReferralEarning.find({
          partner: partner._id,
          referral: referral._id,
          type: 'game_loss'
        });
        
        const processedGameIds = new Set(existingEarnings.map(e => e.game?.toString()));
        
        // Обрабатываем игры без комиссии
        for (const game of lostGames) {
          if (processedGameIds.has(game._id.toString())) {
            continue; // Комиссия уже начислена
          }
          
          // Проверяем что на момент игры у пользователя было достаточно игр
          const gamesBeforeThis = await Game.countDocuments({
            user: referral._id,
            createdAt: { $lt: game.createdAt }
          });
          
          if (gamesBeforeThis < 1) { // Минимум 1 игра до этой для начисления комиссии
            console.log(`   ⏭️  Пропускаем игру - недостаточно предыдущих игр`);
            continue;
          }
          
          const lossAmount = Math.abs(game.profit);
          const earnedAmount = lossAmount * (commissionPercent / 100);
          
          const session = await mongoose.startSession();
          session.startTransaction();
          
          try {
            // Создаем запись о начислении
            const earning = new ReferralEarning({
              partner: partner._id,
              referral: referral._id,
              game: game._id,
              type: 'game_loss',
              calculation: {
                baseAmount: lossAmount,
                partnerLevel: partner.referralStats?.level || 'bronze', // Используем реферальный уровень, а не партнерский
                commissionPercent: commissionPercent,
                earnedAmount: earnedAmount
              },
              status: 'credited',
              balanceBefore: partner.referralStats.referralBalance,
              balanceAfter: partner.referralStats.referralBalance + earnedAmount,
              metadata: {
                gameType: game.gameType,
                notes: 'Пересчет упущенной комиссии'
              },
              creditedAt: new Date()
            });
            
            await earning.save({ session });
            
            // Обновляем баланс партнера
            await User.findByIdAndUpdate(
              partner._id,
              {
                $inc: {
                  'referralStats.referralBalance': earnedAmount,
                  'referralStats.totalEarned': earnedAmount
                }
              },
              { session }
            );
            
            // Обновляем локальную копию для следующих итераций
            partner.referralStats.referralBalance += earnedAmount;
            partner.referralStats.totalEarned += earnedAmount;
            
            await session.commitTransaction();
            
            console.log(`   ✅ Начислено ${earnedAmount.toFixed(2)} USDT за игру ${game.gameType} реферала ${referral.username}`);
            totalRecalculated++;
            totalAmount += earnedAmount;
            
          } catch (error) {
            await session.abortTransaction();
            console.error(`   ❌ Ошибка начисления для игры ${game._id}:`, error.message);
          } finally {
            session.endSession();
          }
        }
      }
    }
    
    console.log('\n📊 === ИТОГИ ПЕРЕСЧЕТА ===');
    console.log(`   Обработано начислений: ${totalRecalculated}`);
    console.log(`   Общая сумма начислений: ${totalAmount.toFixed(2)} USDT`);
    console.log('✅ Пересчет завершен');
    
  } catch (error) {
    console.error('❌ Ошибка при пересчете:', error);
  } finally {
    mongoose.disconnect();
  }
}

recalculateCommissions();