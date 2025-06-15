#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт запуска E-commerce Parser
Простой способ запуска парсера с автоматической установкой зависимостей
"""

import subprocess
import sys
import os
from pathlib import Path

def install_requirements():
    """Установка зависимостей если они не установлены"""
    try:
        import selenium
        import pandas
        import requests
        import aiohttp
        import cloudinary
        import tqdm
        from bs4 import BeautifulSoup
        print("✅ Все зависимости уже установлены!")
        return True
    except ImportError as e:
        print(f"⚠️  Не хватает зависимостей: {e}")
        print("🔧 Устанавливаем зависимости...")
        
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
            ])
            print("✅ Зависимости успешно установлены!")
            return True
        except subprocess.CalledProcessError:
            print("❌ Ошибка установки зависимостей!")
            print("Попробуйте установить вручную: pip install -r requirements.txt")
            return False

def main():
    """Главная функция запуска"""
    print("🚀 E-commerce Parser v2.0")
    print("=" * 50)
    
    # Проверяем и устанавливаем зависимости
    if not install_requirements():
        input("Нажмите Enter для выхода...")
        return
    
    # Запускаем парсер
    try:
        print("🎯 Запускаем парсер...")
        
        # Импортируем и запускаем главную функцию из парсера
        from dolceparser_improved import main as parser_main
        parser_main()
        
    except ImportError:
        print("❌ Не удалось импортировать парсер!")
        print("Убедитесь, что файл dolceparser_improved.py находится в той же папке.")
    except Exception as e:
        print(f"❌ Ошибка запуска парсера: {e}")
    
    input("Нажмите Enter для выхода...")

if __name__ == "__main__":
    # Переходим в папку со скриптом
    os.chdir(Path(__file__).parent)
    main()