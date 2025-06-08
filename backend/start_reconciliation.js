#!/usr/bin/env node

/**
 * ЗАПУСК СИСТЕМЫ СВЕРКИ БАЛАНСОВ
 * 
 * Этот скрипт запускает автоматическую периодическую сверку
 * балансов между нашей системой и CryptoBot.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const balanceReconciliationService = require('./src/services/balance-reconciliation.service');

class ReconciliationRunner {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Подключение к MongoDB установлено');
    } catch (error) {
      console.error('❌ Ошибка подключения к MongoDB:', error);
      throw error;
    }
  }

  async start(intervalMinutes = 60) {
    try {
      console.log('🚀 ЗАПУСК СИСТЕМЫ СВЕРКИ БАЛАНСОВ');
      console.log(`⏰ Интервал: каждые ${intervalMinutes} минут`);
      console.log('📡 Подключение к базе данных...');
      
      await this.connectDB();
      
      console.log('🔄 Запуск первой сверки...');
      
      // Запускаем первую сверку
      try {
        const firstReport = await balanceReconciliationService.performReconciliation();
        console.log(`✅ Первая сверка завершена: ${firstReport.status}`);
        
        if (firstReport.discrepancies?.severity === 'critical') {
          console.log('🚨 ВНИМАНИЕ: Обнаружены критические расхождения!');
        }
      } catch (error) {
        console.error('❌ Ошибка первой сверки:', error.message);
        console.log('⚠️ Продолжаем с периодической сверкой...');
      }
      
      // Запускаем периодическую сверку
      console.log(`🔄 Запуск периодической сверки каждые ${intervalMinutes} минут...`);
      
      this.intervalId = setInterval(async () => {
        try {
          console.log('⏰ Выполнение периодической сверки...');
          const report = await balanceReconciliationService.performReconciliation();
          
          if (report.discrepancies?.severity === 'critical') {
            console.log('🚨 КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ ОБНАРУЖЕНО!');
            console.log(`💰 Разница: ${report.discrepancies.discrepancy.toFixed(2)} USDT`);
            // Здесь можно добавить дополнительные действия при критических расхождениях
          }
          
        } catch (error) {
          console.error('❌ Ошибка периодической сверки:', error.message);
        }
      }, intervalMinutes * 60 * 1000);
      
      this.isRunning = true;
      
      console.log('✅ Система сверки балансов запущена');
      console.log('💡 Используйте Ctrl+C для остановки');
      
      // Обработка graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
    } catch (error) {
      console.error('💥 Критическая ошибка при запуске:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log('\n🔄 Остановка системы сверки...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('⏹️ Периодическая сверка остановлена');
    }
    
    try {
      await mongoose.disconnect();
      console.log('🔌 Соединение с БД закрыто');
    } catch (error) {
      console.error('⚠️ Ошибка при закрытии соединения:', error);
    }
    
    console.log('✅ Система сверки балансов остановлена');
    process.exit(0);
  }

  // Метод для запуска разовой сверки
  async runOnce() {
    try {
      console.log('🔍 Запуск разовой сверки балансов...');
      
      await this.connectDB();
      const report = await balanceReconciliationService.performReconciliation();
      
      console.log('\n📊 РЕЗУЛЬТАТ СВЕРКИ:');
      console.log(`🕐 Время: ${report.timestamp}`);
      console.log(`⚡ Длительность: ${report.duration}ms`);
      console.log(`📈 Статус: ${report.status.toUpperCase()}`);
      
      if (report.cryptoBot && report.expected) {
        console.log(`💰 CryptoBot: ${report.cryptoBot.total.toFixed(2)} USDT`);
        console.log(`📊 Ожидаемый: ${report.expected.expectedBalance.toFixed(2)} USDT`);
        console.log(`📉 Разница: ${report.discrepancies.discrepancy > 0 ? '+' : ''}${report.discrepancies.discrepancy.toFixed(2)} USDT`);
        console.log(`⚠️ Серьезность: ${report.discrepancies.severity.toUpperCase()}`);
      }
      
      if (report.recommendations?.length > 0) {
        console.log('\n💡 Рекомендации:');
        report.recommendations.forEach(rec => console.log(`  ${rec}`));
      }
      
      await mongoose.disconnect();
      console.log('\n✅ Разовая сверка завершена');
      
    } catch (error) {
      console.error('❌ Ошибка при разовой сверке:', error);
      process.exit(1);
    }
  }
}

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const runner = new ReconciliationRunner();

if (args.includes('--once')) {
  // Разовая сверка
  runner.runOnce();
} else {
  // Постоянная работа
  const intervalMinutes = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 60;
  runner.start(intervalMinutes);
}

module.exports = ReconciliationRunner;