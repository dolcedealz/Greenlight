#!/bin/bash

echo "================================"
echo "   E-commerce Parser v2.0"
echo "================================"
echo

# Переходим в папку скрипта
cd "$(dirname "$0")"

# Проверяем наличие Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден! Установите Python 3.8+"
    read -p "Нажмите Enter для выхода..."
    exit 1
fi

# Проверяем зависимости
echo "🔍 Проверяем зависимости..."
python3 -c "import selenium, pandas, requests, aiohttp, cloudinary, tqdm; from bs4 import BeautifulSoup" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Устанавливаем зависимости..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка установки зависимостей!"
        read -p "Нажмите Enter для выхода..."
        exit 1
    fi
fi

# Проверяем ChromeDriver
if ! command -v chromedriver &> /dev/null; then
    echo "🔧 ChromeDriver не найден. Устанавливаем..."
    if command -v brew &> /dev/null; then
        brew install --cask chromedriver
    else
        echo "❌ Установите ChromeDriver вручную или Homebrew"
        read -p "Нажмите Enter для выхода..."
        exit 1
    fi
fi

echo "✅ Все зависимости готовы!"
echo "🚀 Запускаем парсер..."
echo

# Запускаем парсер
python3 dolceparser_improved.py

echo
read -p "Нажмите Enter для выхода..."