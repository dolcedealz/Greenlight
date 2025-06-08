// frontend/src/components/main/EventsPreview.js
import React from 'react';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
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

  // Получение процента распределения ставок
  const getOutcomePercentage = (outcome) => {
    if (event.totalPool === 0) return 0;
    return ((outcome.totalBets / event.totalPool) * 100).toFixed(1);
  };

  return (
    <div className="events-preview" onClick={onClick}>
      {/* Заголовок */}
      <div className="events-header">
        <h3>🔮 События</h3>
        <div className="events-total">
          {event.totalPool.toFixed(0)} USDT
        </div>
      </div>

      {/* Основной контент события */}
      <div className="event-content">
        <div className="event-title">
          {event.title}
        </div>

        <div className="event-time-left">
          ⏰ {formatTimeLeft(event.bettingEndsAt)}
        </div>

        {/* Исходы события */}
        <div className="event-outcomes">
          {event.outcomes.map((outcome) => {
            const odds = event.currentOdds[outcome.id];
            const percentage = getOutcomePercentage(outcome);

            return (
              <div key={outcome.id} className="outcome">
                <div className="outcome-info">
                  <div className="outcome-name">{outcome.name}</div>
                  <div className="outcome-percentage">{percentage}%</div>
                </div>
                <div className="outcome-odds">
                  ×{odds.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Подсказка */}
      <div className="events-footer">
        <div className="tap-hint">
          Нажмите для просмотра всех событий →
        </div>
      </div>
    </div>
  );
};

export default EventsPreview;
