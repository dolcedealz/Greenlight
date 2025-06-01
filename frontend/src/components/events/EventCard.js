// frontend/src/components/events/EventCard.js
import React from 'react';
import '../../styles/EventCard.css';

const EventCard = ({ event, onSelect, onOutcomeSelect, formatTimeLeft }) => {
  // Обработчик клика по карточке
  const handleCardClick = () => {
    onSelect(event);
  };

  // Обработчик клика по исходу (предотвращаем всплытие)
  const handleOutcomeClick = (e, outcomeId) => {
    e.stopPropagation();
    onOutcomeSelect(event, outcomeId);
  };

  // Получение иконки категории
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'sports': return '⚽';
      case 'crypto': return '₿';
      case 'politics': return '🗳️';
      case 'entertainment': return '🎬';
      default: return '🎯';
    }
  };

  // Получение цвета статуса
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#0ba84a';
      case 'upcoming': return '#ff9500';
      case 'betting_closed': return '#ff3b30';
      default: return '#8e8e93';
    }
  };

  // Получение текста статуса
  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Активно';
      case 'upcoming': return 'Скоро';
      case 'betting_closed': return 'Ставки закрыты';
      case 'finished': return 'Завершено';
      default: return status;
    }
  };

  return (
    <div className="event-card" onClick={handleCardClick}>
      {/* Заголовок карточки */}
      <div className="event-card-header">
        <div className="event-category">
          <span className="category-icon">{getCategoryIcon(event.category)}</span>
          <span className="category-name">{event.category}</span>
        </div>
        <div 
          className="event-status"
          style={{ color: getStatusColor(event.status) }}
        >
          {getStatusText(event.status)}
        </div>
      </div>

      {/* Название события */}
      <div className="event-title">
        <h3>{event.title}</h3>
      </div>

      {/* Описание события */}
      <div className="event-description">
        <p>{event.description}</p>
      </div>

      {/* Информация о пуле */}
      <div className="event-pool-info">
        <div className="pool-total">
          <span className="pool-label">Общий пул:</span>
          <span className="pool-amount">{event.totalPool.toFixed(2)} USDT</span>
        </div>
        <div className="time-left">
          <span className="time-label">До окончания:</span>
          <span className="time-value">{formatTimeLeft(event.bettingEndsAt)}</span>
        </div>
      </div>

      {/* Исходы события */}
      <div className="event-outcomes">
        {event.outcomes.map((outcome) => {
          const odds = event.currentOdds[outcome.id];
          const percentage = event.totalPool > 0 
            ? ((outcome.totalBets / event.totalPool) * 100).toFixed(1)
            : 0;

          return (
            <div 
              key={outcome.id} 
              className="outcome-item"
              onClick={(e) => handleOutcomeClick(e, outcome.id)}
            >
              <div className="outcome-info">
                <div className="outcome-name">{outcome.name}</div>
                <div className="outcome-stats">
                  <span className="outcome-percentage">{percentage}%</span>
                  <span className="outcome-bets">{outcome.betsCount} ставок</span>
                </div>
              </div>
              <div className="outcome-odds">
                <div className="odds-value">×{odds.toFixed(2)}</div>
                <div className="odds-amount">{outcome.totalBets.toFixed(0)} USDT</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Индикатор кликабельности */}
      <div className="event-card-footer">
        <span className="tap-hint">Нажмите для подробностей →</span>
      </div>
    </div>
  );
};

export default EventCard;
