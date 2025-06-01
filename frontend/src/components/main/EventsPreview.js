// frontend/src/components/main/EventsPreview.js
import React, { useState, useEffect } from 'react';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
  const [timeLeft, setTimeLeft] = useState('');

  // Обновление времени каждую секунду
  useEffect(() => {
    if (!event) return;

    const updateTime = () => {
      const now = new Date();
      const end = new Date(event.bettingEndsAt);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Завершено');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}д ${hours}ч`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}ч ${minutes}м`);
      } else {
        setTimeLeft(`${minutes}м`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [event]);

  if (!event) {
    return null;
  }

  // Получение процента распределения ставок
  const getOutcomePercentage = (outcome) => {
    if (event.totalPool === 0) return 0;
    return ((outcome.totalBets / event.totalPool) * 100).toFixed(1);
  };

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
          ⏰ До окончания: {timeLeft}
        </div>

        <div className="event-outcomes">
          {event.outcomes.map((outcome) => {
            const odds = event.currentOdds[outcome.id];
            const percentage = getOutcomePercentage(outcome);

            return (
              <div key={outcome.id} className="outcome">
                <div className="outcome-info">
                  <div className="outcome-name">{outcome.name}</div>
                  <div className="outcome-percentage">{percentage}% ставок</div>
                </div>
                <div className="outcome-odds">×{odds.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="events-footer">
        <div className="tap-hint">
          Нажмите для просмотра всех событий →
        </div>
      </div>
    </div>
  );
};

export default EventsPreview;
