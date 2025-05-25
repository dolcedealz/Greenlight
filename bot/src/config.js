// bot/src/config.js
require('dotenv').config();

const config = {
  // Основные настройки
  botToken: process.env.BOT_TOKEN,
  webAppUrl: process.env.WEBAPP_URL,
  apiUrl: process.env.API_URL || 'http://localhost:3001/api',
  
  // Настройки бота
  commands: [
    { command: 'start', description: 'Запустить бота' },
    { command: 'help', description: 'Показать справку' },
    { command: 'play', description: 'Играть в казино' },
    { command: 'profile', description: 'Мой профиль' },
    { command: 'balance', description: 'Проверить баланс' },
    { command: 'deposit', description: 'Пополнить баланс' },
    { command: 'withdraw', description: 'Вывести средства' }, // ОБНОВЛЕНО
    { command: 'referral', description: 'Реферальная программа' }
  ],
  
  // Платежные настройки
  cryptoBot: {
    token: process.env.CRYPTO_PAY_API_TOKEN,
    apiUrl: process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api'
  },
  
  // Текст сообщений
  messages: {
    welcome: 'Добро пожаловать в Greenlight Casino!\n\nЗдесь вы можете играть в различные игры, делать ставки на события и многое другое. Используйте кнопки ниже для навигации.',
    help: 'Greenlight Casino - это платформа для азартных игр в Telegram.\n\nДоступные команды:\n/start - Запустить бота\n/play - Играть в казино\n/profile - Мой профиль\n/balance - Проверить баланс\n/deposit - Пополнить баланс\n/withdraw - Вывести средства\n/referral - Реферальная программа\n/help - Показать это сообщение',
    deposit: 'Выберите сумму и валюту для пополнения:',
    withdraw: 'Для вывода средств используйте WebApp интерфейс. Нажмите кнопку ниже.',
    referral: 'Приглашайте друзей и получайте 10% от их депозитов!\n\nВаша реферальная ссылка: ',
    profile: 'Информация о вашем профиле',
    invalidCommand: 'Неизвестная команда. Используйте /help для просмотра списка доступных команд.'
  }
};

module.exports = config;