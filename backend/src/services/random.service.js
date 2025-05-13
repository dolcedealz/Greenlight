// random.service.js
const crypto = require('crypto');

/**
 * Сервис для генерации криптографически безопасных случайных чисел
 * и проверяемой честной игры
 */
class RandomService {
  /**
   * Генерирует криптографически безопасную случайную строку
   * @param {number} length - Длина строки
   * @returns {string} - Случайная строка в hex-формате
   */
  generateServerSeed(length = 64) {
    return crypto.randomBytes(length / 2).toString('hex');
  }

  /**
   * Хеширует серверный сид для публичного показа
   * @param {string} serverSeed - Серверный сид
   * @returns {string} - Хеш серверного сида
   */
  hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Генерирует случайное число от 0 до 1 на основе seed и nonce
   * @param {string} serverSeed - Серверный сид
   * @param {string} clientSeed - Клиентский сид
   * @param {number} nonce - Инкрементальный счетчик
   * @returns {number} - Случайное число от 0 до 1
   */
  generateRandomNumber(serverSeed, clientSeed, nonce) {
    // Создаем HMAC с использованием серверного сида как ключа
    const hmac = crypto.createHmac('sha256', serverSeed);
    
    // Обновляем HMAC с клиентским сидом и nonce
    hmac.update(`${clientSeed}:${nonce}`);
    
    // Получаем hex-строку
    const hexResult = hmac.digest('hex');
    
    // Преобразуем первые 8 символов hex (32 бита) в число от 0 до 1
    const decimalValue = parseInt(hexResult.slice(0, 8), 16);
    
    // Нормализуем до диапазона [0, 1)
    return decimalValue / 0x100000000;
  }

  /**
   * Подбрасывает монету и определяет результат (heads/tails)
   * @param {string} serverSeed - Серверный сид
   * @param {string} clientSeed - Клиентский сид
   * @param {number} nonce - Инкрементальный счетчик
   * @returns {string} - Результат подбрасывания ('heads' или 'tails')
   */
  flipCoin(serverSeed, clientSeed, nonce) {
    const randomValue = this.generateRandomNumber(serverSeed, clientSeed, nonce);
    return randomValue < 0.5 ? 'heads' : 'tails';
  }

  /**
   * Проверяет, соответствует ли хешированный серверный сид оригинальному
   * @param {string} serverSeed - Оригинальный серверный сид
   * @param {string} hashedServerSeed - Хешированный серверный сид
   * @returns {boolean} - true, если соответствует
   */
  verifyServerSeed(serverSeed, hashedServerSeed) {
    return this.hashServerSeed(serverSeed) === hashedServerSeed;
  }

  /**
   * Генерирует случайный nonce
   * @returns {number} - Случайный nonce
   */
  generateNonce() {
    return Math.floor(Math.random() * 1000000);
  }
}

module.exports = new RandomService();