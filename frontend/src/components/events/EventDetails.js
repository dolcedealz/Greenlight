// frontend/src/components/events/EventDetails.js
import React, { useState, useEffect } from 'react';
import '../../styles/EventDetails.css';
const EventDetails = ({ event, onOutcomeSelect, formatTimeLeft }) => {
  const [timeLeft, setTimeLeft] = useState('');
  // Обновление времени каждую секунду
  useEffect(() => {
    const updateTime = () => {
      setTimeLeft(formatTimeLeft(event.bettingEndsAt));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [event.bettingEndsAt, formatTimeLeft]);
  // Получение процента распределения ставок
  const getOutcomePercentage = (outcome) => {
    if (event.totalPool === 0) return 0;
    return ((outcome.totalBets / event.totalPool) * 100).toFixed(1);
  };
  // Получение цвета для полосы процентов
  const getPercentageBarColor = (percentage) => {
    if (percentage > 60) return '#ff3b30';
    if (percentage > 40) return '#ff9500';
    return '#0ba84a';
  };
  // Рендер статистики события
  const renderEventStats = () => (
    <div className="event-stats">
      <div className="stat-item">
        <span className="stat-label">Общий пул</span>
        <span className="stat-value">{event.totalPool.toFixed(2)} USDT</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Всего ставок</span>
        <span className="stat-value">
          {event.outcomes.reduce((sum, outcome) => sum + outcome.betsCount, 0)}
        </span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Мин. ставка</span>
        <span className="stat-value">{event.minBet} USDT</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Макс. ставка</span>
        <span className="stat-value">{event.maxBet} USDT</span>
      </div>
    </div>
  );
  // Рендер временной информации
  const renderTimeInfo = () => (
    <div className="time-info">
      <div className="time-item">
        <span className="time-label">Начало события:</span>
        <span className="time-value">
          {new Date(event.startTime).toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="time-item">
        <span className="time-label">Окончание события:</span>
        <span className="time-value">
          {new Date(event.endTime).toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="time-item">
        <span className="time-label">Прием ставок до:</span>
        <span className="time-value">
          {new Date(event.bettingEndsAt).toLocaleString('ru-RU')}
        </span>
      </div>
      <div className="time-item countdown">
        <span className="time-label">Осталось времени:</span>
        <span className="time-value countdown-value">{timeLeft}</span>
      </div>
    </div>
  );
  return (
    <div className="event-details">
      {/* Заголовок события */}
      <div className="event-details-header">
        <h2 className="event-title">{event.title}</h2>
        <div className={`event-status status-${event.status}`}>
          {event.status === 'active' ? 'Активно' : 'Неактивно'}
        </div>
      </div>
      {/* Описание события */}
      <div className="event-description">
        <p>{event.description}</p>
      </div>
      {/* Временная информация */}
      <div className="event-section">
        <h3 className="section-title">⏰ Временные рамки</h3>
        {renderTimeInfo()}
      </div>
      {/* Статистика события */}
      <div className="event-section">
        <h3 className="section-title">📊 Статистика</h3>
        {renderEventStats()}
      </div>
      {/* Исходы для ставок */}
      <div className="event-section">
        <h3 className="section-title">🎯 Сделать ставку</h3>
        <div className="outcomes-betting">
          {event.outcomes.map((outcome) => {
            const odds = event.currentOdds[outcome.id];
            const percentage = getOutcomePercentage(outcome);
            const barColor = getPercentageBarColor(percentage);
            return (
              <div key={outcome.id} className="outcome-betting-item">
                <div className="outcome-header">
                  <div className="outcome-name">{outcome.name}</div>
                  <div className="outcome-odds">×{odds.toFixed(2)}</div>
                </div>
                <div className="outcome-info">
                  <div className="outcome-bets-info">
                    <span>{outcome.betsCount} ставок</span>
                    <span>{outcome.totalBets.toFixed(2)} USDT</span>
                  </div>
                  <div className="outcome-percentage">{percentage}%</div>
                </div>
                {/* Визуальная полоса процентов */}
                <div className="percentage-bar">
                  <div 
                    className="percentage-fill"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: barColor
                    }}
                  />
                </div>
                {/* Кнопка ставки */}
                <button 
                  className="bet-button"
                  onClick={() => onOutcomeSelect(event, outcome.id)}
                  disabled={event.status !== 'active' || timeLeft === 'Завершено'}
                >
                  {event.status !== 'active' ? 'Неактивно' : 
                   timeLeft === 'Завершено' ? 'Время истекло' : 
                   'Поставить'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* Информация о комиссии */}
      <div className="event-section">
        <h3 className="section-title">ℹ️ Важная информация</h3>
        <div className="event-info">
          <div className="info-item">
            <span className="info-label">Комиссия казино:</span>
            <span className="info-value">{event.houseEdge}%</span>
          </div>
          <div className="info-item">
            <span className="info-label">Принцип работы:</span>
            <span className="info-value">
              Коэффициенты зависят от распределения ставок
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Выплаты:</span>
            <span className="info-value">
              Автоматически после завершения события
            </span>
          </div>
        </div>
      </div>
      {/* Предупреждение */}
      {timeLeft === 'Завершено' && (
        <div className="event-warning">
          ⚠️ Время для размещения ставок истекло
        </div>
      )}
    </div>
  );
};
export default EventDetails;