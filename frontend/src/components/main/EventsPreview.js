// frontend/src/components/main/EventsPreview.js
import React from 'react';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
  if (!event) {
    return null;
  }

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

  return (
    <div className="events-preview" onClick={onClick}>
      <div className="events-header">
        <h3>
          {getCategoryIcon(event.category)} События
        </h3>
        <div className="events-total">
          {event.totalPool.toFixed(0)} USDT
        </div>
      </div>
      
      <div className="event-content">
        <div className="event-title">
          {event.title}
        </div>
        
        <div className="event-time-left">
          ⏰ {formatTimeLeft(event.bettingEndsAt)}
        </div>
        
        <div className="event-outcomes">
          {event.outcomes.map((outcome) => {
            const odds = event.currentOdds[outcome.id];
            const percentage = event.totalPool > 0 
              ? ((outcome.totalBets / event.totalPool) * 100).toFixed(0)
              : 50;

            return (
              <div key={outcome.id} className="outcome">
                <div className="outcome-info">
                  <span className="outcome-name">{outcome.name}</span>
                  <span className="outcome-percentage">{percentage}%</span>
                </div>
                <div className="outcome-odds">×{odds.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="events-footer">
        <span className="tap-hint">Нажмите, чтобы увидеть все события →</span>
      </div>
    </div>
  );
};

export default EventsPreview;
