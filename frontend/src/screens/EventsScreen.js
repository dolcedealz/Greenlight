// frontend/src/screens/EventsScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { EventCard, EventDetails, EventBet } from '../components/events';
import { eventsApi } from '../services/api';
import useTactileFeedback from '../hooks/useTactileFeedback';
import '../styles/EventsScreen.css';

const EventsScreen = ({ balance, onBalanceUpdate }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { buttonPressFeedback, selectionChanged, successNotification, errorNotification } = useTactileFeedback();

  // Загрузка событий при монтировании
  useEffect(() => {
    fetchEvents();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Загрузка активных событий
  const fetchEvents = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      const response = await eventsApi.getActiveEvents();
      
      if (response.data.success) {
        setEvents(response.data.data.events);
        setError(null);
      } else {
        setError('Не удалось загрузить события');
      }
    } catch (err) {
      console.error('Ошибка загрузки событий:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Обработчик выбора события
  const handleEventSelect = (event) => {
    buttonPressFeedback();
    setSelectedEvent(event);
  };

  // Обработчик выбора исхода для ставки
  const handleOutcomeSelect = (event, outcomeId) => {
    selectionChanged();
    const outcome = event.outcomes.find(o => o.id === outcomeId);
    setSelectedEvent(event);
    setSelectedOutcome({ id: outcomeId, name: outcome.name });
    setShowBetModal(true);
  };

  // Обработчик размещения ставки
  const handlePlaceBet = async (betData) => {
    try {
      buttonPressFeedback();
      
      const response = await eventsApi.placeBet(
        selectedEvent._id,
        selectedOutcome.id,
        betData.amount
      );

      if (response.data.success) {
        successNotification();
        
        // Обновляем баланс
        onBalanceUpdate(response.data.data.newBalance);
        
        // Обновляем событие с новыми коэффициентами
        const updatedEvents = events.map(event => 
          event._id === selectedEvent._id ? response.data.data.event : event
        );
        setEvents(updatedEvents);
        setSelectedEvent(response.data.data.event);
        
        // Закрываем модальное окно
        setShowBetModal(false);
        setSelectedOutcome(null);
        
        // Показываем уведомление
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(
            `Ставка размещена!\n${betData.amount} USDT на "${selectedOutcome.name}"\nПотенциальный выигрыш: ${(betData.amount * response.data.data.event.currentOdds[selectedOutcome.id]).toFixed(2)} USDT`
          );
        }
      } else {
        throw new Error(response.data.message);
      }
    } catch (err) {
      console.error('Ошибка размещения ставки:', err);
      errorNotification();
      
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка размещения ставки';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`Ошибка: ${errorMessage}`);
      } else {
        alert(`Ошибка: ${errorMessage}`);
      }
    }
  };

  // Обработчик закрытия модального окна
  const handleCloseBetModal = () => {
    buttonPressFeedback();
    setShowBetModal(false);
    setSelectedOutcome(null);
  };

  // Обработчик возврата к списку событий
  const handleBackToList = () => {
    buttonPressFeedback();
    setSelectedEvent(null);
  };

  // Обработчик обновления
  const handleRefresh = () => {
    buttonPressFeedback();
    fetchEvents(false);
  };

  // Форматирование времени до окончания
  const formatTimeLeft = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) {
      return 'Завершено';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}д ${hours}ч`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    } else {
      return `${minutes}м`;
    }
  };

  // Рендер загрузки
  if (loading) {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        <div className="events-loading">
          <div className="loader"></div>
          <p>Загрузка событий...</p>
        </div>
      </div>
    );
  }

  // Рендер ошибки
  if (error && !events.length) {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        <div className="events-error">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <button onClick={() => fetchEvents()} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Рендер деталей события
  if (selectedEvent) {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        
        <div className="events-header">
          <button className="back-button" onClick={handleBackToList}>
            ←
          </button>
          <h1 className="events-title">Детали события</h1>
          <button className="refresh-button" onClick={handleRefresh}>
            🔄
          </button>
        </div>

        <EventDetails 
          event={selectedEvent}
          onOutcomeSelect={handleOutcomeSelect}
          formatTimeLeft={formatTimeLeft}
        />

        {/* Модальное окно ставки */}
        {showBetModal && selectedOutcome && (
          <EventBet
            event={selectedEvent}
            outcome={selectedOutcome}
            balance={balance}
            onPlaceBet={handlePlaceBet}
            onClose={handleCloseBetModal}
          />
        )}
      </div>
    );
  }

  // Рендер списка событий
  return (
    <div className="events-screen">
      <Header balance={balance} />
      
      <div className="events-header">
        <h1 className="events-title">События</h1>
        <button 
          className={`refresh-button ${refreshing ? 'refreshing' : ''}`} 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="events-error-banner">
          <p>{error}</p>
          <button onClick={() => fetchEvents()}>Обновить</button>
        </div>
      )}

      <div className="events-list">
        {events.length === 0 ? (
          <div className="no-events">
            <div className="no-events-icon">🎯</div>
            <h3>Нет активных событий</h3>
            <p>В данный момент нет событий для ставок. Следите за обновлениями!</p>
          </div>
        ) : (
          events.map(event => (
            <EventCard
              key={event._id}
              event={event}
              onSelect={handleEventSelect}
              onOutcomeSelect={handleOutcomeSelect}
              formatTimeLeft={formatTimeLeft}
            />
          ))
        )}
      </div>

      {/* Информационный блок */}
      <div className="events-info">
        <h3>ℹ️ Как это работает</h3>
        <ul>
          <li>Выберите событие и исход</li>
          <li>Коэффициенты изменяются в зависимости от ставок</li>
          <li>Комиссия казино составляет 5%</li>
          <li>Выплаты производятся после завершения события</li>
        </ul>
      </div>
    </div>
  );
};

export default EventsScreen;
