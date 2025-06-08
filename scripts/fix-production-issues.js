#!/usr/bin/env node

/**
 * Скрипт для исправления проблем с безопасностью перед продакшеном
 * Запустите: node scripts/fix-production-issues.js
 */

const fs = require('fs');
const path = require('path');

const issues = [
  {
    file: 'backend/src/services/auth.service.js',
    pattern: /process\.env\.JWT_SECRET \|\| 'default-secret-key'/g,
    replacement: 'process.env.JWT_SECRET',
    description: 'Удаление fallback для JWT_SECRET'
  },
  {
    file: 'backend/src/utils/telegram-auth.js',
    pattern: /process\.env\.JWT_SECRET \|\| 'fallback-secret-key'/g,
    replacement: 'process.env.JWT_SECRET',
    description: 'Удаление fallback для JWT_SECRET'
  },
  {
    file: 'frontend/src/services/websocket.service.js',
    pattern: /process\.env\.NODE_ENV === 'production'\s*\?\s*'https:\/\/greenlight-api-ghqh\.onrender\.com'\s*:\s*\(process\.env\.REACT_APP_WS_URL \|\| 'https:\/\/greenlight-api-ghqh\.onrender\.com'\)/g,
    replacement: "process.env.REACT_APP_WS_URL || 'https://greenlight-api-ghqh.onrender.com'",
    description: 'Упрощение URL для WebSocket'
  },
  {
    file: 'frontend/src/services/api.js',
    pattern: /const API_BASE_URL = process\.env\.NODE_ENV === 'production'\s*\?\s*'https:\/\/greenlight-api-ghqh\.onrender\.com\/api'\s*:\s*\(process\.env\.REACT_APP_API_URL \|\| 'http:\/\/localhost:3001\/api'\);/g,
    replacement: "const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';",
    description: 'Упрощение API URL'
  }
];

console.log('🔧 Исправление проблем с безопасностью для продакшена...\n');

let fixedCount = 0;
let errorCount = 0;

issues.forEach(issue => {
  const filePath = path.join(__dirname, '..', issue.file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Файл не найден: ${issue.file}`);
      errorCount++;
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    content = content.replace(issue.pattern, issue.replacement);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Исправлено: ${issue.file}`);
      console.log(`   ${issue.description}`);
      fixedCount++;
    } else {
      console.log(`ℹ️  Уже исправлено: ${issue.file}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при обработке ${issue.file}:`, error.message);
    errorCount++;
  }
});

console.log('\n📊 Результаты:');
console.log(`   Исправлено файлов: ${fixedCount}`);
console.log(`   Ошибок: ${errorCount}`);

// Дополнительные проверки
console.log('\n🔍 Дополнительные рекомендации:');
console.log('1. Убедитесь, что все переменные окружения установлены в Render.com');
console.log('2. Проверьте CORS настройки в backend/src/app.js');
console.log('3. Удалите все console.log из production кода');
console.log('4. Проверьте rate limiting настройки');
console.log('5. Настройте правильные логи для production');

console.log('\n✨ Готово! Не забудьте проверить изменения перед коммитом.');