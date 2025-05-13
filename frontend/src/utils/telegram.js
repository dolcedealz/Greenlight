// telegram.js
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
          onConfirm && onConfirm();
        } else {
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
  closeWebApp
};