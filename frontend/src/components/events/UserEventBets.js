// frontend/src/components/events/UserEventBets.js - ОТЛАДОЧНАЯ ВЕРСИЯ
import React from 'react';

const UserEventBets = ({ onRefresh }) => {
  console.log('UserEventBets компонент загружен');
  
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#1e1e1e', 
      borderRadius: '12px', 
      color: 'white',
      minHeight: '300px'
    }}>
      <h2 style={{ color: '#0ba84a', marginBottom: '20px' }}>🎯 Мои ставки на события</h2>
      
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        border: '2px dashed rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
        <h3 style={{ marginBottom: '10px' }}>Компонент работает!</h3>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Если вы видите это сообщение, значит компонент UserEventBets загружается корректно.
        </p>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '15px' }}>
          Сейчас будем добавлять функциональность загрузки ставок.
        </p>
        <button 
          onClick={() => console.log('Кнопка работает!')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#0ba84a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Тест кнопки
        </button>
      </div>
    </div>
  );
};

export default UserEventBets;
