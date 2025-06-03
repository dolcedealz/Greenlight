// frontend/src/screens/MainScreen.js - ПОЛНАЯ ВЕРСИЯ С АНИМАЦИЯМИ
import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/layout';
import { GameBlock, EventsPreview } from '../components/main';
import { userApi, eventsApi } from '../services';
import '../styles/MainScreen.css';

const MainScreen = ({ telegramWebApp, userData, onGameSelect, onEventsSelect, balance }) => {
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animationStarted, setAnimationStarted] = useState(false);
  
  // Refs для анимации
  const eventsRef = useRef(null);
  const gamesContainerRef = useRef(null);
  const errorBannerRef = useRef(null);
  
  // Загрузка данных при монтировании
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('MainScreen: Загрузка главного события...');
        
        // Загружаем главное событие
        try {
          const eventResponse = await eventsApi.getFeaturedEvent();
          
          console.log('MainScreen: Ответ API событий:', eventResponse.data);
          
          if (eventResponse.data.success && eventResponse.data.data.event) {
            setFeaturedEvent(eventResponse.data.data.event);
            console.log('MainScreen: Главное событие загружено:', eventResponse.data.data.event.title);
          } else {
            console.log('MainScreen: Главное событие не найдено');
            setFeaturedEvent(null);
          }
        } catch (eventError) {
          console.warn('MainScreen: Ошибка загрузки главного события:', eventError);
          setFeaturedEvent(null);
          // Не показываем ошибку пользователю, так как это не критично
        }
        
        setLoading(false);
      } catch (err) {
        console.error('MainScreen: Общая ошибка загрузки данных:', err);
        setError('Не удалось загрузить некоторые данные.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Запуск анимаций после загрузки данных
  useEffect(() => {
    if (!loading && !animationStarted) {
      setAnimationStarted(true);
      
      // Анимация событий
      const eventsElement = eventsRef.current;
      if (eventsElement) {
        setTimeout(() => {
          eventsElement.classList.add('animate-in');
        }, 100);
      }
      
      // Анимация контейнера игр
      const gamesContainer = gamesContainerRef.current;
      if (gamesContainer) {
        setTimeout(() => {
          gamesContainer.classList.add('animate-in');
        }, 300);
      }
      
      // Анимация баннера ошибки
      const errorBanner = errorBannerRef.current;
      if (errorBanner) {
        setTimeout(() => {
          errorBanner.classList.add('animate-in');
        }, 50);
      }
    }
  }, [loading, animationStarted]);
  
  // Массив игр
  const games = [
    { id: 'slots', name: 'Слоты', icon: '🎰' },
    { id: 'mines', name: 'Мины', icon: '💣' },
    { id: 'crash', name: 'Краш', icon: '📈' },
    { id: 'coin', name: 'Монетка', icon: '🪙' }
  ];
  
  // Обработчик выбора игры
  const handleGameSelect = (gameId) => {
    console.log('MainScreen: Выбрана игра:', gameId);
    if (onGameSelect) {
      onGameSelect(gameId);
    }
  };
  
  // Обработчик выбора событий
  const handleEventsSelect = () => {
    console.log('MainScreen: Переход к событиям');
    if (onEventsSelect) {
      onEventsSelect();
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
          {/* Показываем ошибку, если есть */}
          {error && (
            <div 
              ref={errorBannerRef}
              className="main-error-banner"
            >
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Обновить</button>
            </div>
          )}
          
          {/* Превью события - показываем только если есть событие */}
          {featuredEvent ? (
            <div 
              ref={eventsRef}
              className="events-container"
            >
              <EventsPreview 
                event={featuredEvent} 
                onClick={handleEventsSelect} 
              />
            </div>
          ) : (
            <div 
              ref={eventsRef}
              className="events-container"
            >
              <div className="events-preview-placeholder">
                <div className="events-header">
                  <h3>🔮 События</h3>
                  <div className="events-status">Скоро</div>
                </div>
                <div className="placeholder-content">
                  <p>Ожидайте интересные события для ставок!</p>
                  <button onClick={handleEventsSelect} className="placeholder-button">
                    Посмотреть все события
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Игры - показываем всегда */}
          <div 
            ref={gamesContainerRef}
            className="games-container"
          >
            <div className="games-title">🎮 Игры</div>
            <div className="games-grid">
              {games.map((game, index) => (
                <GameBlock
                  key={game.id}
                  name={game.name}
                  icon={game.icon}
                  gameType={game.id}
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
