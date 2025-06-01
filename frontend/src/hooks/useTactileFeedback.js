// frontend/src/hooks/useTactileFeedback.js
import { useCallback } from 'react';

const useTactileFeedback = () => {
  // Проверяем доступность Telegram WebApp API
  const isWebAppAvailable = () => {
    return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback;
  };

  // Функция для отправки тактильной обратной связи
  const sendHapticFeedback = useCallback((type) => {
    if (isWebAppAvailable()) {
      try {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      } catch (error) {
        console.warn('Ошибка отправки тактильной обратной связи:', error);
      }
    }
  }, []);

  // Функция для отправки уведомления
  const sendNotificationFeedback = useCallback((type) => {
    if (isWebAppAvailable()) {
      try {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
      } catch (error) {
        console.warn('Ошибка отправки уведомления:', error);
      }
    }
  }, []);

  // Различные типы вибрации
  const buttonPressFeedback = useCallback(() => {
    sendHapticFeedback('light');
  }, [sendHapticFeedback]);

  const selectionChanged = useCallback(() => {
    sendHapticFeedback('soft');
  }, [sendHapticFeedback]);

  const navigationFeedback = useCallback(() => {
    sendHapticFeedback('medium');
  }, [sendHapticFeedback]);

  const gameWinFeedback = useCallback(() => {
    sendNotificationFeedback('success');
  }, [sendNotificationFeedback]);

  const gameLoseFeedback = useCallback(() => {
    sendNotificationFeedback('error');
  }, [sendNotificationFeedback]);

  const successNotification = useCallback(() => {
    sendNotificationFeedback('success');
  }, [sendNotificationFeedback]);

  const errorNotification = useCallback(() => {
    sendNotificationFeedback('error');
  }, [sendNotificationFeedback]);

  const warningNotification = useCallback(() => {
    sendNotificationFeedback('warning');
  }, [sendNotificationFeedback]);

  return {
    buttonPressFeedback,
    selectionChanged,
    navigationFeedback,
    gameWinFeedback,
    gameLoseFeedback,
    successNotification,
    errorNotification,
    warningNotification
  };
};

export default useTactileFeedback;
