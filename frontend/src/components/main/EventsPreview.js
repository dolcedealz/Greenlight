// frontend/src/components/main/EventsPreview.js
import React from 'react';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
  if (!event) {
    return null;
  }

  // Форматирование времени до окончания
  const formatTimeLeft = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;

    if (diff <= 0) {
      return 'Завершено';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}д ${hours % 24}ч`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    } else {
      return `${minutes}м`;
    }
  };

  return (
    <div className="events-preview" onClick={onClick}>
      <div className="events-header">
        <h3>🔮 События</h3>
        <div className="events-total">
          {event.totalPool.toFixed(0)} USDT
        </div>
      </div>
      
      <div className="featured-event">
        <div className="event-title">{event.title}</div>
        
        <div className="event-info">
          <div className="time-left">
            До окончания: {formatTimeLeft(event.bettingEndsAt)}
          </div>
          <div className="total-bets">
            Всего ставок: {event.outcomes.reduce((sum, outcome) => sum + outcome.betsCount, 0)}
          </div>
        </div>
        
        <div className="event-outcomes">
          {event.outcomes.map((outcome) => {
            const odds = event.currentOdds[outcome.id];
            return (
              <div key={outcome.id} className="outcome">
                <div className="outcome-name">{outcome.name}</div>
                <div className="outcome-odds">×{odds.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="preview-footer">
        <span>Нажмите для просмотра всех событий →</span>
      </div>
    </div>
  );
};

export default EventsPreview;
