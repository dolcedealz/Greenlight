// admin/src/config.js
require('dotenv').config();

// Базовая конфигурация админ-бота
const config = {
  // API настройки
  // Принудительно устанавливаем правильный URL для продакшена
  apiUrl: 'https://greenlight-api-ghqh.onrender.com/api',
  adminToken: process.env.ADMIN_API_TOKEN,
  
  // Telegram Bot настройки
  botToken: process.env.ADMIN_BOT_TOKEN,
  adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => Number(id.trim())) : [],
  
  // Таймауты для API запросов
  apiTimeout: 30000,
  
  // Пагинация
  defaultPageSize: 10,
  maxPageSize: 50,
  
  // Лимиты
  maxSearchResults: 20,
  maxHistoryItems: 15,
  
  // Валидация
  validateRequired() {
    const errors = [];
    
    if (!this.adminToken) {
      errors.push('ADMIN_API_TOKEN не установлен');
    }
    
    if (!this.botToken) {
      errors.push('ADMIN_BOT_TOKEN не установлен');
    }
    
    if (this.adminIds.length === 0) {
      errors.push('ADMIN_IDS не установлен или пуст');
    }
    
    if (errors.length > 0) {
      console.error('❌ Ошибки конфигурации админ-бота:');
      errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }
    
    console.log('✅ Конфигурация админ-бота валидна');
    console.log(`   - API URL: ${this.apiUrl}`);
    console.log(`   - Админов: ${this.adminIds.length} (${this.adminIds.join(', ')})`);
    console.log(`   - API Token: ${this.adminToken ? 'Установлен' : 'НЕ установлен'}`);
    
    return true;
  }
};

// Выполняем валидацию при загрузке модуля
config.validateRequired();

module.exports = config;