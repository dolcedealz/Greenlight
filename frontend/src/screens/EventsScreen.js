// frontend/src/screens/EventsScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { EventCard, EventDetails, EventBet, UserEventBets } from '../components/events';
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
  const [activeTab, setActiveTab] = useState('events'); // 'events' или 'my-bets'
  const { buttonPressFeedback, selectionChanged, successNotification, errorNotification } = useTactileFeedback();
  // Загрузка событий при монтировании и смене вкладки
  useEffect(() => {
    if (activeTab === 'events') {
      fetchEvents();
      // Автообновление каждые 30 секунд только для вкладки событий
      const interval = setInterval(() => {
        fetchEvents(false);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);
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
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  // Обработчик смены вкладки
  const handleTabChange = (tab) => {
    selectionChanged();
    setActiveTab(tab);
    setSelectedEvent(null); // Сбрасываем выбранное событие при смене вкладки
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
      errorNotification();
      let errorMessage = 'Ошибка размещения ставки';
      if (err.response?.status === 401) {
        errorMessage = 'Ошибка аутентификации. Попробуйте перезапустить приложение из Telegram.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Доступ запрещен. Проверьте права доступа.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.message || 'Некорректные данные ставки';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Ошибка сервера. Попробуйте позже.';
      } else {
        errorMessage = err.response?.data?.message || err.message || 'Ошибка размещения ставки';
      }
      // Добавляем debug информацию для разработки
      if (process.env.NODE_ENV === 'development' && err.response?.data?.debug) {
        errorMessage += `\nDebug: ${err.response.data.debug}`;
      }
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
    if (activeTab === 'events') {
      fetchEvents(false);
    }
  };
  // Обработчик обновления ставок
  const handleBetsRefresh = () => {
    // Этот метод будет вызван из компонента UserEventBets
    // для обновления баланса после изменений в ставках
    if (onBalanceUpdate) {
      onBalanceUpdate();
    }
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
  // Рендер заголовка с вкладками
  const renderHeader = () => (
    <div className="events-header">
      {selectedEvent && activeTab === 'events' ? (
        <button className="back-button" onClick={handleBackToList}>
          ←
        </button>
      ) : (
        <div></div>
      )}
      <h1 className="events-title">
        {selectedEvent && activeTab === 'events' ? 'Детали события' : 'События'}
      </h1>
      <button 
        className={`refresh-button ${refreshing ? 'refreshing' : ''}`} 
        onClick={handleRefresh}
        disabled={refreshing}
      >
        🔄
      </button>
    </div>
  );
  // Рендер вкладок
  const renderTabs = () => (
    <div className="events-tabs">
      <button 
        className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
        onClick={() => handleTabChange('events')}
      >
        🎯 События
      </button>
      <button 
        className={`tab-button ${activeTab === 'my-bets' ? 'active' : ''}`}
        onClick={() => handleTabChange('my-bets')}
      >
        📊 Мои ставки
      </button>
    </div>
  );
  // Рендер загрузки
  if (loading && activeTab === 'events') {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        {renderHeader()}
        {renderTabs()}
        <div className="events-loading">
          <div className="loader"></div>
          <p>Загрузка событий...</p>
        </div>
      </div>
    );
  }
  // Рендер ошибки
  if (error && !events.length && activeTab === 'events') {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        {renderHeader()}
        {renderTabs()}
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
  if (selectedEvent && activeTab === 'events') {
    return (
      <div className="events-screen">
        <Header balance={balance} />
        {renderHeader()}
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
  return (
    <div className="events-screen">
      <Header balance={balance} />
      {renderHeader()}
      {renderTabs()}
      {error && activeTab === 'events' && (
        <div className="events-error-banner">
          <p>{error}</p>
          <button onClick={() => fetchEvents()}>Обновить</button>
        </div>
      )}
      {/* Контент в зависимости от активной вкладки */}
      {activeTab === 'events' ? (
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
      ) : (
        <UserEventBets onRefresh={handleBetsRefresh} />
      )}
    </div>
  );
};
export default EventsScreen;