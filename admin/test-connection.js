#!/usr/bin/env node

/**
 * Тест подключения админ-бота к backend API
 * Проверяет доступность всех ключевых эндпоинтов
 */

require('dotenv').config();
const axios = require('axios');

const apiUrl = process.env.API_URL || 'https://api.greenlight-casino.eu/api';
const adminToken = process.env.ADMIN_API_TOKEN;

console.log('🔧 ТЕСТ ПОДКЛЮЧЕНИЯ АДМИН-БОТА\n');
console.log(`API URL: ${apiUrl}`);
console.log(`Admin Token: ${adminToken ? 'Установлен' : 'НЕ УСТАНОВЛЕН'}\n`);

const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Список эндпоинтов для тестирования
const endpoints = [
  { method: 'GET', path: '/admin/finance/report', name: 'Финансовый отчет' },
  { method: 'GET', path: '/admin/finance/state', name: 'Состояние финансов' },
  { method: 'GET', path: '/admin/stats', name: 'Статистика казино' },
  { method: 'GET', path: '/admin/stats/users', name: 'Статистика пользователей' },
  { method: 'GET', path: '/admin/users', name: 'Список пользователей' },
  { method: 'GET', path: '/admin/withdrawals/pending', name: 'Ожидающие выводы' },
  { method: 'GET', path: '/admin/withdrawals/stats', name: 'Статистика выводов' },
  { method: 'GET', path: '/admin/finance/game-stats', name: 'Статистика игр' }
];

async function testEndpoint(endpoint) {
  try {
    const response = await apiClient.request({
      method: endpoint.method,
      url: endpoint.path
    });
    
    if (response.data.success) {
      console.log(`✅ ${endpoint.name}: Успешно`);
      return { success: true, endpoint: endpoint.name };
    } else {
      console.log(`❌ ${endpoint.name}: Неуспешный ответ - ${response.data.message}`);
      return { success: false, endpoint: endpoint.name, error: response.data.message };
    }
  } catch (error) {
    console.log(`❌ ${endpoint.name}: Ошибка - ${error.response?.status} ${error.message}`);
    return { success: false, endpoint: endpoint.name, error: error.message };
  }
}

async function runTests() {
  if (!adminToken) {
    console.log('❌ КРИТИЧЕСКАЯ ОШИБКА: ADMIN_API_TOKEN не установлен!');
    console.log('   Установите переменную окружения ADMIN_API_TOKEN');
    process.exit(1);
  }

  console.log('🚀 Запуск тестов...\n');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Небольшая пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Успешных: ${successful.length}/${results.length}`);
  console.log(`❌ Неудачных: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Неудачные эндпоинты:');
    failed.forEach(f => {
      console.log(`   - ${f.endpoint}: ${f.error}`);
    });
  }
  
  if (successful.length === results.length) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
    console.log('   Админ-бот готов к работе');
  } else {
    console.log('\n⚠️  ОБНАРУЖЕНЫ ПРОБЛЕМЫ');
    console.log('   Некоторые функции админ-бота могут не работать');
  }
}

// Запускаем тесты
runTests().catch(error => {
  console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
  process.exit(1);
});