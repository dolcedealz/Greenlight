# Production Checklist для Greenlight Casino

## ✅ Выполнено:
- [x] Удалены fallback значения для JWT_SECRET
- [x] URL берутся из переменных окружения
- [x] Создана документация по переменным окружения
- [x] Настроен Helmet для безопасности
- [x] Настроен CORS для конкретных доменов
- [x] Включена компрессия для production
- [x] Настроен rate limiting

## ⚠️ Требует внимания:

### 1. CORS домены
Текущие разрешенные домены:
- https://greenlight-frontend.onrender.com
- https://www.greenlight-casino.eu
- https://greenlight-casino.eu

**Действие:** Убедитесь, что домен greenlight-casino.eu вам принадлежит или обновите список.

### 2. Rate Limiting
Используется in-memory хранилище.
**Действие:** Для масштабирования рекомендуется перейти на Redis.

### 3. Логирование
В коде много console.log.
**Действие:** Рассмотрите использование Winston или Pino для production логов.

### 4. Frontend переменные окружения
**Действие:** Убедитесь, что в Render установлены:
- REACT_APP_API_URL=https://greenlight-api-ghqh.onrender.com/api
- REACT_APP_WS_URL=https://greenlight-api-ghqh.onrender.com

## 🔒 Безопасность:

### Проверьте в Render:
- [ ] JWT_SECRET - минимум 32 символа
- [ ] ADMIN_API_TOKEN - минимум 32 символа
- [ ] BOT_TOKEN и ADMIN_BOT_TOKEN установлены
- [ ] MONGODB_URI с правильными credentials
- [ ] CRYPTO_PAY_API_TOKEN установлен

### База данных:
- [ ] MongoDB Atlas whitelist настроен (0.0.0.0/0 или IP Render)
- [ ] Backup стратегия настроена
- [ ] Индексы созданы для производительности

## 🚀 Перед деплоем:

1. **Тестирование:**
   ```bash
   npm test # если есть тесты
   ```

2. **Сборка frontend:**
   ```bash
   cd frontend && npm run build
   ```

3. **Проверка переменных:**
   - Все критические переменные установлены в Render
   - Нет хардкоженных секретов в коде

4. **Мониторинг:**
   - [ ] Настроить алерты для ошибок
   - [ ] Настроить мониторинг uptime
   - [ ] Настроить логирование ошибок

## 📱 После деплоя:

1. **Проверить функциональность:**
   - [ ] Telegram bot отвечает
   - [ ] Admin bot работает
   - [ ] Frontend загружается
   - [ ] Можно войти через Telegram
   - [ ] WebSocket подключается
   - [ ] Игры работают
   - [ ] События отображаются
   - [ ] Ставки размещаются

2. **Безопасность:**
   - [ ] HTTPS работает
   - [ ] Headers безопасности установлены
   - [ ] Rate limiting работает
   - [ ] CORS блокирует неразрешенные домены

3. **Производительность:**
   - [ ] Страницы загружаются быстро
   - [ ] API отвечает быстро
   - [ ] WebSocket стабилен

## 🆘 Rollback план:

Если что-то пошло не так:
```bash
git revert HEAD
git push
```

Или в Render: Deploy -> Rollback to previous deploy

## 📞 Контакты для экстренных случаев:

- Render Support: https://render.com/support
- MongoDB Atlas Support: https://www.mongodb.com/support