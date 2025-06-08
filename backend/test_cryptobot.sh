#!/bin/bash

# Test CryptoBot API
# Usage: ./test_cryptobot.sh

# Загружаем переменные окружения
source .env

if [ -z "$CRYPTO_PAY_API_TOKEN" ]; then
    echo "❌ CRYPTO_PAY_API_TOKEN не найден в .env"
    exit 1
fi

echo "🔍 Тестирование CryptoBot API..."
echo "================================"

# 1. Проверка токена и информации о приложении
echo -e "\n1️⃣ Получение информации о приложении:"
curl -s -X GET https://pay.crypt.bot/api/getMe \
  -H "Crypto-Pay-API-Token: $CRYPTO_PAY_API_TOKEN" | jq '.'

# 2. Проверка баланса
echo -e "\n2️⃣ Проверка баланса:"
curl -s -X GET https://pay.crypt.bot/api/getBalance \
  -H "Crypto-Pay-API-Token: $CRYPTO_PAY_API_TOKEN" | jq '.'

# 3. Получение доступных валют
echo -e "\n3️⃣ Доступные валюты:"
curl -s -X GET https://pay.crypt.bot/api/getCurrencies \
  -H "Crypto-Pay-API-Token: $CRYPTO_PAY_API_TOKEN" | jq '.result[] | select(.is_fiat == false) | {code: .code, name: .name}'

# 4. Проверка курсов обмена
echo -e "\n4️⃣ Курсы обмена USDT:"
curl -s -X GET https://pay.crypt.bot/api/getExchangeRates \
  -H "Crypto-Pay-API-Token: $CRYPTO_PAY_API_TOKEN" | jq '.result[] | select(.source == "USDT") | {target: .target, rate: .rate}'

# 5. Проверка нашего webhook endpoint
echo -e "\n5️⃣ Проверка webhook endpoint:"
curl -s -X GET https://api.greenlight-casino.eu/api/webhooks/cryptobot | jq '.'

echo -e "\n✅ Тестирование завершено!"