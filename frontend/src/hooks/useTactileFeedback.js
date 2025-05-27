// frontend/src/hooks/useTactileFeedback.js
import { 
    isHapticAvailable,
    lightHaptic,
    mediumHaptic,
    heavyHaptic,
    selectionHaptic,
    successHaptic,
    errorHaptic,
    warningHaptic
  } from '../utils/telegram';
  
  const useTactileFeedback = () => {
    // Легкая вибрация для обычных нажатий
    const buttonPressFeedback = () => {
      lightHaptic();
    };
  
    // Вибрация при смене выбора
    const selectionChanged = () => {
      selectionHaptic();
    };
  
    // Вибрация для игровых действий
    const gameActionFeedback = () => {
      mediumHaptic();
    };
  
    // Важные действия
    const importantActionFeedback = () => {
      heavyHaptic();
    };
  
    // Критические действия (например, кешаут)
    const criticalActionFeedback = () => {
      heavyHaptic();
      setTimeout(() => heavyHaptic(), 100);
    };
  
    // Вибрация при выигрыше
    const gameWinFeedback = () => {
      successHaptic();
    };
  
    // Вибрация при проигрыше
    const gameLoseFeedback = () => {
      errorHaptic();
    };
  
    // Навигационная вибрация
    const navigationFeedback = () => {
      lightHaptic();
    };
  
    // Средний импакт
    const mediumImpact = () => {
      mediumHaptic();
    };
  
    // Сильный импакт
    const heavyImpact = () => {
      heavyHaptic();
    };
  
    // Вибрация успеха
    const successNotification = () => {
      successHaptic();
    };
  
    return {
      buttonPressFeedback,
      selectionChanged,
      gameActionFeedback,
      importantActionFeedback,
      criticalActionFeedback,
      gameWinFeedback,
      gameLoseFeedback,
      navigationFeedback,
      mediumImpact,
      heavyImpact,
      successNotification,
      isHapticAvailable: isHapticAvailable()
    };
  };
  
  export default useTactileFeedback;