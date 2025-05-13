# Greenlight Casino - Telegram Mini-App

Greenlight Casino - это современное онлайн-казино, интегрированное в Telegram с помощью технологии Mini-App. Это полноценная игровая платформа с собственной экономикой, основанной на USDT, включающая разнообразные игры, систему ставок на события и социальные элементы для взаимодействия между пользователями.

## Особенности

- 🎮 **Разнообразные игры**: Слоты, Мины, Краш, Монетка
- 🔮 **Ставки на события**: Предсказывайте исходы спортивных, крипто и других событий
- 💰 **Криптовалютные платежи**: Пополнение и вывод средств через CryptoBot
- 👥 **Реферальная система**: Приглашайте друзей и получайте бонусы
- 📱 **Telegram-интеграция**: Полностью нативный опыт внутри Telegram

## Структура проекта

Проект разделен на несколько компонентов:

- **frontend**: Интерфейс Telegram Mini-App
- **backend**: Серверная часть с API и игровой логикой
- **bot**: Telegram-бот для доступа к казино
- **admin**: Административный бот для управления

## Технологии

### Frontend
- React.js
- Telegram WebApp API
- Webpack
- Socket.io-client

### Backend
- Node.js
- Express
- MongoDB
- Socket.io
- JWT authentication

### Telegram Bot
- Node.js
- Telegraf.js
- Axios

## Установка и запуск

### Предварительные требования

- Node.js v14+
- MongoDB
- Telegram Bot API token (получить у @BotFather)
- CryptoBot API token (для платежей)

### Настройка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/greenlight-casino.git
cd greenlight-casino
```

2. Установите зависимости для всех компонентов:
```bash
npm run install:all
```

3. Создайте и настройте файлы .env для каждого компонента:
```
# для backend/.env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/greenlight
JWT_SECRET=your_jwt_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# для bot/.env
BOT_TOKEN=your_telegram_bot_token
WEBAPP_URL=https://your-domain.com
API_URL=http://localhost:3001/api
CRYPTO_PAY_API_TOKEN=your_cryptobot_token
```

### Запуск (для разработки)

1. Запустите сервер:
```bash
cd backend
npm run dev
```

2. В отдельном терминале запустите бота:
```bash
cd bot
npm run dev
```

3. В отдельном терминале запустите frontend:
```bash
cd frontend
npm start
```

## Deployment

Для продакшн-деплоя рекомендуется использовать Docker:

```bash
docker-compose up -d
```

## Лицензия

[MIT](LICENSE)