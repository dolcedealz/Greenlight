// frontend/src/screens/MainScreen.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { GameBlock, EventsPreview } from '../components/main';
import { userApi, eventsApi } from '../services';
import '../styles/MainScreen.css';

const MainScreen = ({ telegramWebApp, userData, onGameSelect, onEventsSelect, balance }) => {
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Загрузка данных при монтировании
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Загружаем главное событие (необязательно)
        try {
          const eventResponse = await eventsApi.getFeaturedEvent();
          
          if (eventResponse.data.success && eventResponse.data.data.event) {
            setFeaturedEvent(eventResponse.data.data.event);
            console.log('MainScreen: Главное событие загружено:', eventResponse.data.data.event.title);
          } else {
            console.log('MainScreen: Главное событие не найдено');
            setFeaturedEvent(null);
          }
        } catch (eventError) {
          console.warn('MainScreen: Ошибка загрузки главного события (не критично):', eventError);
          setFeaturedEvent(null);
          // Не показываем ошибку пользователю, так как это не критично
        }
        
        setLoading(false);
      } catch (err) {
        console.error('MainScreen: Ошибка загрузки данных:', err);
        setError('Не удалось загрузить некоторые данные. Приложение работает в ограниченном режиме.');
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
      ) : (
        <>
          {/* Показываем ошибку, если есть, но не блокируем интерфейс */}
          {error && (
            <div className="main-error-banner">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Обновить</button>
            </div>
          )}
          
          {/* Превью события - показываем только если есть событие */}
          {featuredEvent && (
            <EventsPreview 
              event={featuredEvent} 
              onClick={handleEventsSelect} 
            />
          )}
          
          {/* Игры - показываем всегда */}
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
