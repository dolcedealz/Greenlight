@echo off
echo ================================
echo   E-commerce Parser v2.0
echo ================================
echo.

REM Проверяем наличие Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python не найден! Установите Python 3.8+
    pause
    exit /b 1
)

REM Устанавливаем зависимости
echo Проверяем зависимости...
python -c "import selenium, pandas, requests, aiohttp, cloudinary, tqdm; from bs4 import BeautifulSoup" >nul 2>&1
if %errorlevel% neq 0 (
    echo Устанавливаем зависимости...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo Ошибка установки зависимостей!
        pause
        exit /b 1
    )
)

REM Запускаем парсер
echo Запускаем парсер...
python dolceparser_improved.py

pause