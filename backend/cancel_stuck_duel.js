#!/usr/bin/env node

/**
 * Скрипт для отмены зависшей дуэли через внутренний API
 */

require('dotenv').config();
const { adminController } = require('./src/controllers');

async function cancelStuckDuel() {
  try {
    console.log('🔧 Отменяем зависшую дуэль...');
    
    // Имитируем req/res объекты
    const req = {
      body: {
        sessionId: "duel_1749471106226_julbexlog",
        reason: "admin_cancel_stuck"
      }
    };
    
    const res = {
      json: (data) => {
        console.log('✅ Результат:', JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Ошибка (${code}):`, JSON.stringify(data, null, 2));
        }
      })
    };
    
    // Вызываем контроллер напрямую
    await adminController.cancelStuckDuel(req, res);
    
  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  }
}

// Запуск
cancelStuckDuel().then(() => {
  console.log('🏁 Скрипт завершен');
  process.exit(0);
}).catch(error => {
  console.error('💥 Необработанная ошибка:', error);
  process.exit(1);
});