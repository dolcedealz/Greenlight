// bot/src/commands/promocode.command.js
const { sendMessage } = require('../services/notification.service');
const { activatePromoCode } = require('../services/api.service');

async function promocodeCommand(ctx) {
  try {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    
    // Проверяем, передан ли промокод
    if (args.length < 2) {
      return ctx.reply(
        '🎁 <b>Активация промокода</b>\n\n' +
        'Для активации промокода используйте команду:\n' +
        '<code>/promocode ВАШ_ПРОМОКОД</code>\n\n' +
        'Пример: <code>/promocode WELCOME2024</code>\n\n' +
        '💡 Промокоды дают различные бонусы:\n' +
        '• 💰 Бонус на баланс\n' +
        '• 🎮 Бесплатные игры\n' +
        '• 📈 Бонус к депозиту\n' +
        '• 🏆 VIP статус',
        { parse_mode: 'HTML' }
      );
    }
    
    const promoCode = args[1].toUpperCase();
    
    // Отправляем сообщение о попытке активации
    const waitMessage = await ctx.reply(
      `🔄 Активирую промокод <code>${promoCode}</code>...`,
      { parse_mode: 'HTML' }
    );
    
    try {
      // Активируем промокод через API
      const result = await activatePromoCode(userId, promoCode);
      
      if (result.success) {
        const { bonus, transactionId } = result.data;
        
        // Удаляем сообщение ожидания
        await ctx.deleteMessage(waitMessage.message_id);
        
        // Формируем сообщение о успешной активации
        let successMessage = '🎉 <b>Промокод успешно активирован!</b>\n\n';
        successMessage += `🎁 Код: <code>${promoCode}</code>\n`;
        
        // Добавляем информацию о бонусе в зависимости от типа
        switch (bonus.type) {
          case 'balance':
            successMessage += `💰 Бонус: +${bonus.value} USDT на баланс\n`;
            break;
          case 'freespins':
            successMessage += `🎮 Бонус: ${bonus.value} бесплатных игр\n`;
            break;
          case 'deposit':
            successMessage += `📈 Бонус: +${bonus.value}% к следующему депозиту\n`;
            break;
          case 'vip':
            successMessage += `🏆 Бонус: VIP статус на ${bonus.value} дней\n`;
            break;
        }
        
        if (bonus.description) {
          successMessage += `📝 ${bonus.description}\n`;
        }
        
        successMessage += `\n🔗 ID транзакции: <code>${transactionId}</code>\n\n`;
        successMessage += '✨ Бонус уже применен к вашему аккаунту!';
        
        await ctx.reply(successMessage, { parse_mode: 'HTML' });
        
      } else {
        // Удаляем сообщение ожидания
        await ctx.deleteMessage(waitMessage.message_id);
        
        // Отправляем сообщение об ошибке
        let errorMessage = '❌ <b>Не удалось активировать промокод</b>\n\n';
        errorMessage += `🎁 Код: <code>${promoCode}</code>\n`;
        errorMessage += `📝 Причина: ${result.message}\n\n`;
        
        // Добавляем подсказки в зависимости от ошибки
        if (result.message.includes('не найден')) {
          errorMessage += '💡 Проверьте правильность написания промокода';
        } else if (result.message.includes('уже использован')) {
          errorMessage += '💡 Каждый промокод можно активировать только один раз';
        } else if (result.message.includes('истек')) {
          errorMessage += '💡 Срок действия промокода закончился';
        } else if (result.message.includes('превышен лимит')) {
          errorMessage += '💡 Достигнут лимит активаций для этого промокода';
        }
        
        await ctx.reply(errorMessage, { parse_mode: 'HTML' });
      }
      
    } catch (apiError) {
      console.error('Ошибка активации промокода через API:', apiError);
      
      // Удаляем сообщение ожидания
      await ctx.deleteMessage(waitMessage.message_id);
      
      await ctx.reply(
        '⚠️ <b>Ошибка сервера</b>\n\n' +
        'Не удалось активировать промокод из-за технической ошибки.\n' +
        'Попробуйте еще раз через несколько минут.\n\n' +
        'Если проблема повторяется, обратитесь в поддержку.',
        { parse_mode: 'HTML' }
      );
    }
    
  } catch (error) {
    console.error('Ошибка в команде promocode:', error);
    
    await ctx.reply(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Не удалось обработать команду активации промокода.\n' +
      'Попробуйте еще раз или обратитесь в поддержку.',
      { parse_mode: 'HTML' }
    );
  }
}

module.exports = promocodeCommand;