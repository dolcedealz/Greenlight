// frontend/src/utils/telegram.js
import WebApp from '@twa-dev/sdk';

/**
 * Инициализирует Telegram WebApp
 * @returns {object} Инстанс Telegram WebApp
 */
export const initTelegram = () => {
  if (!window.Telegram || !window.Telegram.WebApp) {
    console.error('Telegram WebApp не найден. Убедитесь, что вы запускаете приложение из Telegram.');
    throw new Error('Telegram WebApp not found');
  }

  // Расширяем окно приложения
  window.Telegram.WebApp.expand();

  // В версии 6.0+ не используем эти методы, так как они устарели
  // window.Telegram.WebApp.setHeaderColor('#121212');
  // window.Telegram.WebApp.setBackgroundColor('#121212');
  
  // Вместо этого используем mainButton для управления внешним видом
  window.Telegram.WebApp.MainButton.setParams({
    color: '#0ba84a',
    text_color: '#ffffff'
  });

  return window.Telegram.WebApp;
};

/**
 * Функции тактильной обратной связи
 */

// Проверка доступности API тактильной обратной связи
export const isHapticAvailable = () => {
  return !!(
    window.Telegram && 
    window.Telegram.WebApp && 
    window.Telegram.WebApp.HapticFeedback
  );
};

// Легкая вибрация
export const lightHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    } catch (error) {
      console.warn('Ошибка при выполнении легкой вибрации:', error);
    }
  }
};

// Средняя вибрация
export const mediumHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    } catch (error) {
      console.warn('Ошибка при выполнении средней вибрации:', error);
    }
  }
};

// Сильная вибрация
export const heavyHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
    } catch (error) {
      console.warn('Ошибка при выполнении сильной вибрации:', error);
    }
  }
};

// Вибрация при изменении выбора
export const selectionHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    } catch (error) {
      console.warn('Ошибка при выполнении вибрации выбора:', error);
    }
  }
};

// Уведомления с вибрацией
export const successHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
      console.warn('Ошибка при выполнении вибрации успеха:', error);
    }
  }
};

export const errorHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    } catch (error) {
      console.warn('Ошибка при выполнении вибрации ошибки:', error);
    }
  }
};

export const warningHaptic = () => {
  if (isHapticAvailable()) {
    try {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
    } catch (error) {
      console.warn('Ошибка при выполнении вибрации предупреждения:', error);
    }
  }
};

/**
 * Показывает всплывающее уведомление
 * @param {string} message - Текст уведомления
 */
export const showNotification = (message) => {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.showPopup({
      message,
    });
  } else {
    alert(message);
  }
};

/**
 * Показывает подтверждение действия
 * @param {string} message - Текст сообщения
 * @param {Function} onConfirm - Функция обратного вызова при подтверждении
 * @param {Function} onCancel - Функция обратного вызова при отмене
 */
export const showConfirmation = (message, onConfirm, onCancel) => {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.showConfirm(
      message,
      (confirmed) => {
        if (confirmed) {
          mediumHaptic(); // Вибрация при подтверждении
          onConfirm && onConfirm();
        } else {
          lightHaptic(); // Легкая вибрация при отмене
          onCancel && onCancel();
        }
      }
    );
  } else {
    const confirmed = window.confirm(message);
    if (confirmed) {
      onConfirm && onConfirm();
    } else {
      onCancel && onCancel();
    }
  }
};

/**
 * Закрывает WebApp
 */
export const closeWebApp = () => {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.close();
  }
};

export default {
  initTelegram,
  showNotification,
  showConfirmation,
  closeWebApp,
  // Тактильная обратная связь
  isHapticAvailable,
  lightHaptic,
  mediumHaptic,
  heavyHaptic,
  selectionHaptic,
  successHaptic,
  errorHaptic,
  warningHaptic
};
