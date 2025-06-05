// webapp-utils.js
const config = require('../config');

/**
 * Получение URL для WebApp с проверкой
 * @param {string} query - Query параметры для добавления к URL
 * @returns {Object} - { isValid: boolean, url?: string, error?: string }
 */
function getWebAppUrl(query = '') {
  if (!config.webAppUrl) {
    console.error('❌ WEBAPP_URL не настроен в переменных окружения');
    return {
      isValid: false,
      error: 'Веб-приложение временно недоступно. Обратитесь к администратору.'
    };
  }
  
  const url = query ? `${config.webAppUrl}${query}` : config.webAppUrl;
  
  return {
    isValid: true,
    url
  };
}

/**
 * Создание webApp кнопки с проверкой
 * @param {string} text - Текст кнопки
 * @param {string} query - Query параметры
 * @returns {Object|null} - Кнопка или null если URL недоступен
 */
function createWebAppButton(text, query = '') {
  const { Markup } = require('telegraf');
  const webAppData = getWebAppUrl(query);
  
  if (!webAppData.isValid) {
    return null;
  }
  
  return Markup.button.webApp(text, webAppData.url);
}

/**
 * Создание inline клавиатуры с WebApp кнопками
 * @param {Array} buttons - Массив кнопок: [{ text, query }, ...]
 * @returns {Object} - Inline клавиатура или сообщение об ошибке
 */
function createWebAppKeyboard(buttons) {
  const { Markup } = require('telegraf');
  
  if (!config.webAppUrl) {
    return {
      isValid: false,
      error: 'Веб-приложение временно недоступно. Обратитесь к администратору.',
      keyboard: Markup.inlineKeyboard([])
    };
  }
  
  const keyboard = buttons.map(row => {
    if (Array.isArray(row)) {
      return row.map(btn => Markup.button.webApp(btn.text, `${config.webAppUrl}${btn.query || ''}`));
    } else {
      return [Markup.button.webApp(row.text, `${config.webAppUrl}${row.query || ''}`)];
    }
  });
  
  return {
    isValid: true,
    keyboard: Markup.inlineKeyboard(keyboard)
  };
}

module.exports = {
  getWebAppUrl,
  createWebAppButton,
  createWebAppKeyboard
};