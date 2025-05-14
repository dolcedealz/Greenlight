// MainScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { GameBlock, EventsPreview } from '../components/main';
import { userApi } from '../services';
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
        
        // Загрузка события (пока мок, так как API для событий еще нет)
        setFeaturedEvent({
          id: 'evt1',
          title: 'BTC price on May 15, 2025',
          totalBets: 15420.75,
          outcomes: [
            { id: 'out1', name: 'Above $95,000', odds: 2.1 },
            { id: 'out2', name: 'Below $95,000', odds: 1.95 }
          ]
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
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
  
  // Обработчик выбора события
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
          {/* Превью события */}
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