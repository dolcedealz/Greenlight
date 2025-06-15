# 🎁 Система розыгрышей Greenlight Casino

Полная документация по настройке и использованию системы розыгрышей.

## 🚀 Быстрый старт

### 1. Настройка переменных окружения

Добавьте в `.env` файл:

```env
# Обязательные для базовой работы
MONGODB_URI=mongodb://localhost:27017/greenlight
BOT_TOKEN=your_telegram_bot_token
JWT_SECRET=your_jwt_secret

# Для полной функциональности
TELEGRAM_CHANNEL_ID=@your_channel_or_chat_id
ENABLE_GIVEAWAY_JOBS=true

# Для продакшена
NODE_ENV=production
```

### 2. Установка зависимостей

```bash
cd backend
npm install
```

### 3. Настройка тестовых данных

```bash
# Создать призы и тестовые розыгрыши
npm run setup-giveaways

# Или с очисткой существующих данных
npm run setup-giveaways:clear
```

### 4. Запуск сервера

```bash
# Разработка
npm run dev

# Продакшен
npm start
```

## 📋 Структура системы

### 🎯 Основные компоненты

1. **Frontend (React)**
   - `ProfileScreen.js` - вкладка "Розыгрыши"
   - `giveaway.api.js` - API клиент
   - CSS стили для UI

2. **Backend (Node.js/Express)**
   - Модели данных (Mongoose)
   - API контроллеры
   - Автоматические задачи (cron)
   - Telegram интеграция

3. **Автоматизация**
   - Создание ежедневных/недельных розыгрышей
   - Проведение розыгрышей
   - Уведомления в Telegram
   - Очистка старых данных

## 🗄️ Модели данных

### GiveawayPrize (Призы)
```javascript
{
  name: String,           // Название приза
  description: String,    // Описание
  image: String,         // URL изображения
  type: String,          // 'telegram_gift', 'promo_code', 'balance_bonus'
  value: Number,         // Стоимость/номинал
  giftData: {            // Данные Telegram Gift
    telegramGiftId: String,
    giftStickerId: String
  },
  isActive: Boolean,     // Активен ли приз
  createdBy: ObjectId    // Кто создал
}
```

### Giveaway (Розыгрыши)
```javascript
{
  title: String,         // Название розыгрыша
  type: String,          // 'daily' или 'weekly'
  prize: ObjectId,       // Ссылка на приз
  winnersCount: Number,  // Количество победителей
  status: String,        // 'pending', 'active', 'completed', 'cancelled'
  startDate: Date,       // Начало участия
  endDate: Date,         // Конец участия
  drawDate: Date,        // Время розыгрыша
  requiresDeposit: Boolean,
  depositTimeframe: String, // 'same_day', 'same_week'
  participationCount: Number,
  telegramMessageId: String,
  reminderSent: Boolean,
  diceResult: {
    value: Number,
    messageId: String,
    timestamp: Date
  },
  winners: [{
    user: ObjectId,
    position: Number,
    selectedAt: Date,
    notified: Boolean
  }],
  createdBy: ObjectId
}
```

### GiveawayParticipation (Участие)
```javascript
{
  giveaway: ObjectId,      // Ссылка на розыгрыш
  user: ObjectId,          // Участник
  deposit: ObjectId,       // Депозит для участия
  depositAmount: Number,   // Сумма депозита
  depositDate: Date,       // Дата депозита
  participationNumber: Number, // Номер участника
  isWinner: Boolean,       // Выиграл ли
  winnerPosition: Number,  // Позиция в списке победителей
  status: String          // 'active', 'winner', 'not_winner'
}
```

## 🔄 API Endpoints

### Пользовательские

```
GET /api/giveaways/active
- Получить активные розыгрыши

POST /api/giveaways/:id/participate
- Участие в розыгрыше

GET /api/giveaways/:id/participation-status
- Проверить статус участия

GET /api/giveaways/my-participations
- История участия пользователя
```

### Административные

```
# Призы
GET /api/admin/giveaways/prizes
POST /api/admin/giveaways/prizes
PUT /api/admin/giveaways/prizes/:id
DELETE /api/admin/giveaways/prizes/:id

# Розыгрыши
GET /api/admin/giveaways/giveaways
POST /api/admin/giveaways/giveaways
PUT /api/admin/giveaways/giveaways/:id
POST /api/admin/giveaways/giveaways/:id/activate
POST /api/admin/giveaways/giveaways/:id/cancel
POST /api/admin/giveaways/giveaways/:id/conduct

# Участники и статистика
GET /api/admin/giveaways/giveaways/:id/participants
GET /api/admin/giveaways/stats
```

## ⏰ Автоматические задачи

### Расписание

1. **Проверка розыгрышей** - каждые 5 минут
2. **Создание ежедневных** - 00:01 каждый день
3. **Создание недельных** - 00:01 каждое воскресенье
4. **Напоминания** - каждый час
5. **Очистка данных** - 02:00 каждый день

### Управление

```javascript
// Включить в продакшене
NODE_ENV=production

// Или принудительно
ENABLE_GIVEAWAY_JOBS=true
```

## 📱 Telegram интеграция

### Настройка бота

1. Создайте бота через @BotFather
2. Получите токен: `BOT_TOKEN`
3. Добавьте бота в канал
4. Получите ID канала: `TELEGRAM_CHANNEL_ID`

### Функции

- **Прозрачность**: Бросок кубика для рандома
- **Уведомления**: Результаты в канале
- **Личные сообщения**: Уведомления победителям
- **Объявления**: Старт/напоминания о розыгрышах

## 🛠️ Администрирование

### Создание приза

```bash
curl -X POST http://localhost:3000/api/admin/giveaways/prizes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Золотая звезда",
    "description": "Эксклюзивный подарок",
    "type": "telegram_gift",
    "value": 500,
    "giftData": {
      "telegramGiftId": "gold_star_001",
      "giftStickerId": "star_gold"
    }
  }'
```

### Создание розыгрыша

```bash
curl -X POST http://localhost:3000/api/admin/giveaways/giveaways \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Специальный розыгрыш",
    "type": "daily",
    "prizeId": "PRIZE_ID",
    "winnersCount": 1,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-01T19:00:00Z",
    "drawDate": "2024-01-01T20:00:00Z"
  }'
```

## 🔧 Настройка разработки

### Запуск без автоматических задач

```bash
# .env
ENABLE_GIVEAWAY_JOBS=false
NODE_ENV=development

npm run dev
```

### Тестирование

```bash
# Создать тестовые данные
npm run setup-giveaways

# Проверить API
curl http://localhost:3000/api/giveaways/active
```

## 📊 Мониторинг

### Логи

Система логирует:
- Создание розыгрышей
- Проведение розыгрышей
- Ошибки Telegram API
- Статистику участия

### Здоровье системы

```bash
curl http://localhost:3000/api/health
```

## 🚨 Устранение неполадок

### Частые проблемы

1. **Розыгрыши не создаются автоматически**
   - Проверьте `ENABLE_GIVEAWAY_JOBS=true`
   - Проверьте наличие призов в базе

2. **Telegram не работает**
   - Проверьте `BOT_TOKEN`
   - Проверьте права бота в канале
   - Проверьте `TELEGRAM_CHANNEL_ID`

3. **Участие не работает**
   - Проверьте депозиты пользователя
   - Проверьте статус розыгрыша
   - Проверьте временные рамки

### Команды отладки

```bash
# Просмотр задач
curl http://localhost:3000/api/admin/giveaways/stats

# Принудительный запуск розыгрыша
curl -X POST http://localhost:3000/api/admin/giveaways/giveaways/ID/conduct

# Просмотр участников
curl http://localhost:3000/api/admin/giveaways/giveaways/ID/participants
```

## 🔒 Безопасность

- Все административные API требуют аутентификации
- Валидация входных данных
- Проверка прав пользователей
- Логирование всех операций
- Защита от повторного участия

## 📈 Масштабирование

Система готова для продакшена:
- Эффективные индексы MongoDB
- Пагинация результатов
- Gzip сжатие
- Graceful shutdown
- Мониторинг производительности

---

## 🎯 Следующие шаги

1. Настройте переменные окружения
2. Запустите `npm run setup-giveaways`
3. Создайте админа в системе
4. Настройте Telegram бота
5. Запустите в продакшене

**Готово! Система розыгрышей полностью функциональна! 🎉**