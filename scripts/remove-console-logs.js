#!/usr/bin/env node

/**
 * Скрипт для удаления console.log из production сборки frontend
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '..', 'frontend', 'src');

// Паттерны для поиска console.* в коде
const CONSOLE_PATTERNS = [
  /console\.log\([^)]*\);?\s*$/gm,
  /console\.warn\([^)]*\);?\s*$/gm,
  /console\.error\([^)]*\);?\s*$/gm,
  /console\.info\([^)]*\);?\s*$/gm,
  /console\.debug\([^)]*\);?\s*$/gm,
];

// Файлы которые нужно пропустить (где console.log нужен для отладки)
const SKIP_FILES = [
  'logger.js',
  'debug.js'
];

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(skipFile => filePath.includes(skipFile));
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { processed: false, reason: 'skipped' };
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let removedCount = 0;

    // Применяем все паттерны
    CONSOLE_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        removedCount += matches.length;
        content = content.replace(pattern, '');
      }
    });

    // Удаляем пустые строки, которые остались после удаления console.*
    content = content.replace(/^\s*$/gm, '').replace(/\n\n\n+/g, '\n\n');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return { processed: true, removedCount };
    }

    return { processed: false, reason: 'no_console_found' };
  } catch (error) {
    return { processed: false, error: error.message };
  }
}

function findJsFiles(dir) {
  const files = [];
  
  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.')) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    });
  }
  
  scanDirectory(dir);
  return files;
}

console.log('🧹 Удаление console.log из frontend кода...\n');

const jsFiles = findJsFiles(FRONTEND_SRC);
console.log(`Найдено ${jsFiles.length} JS/JSX файлов для обработки\n`);

let processedCount = 0;
let skippedCount = 0;
let errorCount = 0;
let totalRemovedLogs = 0;

jsFiles.forEach(filePath => {
  const relativePath = path.relative(FRONTEND_SRC, filePath);
  const result = processFile(filePath);
  
  if (result.processed) {
    console.log(`✅ ${relativePath} - удалено ${result.removedCount} console.*`);
    processedCount++;
    totalRemovedLogs += result.removedCount;
  } else if (result.reason === 'skipped') {
    console.log(`⏭️  ${relativePath} - пропущен`);
    skippedCount++;
  } else if (result.error) {
    console.log(`❌ ${relativePath} - ошибка: ${result.error}`);
    errorCount++;
  } else {
    // Файл без console.log - не выводим
  }
});

console.log('\n📊 Результаты:');
console.log(`   Обработано файлов: ${processedCount}`);
console.log(`   Пропущено файлов: ${skippedCount}`);
console.log(`   Ошибок: ${errorCount}`);
console.log(`   Всего удалено console.*: ${totalRemovedLogs}`);

// Проверяем остались ли console.* в коде
console.log('\n🔍 Проверка оставшихся console.*...');
let remainingConsoles = 0;

jsFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/console\.[a-zA-Z]+\(/g);
  if (matches) {
    const relativePath = path.relative(FRONTEND_SRC, filePath);
    console.log(`⚠️  ${relativePath} - осталось ${matches.length} console.*`);
    remainingConsoles += matches.length;
  }
});

if (remainingConsoles === 0) {
  console.log('✨ Все console.* успешно удалены!');
} else {
  console.log(`⚠️  Осталось ${remainingConsoles} console.* (возможно, в условных блоках)`);
}

console.log('\n🚀 Готово! Frontend код очищен для production.');