// frontend/src/components/main/EventsPreview.js
import React from 'react';
import useTactileFeedback from '../../hooks/useTactileFeedback';
import '../../styles/EventsPreview.css';

const EventsPreview = ({ event, onClick }) => {
  const { mediumImpact } = useTactileFeedback();

  const handleClick = () => {
    // Средняя вибрация для важного действия (переход к событиям)
    mediumImpact();
    
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className="events-preview" onClick={handleClick}>
      <div className="events-header">
        <h3>События</h3>
        <span className="events-total">{event.totalBets.toFixed(2)} USDT</span>
      </div>
      
      <div className="event-title">{event.title}</div>
      
      <div className="event-outcomes">
        {event.outcomes.map((outcome, index) => (
          <div key={index} className="outcome">
            <span className="outcome-name">{outcome.name}</span>
            <span className="outcome-odds">×{outcome.odds.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsPreview;
