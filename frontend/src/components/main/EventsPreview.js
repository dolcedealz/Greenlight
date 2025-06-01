// frontend/src/components/main/EventsPreview.js
import React from 'react';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
  // Функция для форматирования времени до окончания
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

  // Функция для получения процента распределения ставок
  const getOutcomePercentage = (outcome) => {
    if (!event.totalPool || event.totalPool === 0) return 0;
    return ((outcome.totalBets / event.totalPool) * 100).toFixed(1);
  };

  if (!event) {
    return null;
  }

  return (
    <div className="events-preview" onClick={onClick}>
      <div className="events-header">
        <h3>🔮 События</h3>
        <div className="events-total">
          {event.totalPool.toFixed(0)} USDT
        </div>
      </div>

      <div className="event-content">
        <div className="event-title">{event.title}</div>
        
        <div className="event-time-left">
          ⏰ {formatTimeLeft(event.bettingEndsAt)}
        </div>

        <div className="event-outcomes">
          {event.outcomes && event.outcomes.map((outcome) => {
            const odds = event.currentOdds ? event.currentOdds[outcome.id] : 2.0;
            const percentage = getOutcomePercentage(outcome);

            return (
              <div key={outcome.id} className="outcome">
                <div className="outcome-info">
                  <div className="outcome-name">{outcome.name}</div>
                  <div className="outcome-percentage">{percentage}%</div>
                </div>
                <div className="outcome-odds">×{odds.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="events-footer">
        <div className="tap-hint">
          Нажмите, чтобы перейти к событиям →
        </div>
      </div>
    </div>
  );
};

export default EventsPreview;
