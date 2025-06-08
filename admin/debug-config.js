#!/usr/bin/env node

/**
 * Отладка конфигурации админ-бота
 * Проверяет все переменные окружения и настройки
 */

require('dotenv').config();

console.log('🔧 ОТЛАДКА КОНФИГУРАЦИИ АДМИН-БОТА\n');

console.log('=== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ===');
console.log(`API_URL: ${process.env.API_URL || 'НЕ УСТАНОВЛЕНА'}`);
console.log(`ADMIN_API_TOKEN: ${process.env.ADMIN_API_TOKEN ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН'}`);
console.log(`ADMIN_BOT_TOKEN: ${process.env.ADMIN_BOT_TOKEN ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН'}`);
console.log(`ADMIN_IDS: ${process.env.ADMIN_IDS || 'НЕ УСТАНОВЛЕНЫ'}`);

console.log('\n=== ФАЙЛЫ КОНФИГУРАЦИИ ===');

// Проверяем config.js
try {
  const config = require('./src/config');
  console.log(`config.js - apiUrl: ${config.apiUrl}`);
  console.log(`config.js - adminToken: ${config.adminToken ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН'}`);
} catch (error) {
  console.log(`config.js - ОШИБКА: ${error.message}`);
}

// Проверяем команды
const commands = [
  'index.js',
  'stats.command.js', 
  'users.command.js',
  'transactions.command.js',
  'promo.command.js',
  'monitoring.command.js'
];

console.log('\n=== ПРОВЕРКА КОМАНД ===');
for (const command of commands) {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'src', 'commands', command);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Ищем hardcoded URLs
      const hardcodedUrls = content.match(/https:\/\/[^'"\s]+/g) || [];
      const hasProcessEnv = content.includes('process.env.API_URL');
      
      console.log(`${command}:`);
      console.log(`  - Использует process.env.API_URL: ${hasProcessEnv ? 'ДА' : 'НЕТ'}`);
      
      if (hardcodedUrls.length > 0) {
        console.log(`  - Найдены hardcoded URLs: ${hardcodedUrls.join(', ')}`);
      } else {
        console.log(`  - Hardcoded URLs: НЕ НАЙДЕНЫ`);
      }
    } else {
      console.log(`${command}: ФАЙЛ НЕ НАЙДЕН`);
    }
  } catch (error) {
    console.log(`${command}: ОШИБКА - ${error.message}`);
  }
}

console.log('\n=== ПРОВЕРКА HANDLERS ===');
try {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, 'src', 'handlers', 'callback.handler.js');
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const hardcodedUrls = content.match(/https:\/\/[^'"\s]+/g) || [];
    const hasProcessEnv = content.includes('process.env.API_URL');
    
    console.log(`callback.handler.js:`);
    console.log(`  - Использует process.env.API_URL: ${hasProcessEnv ? 'ДА' : 'НЕТ'}`);
    
    if (hardcodedUrls.length > 0) {
      console.log(`  - Найдены hardcoded URLs: ${hardcodedUrls.join(', ')}`);
    } else {
      console.log(`  - Hardcoded URLs: НЕ НАЙДЕНЫ`);
    }
  }
} catch (error) {
  console.log(`callback.handler.js: ОШИБКА - ${error.message}`);
}

console.log('\n=== РЕКОМЕНДАЦИИ ===');

if (!process.env.API_URL) {
  console.log('❌ Установите переменную API_URL в .env файл');
  console.log('   Пример: API_URL=https://api.greenlight-casino.eu/api');
}

if (!process.env.ADMIN_API_TOKEN) {
  console.log('❌ Установите переменную ADMIN_API_TOKEN в .env файл');
}

if (!process.env.ADMIN_BOT_TOKEN) {
  console.log('❌ Установите переменную ADMIN_BOT_TOKEN в .env файл');
}

if (!process.env.ADMIN_IDS) {
  console.log('❌ Установите переменную ADMIN_IDS в .env файл');
  console.log('   Пример: ADMIN_IDS=418684940,123456789');
}

console.log('\n✅ Отладка завершена');