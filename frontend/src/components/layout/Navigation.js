// frontend/src/components/layout/Navigation.js
import React from 'react';
import useTactileFeedback from '../../hooks/useTactileFeedback';
import '../../styles/Navigation.css';

const Navigation = ({ currentScreen, onScreenChange }) => {
  const { navigationFeedback, selectionChanged } = useTactileFeedback();

  const navItems = [
    { id: 'history', label: 'История', icon: '📋' },
    { id: 'main', label: 'Главная', icon: '🏠' },
    { id: 'profile', label: 'Профиль', icon: '👤' }
  ];

  const handleScreenChange = (screenId) => {
    // Разная вибрация в зависимости от того, меняется ли экран
    if (currentScreen !== screenId) {
      selectionChanged(); // Вибрация смены выбора
    } else {
      navigationFeedback(); // Обычная навигационная вибрация
    }
    
    onScreenChange(screenId);
  };

  return (
    <div className="navigation">
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${currentScreen === item.id ? 'active' : ''}`}
          onClick={() => handleScreenChange(item.id)}
        >
          <div className="nav-icon">{item.icon}</div>
          <div className="nav-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default Navigation;
