// MainScreen.js - ОБНОВЛЕННАЯ ВЕРСИЯ
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { GameBlock } from '../components/main';
import EventsPreview from '../components/main/EventsPreview'; // Добавляем импорт
import { userApi, eventsApi } from '../services'; // Добавляем eventsApi
import '../styles/MainScreen.css';

const MainScreen = ({ telegramWebApp, userData, onGameSelect, onEventsSelect, balance }) => {
  const [featuredEvent, setFeaturedEvent] = useState(null); // Изменяем на реальные данные
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Загрузка данных при монтировании
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Загружаем главное событие
        const eventResponse = await eventsApi.getFeaturedEvent();
        
        if (eventResponse.data.success && eventResponse.data.data.event) {
          setFeaturedEvent(eventResponse.data.data.event);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки данных главной страницы:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Массив игр
  const games = [
    { id: 'slots', name: 'Слоты', icon: '🎰' },
    { id: 'mines', name: 'Мины', icon: '💣' },
    { id: 'crash', name: 'Краш', icon: '📈' },
    { id: 'coin', name: 'Монетка', icon: '🪙' }
  ];
  
  // Обработчик выбора игры
  const handleGameSelect = (gameId) => {
    if (onGameSelect) {
      onGameSelect(gameId);
    }
  };
  
  // Обработчик выбора событий
  const handleEventsSelect = () => {
    if (onEventsSelect) {
      onEventsSelect();
    } else {
      console.log('Выбран раздел событий');
    }
  };
  
  return (
    <div className="main-screen">
      <Header balance={balance} />
      
      {loading ? (
        <div className="main-loading">
          <div className="loader"></div>
          <p>Загрузка...</p>
        </div>
      ) : error ? (
        <div className="main-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Попробовать снова</button>
        </div>
      ) : (
        <>
          {/* Превью события - показываем только если есть событие */}
          {featuredEvent && (
            <EventsPreview 
              event={featuredEvent} 
              onClick={handleEventsSelect} 
            />
          )}
          
          {/* Игры */}
          <div className="games-container">
            <div className="games-title">Игры</div>
            <div className="games-grid">
              {games.map((game) => (
                <GameBlock
                  key={game.id}
                  name={game.name}
                  icon={game.icon}
                  onClick={() => handleGameSelect(game.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MainScreen;
