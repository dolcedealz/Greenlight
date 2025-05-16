const { api } = require('./api.service');
const { payment: paymentService } = require('./index');
const { User, Transaction } = require('../../backend/src/models');

/**
 * Обрабатывает платеж от CryptoBot
 * @param {Object} payment - Данные платежа от CryptoBot
 */
async function handleCryptoBotPayment(payment) {
  try {
    // Проверяем статус платежа
    if (payment.status !== 'paid') {
      console.log(`Получен платеж со статусом ${payment.status}, пропускаем`);
      return;
    }
    
    // Извлекаем ID пользователя из hidden_message
    const userIdMatch = payment.hidden_message.match(/пользователя #(\d+)/i);
    if (!userIdMatch || !userIdMatch[1]) {
      console.error('Не удалось извлечь ID пользователя из hidden_message:', payment.hidden_message);
      return;
    }
    
    const telegramId = parseInt(userIdMatch[1]);
    if (isNaN(telegramId)) {
      console.error('Некорректный ID пользователя:', userIdMatch[1]);
      return;
    }
    
    // Получаем данные пользователя из базы
    const user = await User.findOne({ telegramId });
    if (!user) {
      console.error(`Пользователь с ID ${telegramId} не найден в базе`);
      return;
    }
    
    // Получаем сумму пополнения
    const amount = parseFloat(payment.amount);
    if (isNaN(amount)) {
      console.error('Некорректная сумма платежа:', payment.amount);
      return;
    }
    
    console.log(`Обработка пополнения баланса для пользователя ${telegramId} на сумму ${amount} ${payment.asset}`);
    
    // Записываем состояние баланса до пополнения
    const balanceBefore = user.balance;
    
    // Обновляем баланс пользователя
    user.balance += amount;
    await user.save();
    
    // Создаем запись о транзакции
    const transaction = new Transaction({
      user: user._id,
      type: 'deposit',
      amount,
      status: 'completed',
      payment: {
        invoiceId: payment.invoice_id,
        paymentMethod: 'CryptoBot',
        externalReference: payment.payment_id || '',
        fee: 0
      },
      description: `Пополнение баланса через CryptoBot (${payment.asset})`,
      balanceBefore,
      balanceAfter: user.balance
    });
    
    await transaction.save();
    
    // Отправляем уведомление пользователю
    await bot.telegram.sendMessage(
      telegramId,
      `✅ Ваш баланс пополнен на ${amount} ${payment.asset}.\n\nТекущий баланс: ${user.balance.toFixed(2)} USDT`
    );
    
    console.log(`Баланс пользователя ${telegramId} успешно пополнен на ${amount} ${payment.asset}`);
    
  } catch (error) {
    console.error('Ошибка при обработке платежа:', error);
    // В реальном проекте здесь можно отправить уведомление администратору
  }
}

module.exports = {
  handleCryptoBotPayment
};