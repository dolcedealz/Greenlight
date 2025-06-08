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

      }
    } else {
      console.log('🔊 Вибрация пропущена (не в Telegram WebApp)');
    }
  }, []);

  // Функция для отправки уведомления
  const sendNotificationFeedback = useCallback((type) => {
    if (isWebAppAvailable()) {
      try {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);

      } catch (error) {

      }
    } else {
      console.log('🔔 Уведомление пропущено (не в Telegram WebApp)');
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

  // ИСПРАВЛЕНО: Добавлены недостающие функции
  const gameActionFeedback = useCallback(() => {
    sendHapticFeedback('medium');
  }, [sendHapticFeedback]);

  const importantActionFeedback = useCallback(() => {
    sendHapticFeedback('heavy');
  }, [sendHapticFeedback]);

  const criticalActionFeedback = useCallback(() => {
    sendHapticFeedback('rigid');
  }, [sendHapticFeedback]);

  const heavyImpact = useCallback(() => {
    sendHapticFeedback('heavy');
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
    // Основные функции
    buttonPressFeedback,
    selectionChanged,
    navigationFeedback,
    gameWinFeedback,
    gameLoseFeedback,
    successNotification,
    errorNotification,
    warningNotification,
    // ИСПРАВЛЕНО: Добавлены все недостающие функции
    gameActionFeedback,
    importantActionFeedback,
    criticalActionFeedback,
    heavyImpact
  };
};

export default useTactileFeedback;
