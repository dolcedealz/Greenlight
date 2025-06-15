// backend/src/services/telegram-gift.service.js
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TelegramGiftService {
  constructor() {
    this.baseUrl = 'https://t.me';
  }

  /**
   * Парсит информацию о Telegram Gift из ссылки
   * @param {string} giftUrl - URL подарка (например: https://t.me/nft/ToyBear-37305)
   * @returns {Promise<Object>} Информация о подарке
   */
  async parseGiftFromUrl(giftUrl) {
    try {
      console.log('Парсинг Telegram Gift:', giftUrl);
      
      // Валидация URL
      if (!this.isValidTelegramGiftUrl(giftUrl)) {
        throw new Error('Некорректная ссылка на Telegram Gift');
      }

      // Извлекаем ID из URL
      const giftId = this.extractGiftIdFromUrl(giftUrl);
      console.log('Извлеченный Gift ID:', giftId);

      // Получаем данные через Web App API
      const giftData = await this.fetchGiftData(giftUrl);
      
      // Проверяем изображение (не скачиваем)
      const imageData = await this.validateGiftImage(giftData.imageUrl);
      
      return {
        giftId: giftId,
        name: giftData.name,
        description: giftData.description,
        imageUrl: imageData.imageUrl,
        imageValid: imageData.isValid,
        rarity: giftData.rarity,
        collection: giftData.collection,
        attributes: giftData.attributes,
        totalSupply: giftData.totalSupply,
        currentSupply: giftData.currentSupply,
        originalUrl: giftUrl,
        parsedAt: new Date()
      };
    } catch (error) {
      console.error('Ошибка парсинга Telegram Gift:', error);
      throw error;
    }
  }

  /**
   * Валидация URL Telegram Gift
   */
  isValidTelegramGiftUrl(url) {
    const regex = /^https:\/\/t\.me\/nft\/[\w-]+$/i;
    return regex.test(url);
  }

  /**
   * Извлечение ID подарка из URL
   */
  extractGiftIdFromUrl(url) {
    const match = url.match(/\/nft\/([\w-]+)$/);
    return match ? match[1] : null;
  }

  /**
   * Получение данных о подарке
   */
  async fetchGiftData(giftUrl) {
    try {
      // Используем WebApp API для получения Open Graph данных
      const response = await axios.get(giftUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const html = response.data;
      
      // Парсим метаданные
      const metaData = this.parseMetaData(html);
      
      return {
        name: metaData.title || 'Telegram Gift',
        description: metaData.description || 'Подарок из Telegram',
        imageUrl: metaData.image || null,
        rarity: this.extractRarity(html),
        collection: this.extractCollection(html),
        attributes: this.extractAttributes(html),
        totalSupply: this.extractTotalSupply(html),
        currentSupply: this.extractCurrentSupply(html)
      };
    } catch (error) {
      console.error('Ошибка получения данных подарка:', error);
      
      // Fallback данные
      const giftId = this.extractGiftIdFromUrl(giftUrl);
      return {
        name: giftId ? giftId.replace(/[_-]/g, ' ') : 'Telegram Gift',
        description: 'Подарок из Telegram',
        imageUrl: null,
        rarity: null,
        collection: 'Telegram Gifts',
        attributes: [],
        totalSupply: null,
        currentSupply: null
      };
    }
  }

  /**
   * Парсинг мета-тегов из HTML
   */
  parseMetaData(html) {
    const metaData = {};
    
    // Open Graph теги
    const ogMatches = {
      title: html.match(/<meta property="og:title" content="([^"]*)"[^>]*>/i),
      description: html.match(/<meta property="og:description" content="([^"]*)"[^>]*>/i),
      image: html.match(/<meta property="og:image" content="([^"]*)"[^>]*>/i)
    };

    // Twitter Card теги
    const twitterMatches = {
      title: html.match(/<meta name="twitter:title" content="([^"]*)"[^>]*>/i),
      description: html.match(/<meta name="twitter:description" content="([^"]*)"[^>]*>/i),
      image: html.match(/<meta name="twitter:image" content="([^"]*)"[^>]*>/i)
    };

    // Стандартные мета теги
    const standardMatches = {
      title: html.match(/<title>([^<]*)<\/title>/i),
      description: html.match(/<meta name="description" content="([^"]*)"[^>]*>/i)
    };

    // Приоритет: Open Graph > Twitter > Стандартные
    metaData.title = (ogMatches.title && ogMatches.title[1]) ||
                     (twitterMatches.title && twitterMatches.title[1]) ||
                     (standardMatches.title && standardMatches.title[1]) ||
                     null;

    metaData.description = (ogMatches.description && ogMatches.description[1]) ||
                          (twitterMatches.description && twitterMatches.description[1]) ||
                          (standardMatches.description && standardMatches.description[1]) ||
                          null;

    metaData.image = (ogMatches.image && ogMatches.image[1]) ||
                     (twitterMatches.image && twitterMatches.image[1]) ||
                     null;

    return metaData;
  }

  /**
   * Извлечение редкости
   */
  extractRarity(html) {
    const rarityMatch = html.match(/(\d+(?:\.\d+)?%)\s*rarity/i);
    return rarityMatch ? rarityMatch[1] : null;
  }

  /**
   * Извлечение коллекции
   */
  extractCollection(html) {
    const collectionMatch = html.match(/collection[:\s]*([^<\n]+)/i);
    return collectionMatch ? collectionMatch[1].trim() : 'Telegram Gifts';
  }

  /**
   * Извлечение атрибутов
   */
  extractAttributes(html) {
    const attributes = [];
    
    // Ищем специфичные для NFT атрибуты
    const nftPatterns = [
      // Model, Backdrop, Symbol и другие характеристики
      /Model:\s*([^<\n]+)/gi,
      /Backdrop:\s*([^<\n]+)/gi,
      /Symbol:\s*([^<\n]+)/gi,
      /Outfit:\s*([^<\n]+)/gi,
      /Eyes:\s*([^<\n]+)/gi,
      /Hair:\s*([^<\n]+)/gi,
      /Background:\s*([^<\n]+)/gi,
      /Accessory:\s*([^<\n]+)/gi,
      /Color:\s*([^<\n]+)/gi,
      /Style:\s*([^<\n]+)/gi,
      /Type:\s*([^<\n]+)/gi,
      /Rarity:\s*([^<\n]+)/gi,
      /Edition:\s*([^<\n]+)/gi,
      /Series:\s*([^<\n]+)/gi
    ];

    // Применяем каждый паттерн
    nftPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const trait = match[0].split(':')[0].trim();
        const value = match[1].trim();
        
        // Фильтруем валидные атрибуты
        if (trait && value && value.length < 100 && !value.includes('http') && !value.includes('javascript')) {
          attributes.push({
            trait_type: trait,
            value: value
          });
        }
      }
    });

    // Убираем дубликаты
    const uniqueAttributes = attributes.filter((attr, index, self) => 
      index === self.findIndex(a => a.trait_type === attr.trait_type && a.value === attr.value)
    );

    return uniqueAttributes.slice(0, 10); // Максимум 10 атрибутов
  }

  /**
   * Извлечение общего количества
   */
  extractTotalSupply(html) {
    const supplyMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:out of|\/|total)/i);
    return supplyMatch ? parseInt(supplyMatch[1].replace(/,/g, '')) : null;
  }

  /**
   * Извлечение текущего количества
   */
  extractCurrentSupply(html) {
    const currentMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*out of/i);
    return currentMatch ? parseInt(currentMatch[1].replace(/,/g, '')) : null;
  }

  /**
   * Валидация изображения подарка (не скачиваем, только проверяем доступность)
   */
  async validateGiftImage(imageUrl) {
    if (!imageUrl) {
      return {
        isValid: false,
        imageUrl: null
      };
    }

    try {
      console.log('Проверка изображения:', imageUrl);
      
      // Проверяем доступность изображения
      const response = await axios.head(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const isValid = response.status === 200 && 
                     response.headers['content-type'] && 
                     response.headers['content-type'].startsWith('image/');

      console.log('Изображение валидно:', isValid);

      return {
        isValid,
        imageUrl: isValid ? imageUrl : null,
        contentType: response.headers['content-type']
      };
    } catch (error) {
      console.error('Ошибка проверки изображения:', error);
      return {
        isValid: false,
        imageUrl: null
      };
    }
  }

  /**
   * Получение информации о подарке по ID
   */
  async getGiftById(giftId) {
    const url = `${this.baseUrl}/nft/${giftId}`;
    return await this.parseGiftFromUrl(url);
  }

  /**
   * Валидация существования подарка
   */
  async validateGiftExists(giftUrl) {
    try {
      const response = await axios.head(giftUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new TelegramGiftService();