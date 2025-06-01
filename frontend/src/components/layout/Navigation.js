// frontend/src/components/layout/Navigation.js
import React from 'react';
import '../../styles/Navigation.css';

const Navigation = ({ currentScreen, onScreenChange }) => {
  const navItems = [
    { id: 'history', label: 'История', icon: '📋' },
    { id: 'main', label: 'Главная', icon: '🏠' },
    { id: 'events', label: 'События', icon: '🔮' },
    { id: 'profile', label: 'Профиль', icon: '👤' }
  ];

  return (
    <nav className="navigation">
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${currentScreen === item.id ? 'active' : ''}`}
          onClick={() => onScreenChange(item.id)}
        >
          <div className="nav-icon">{item.icon}</div>
          <div className="nav-label">{item.label}</div>
        </div>
      ))}
    </nav>
  );
};

export default Navigation;
