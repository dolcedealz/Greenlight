// frontend/src/components/events/EventBet.js
import React, { useState, useEffect } from 'react';
import '../../styles/EventBet.css';

const EventBet = ({ event, outcome, balance, onPlaceBet, onClose }) => {
  const [betAmount, setBetAmount] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState('');

  // Быстрые кнопки сумм
  const quickAmounts = [1, 5, 10, 25, 50, 100];

  // Текущий коэффициент для выбранного исхода
  const currentOdds = event.currentOdds[outcome.id];

  // Потенциальный выигрыш
  const potentialWin = betAmount ? (parseFloat(betAmount) * currentOdds).toFixed(2) : '0.00';

  // Потенциальная прибыль
  const potentialProfit = betAmount ? (potentialWin - parseFloat(betAmount)).toFixed(2) : '0.00';

  // Закрытие модального окна при нажатии ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.keyCode === 27) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Валидация суммы ставки
  const validateBetAmount = (amount) => {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Введите корректную сумму';
    }
    
    if (numAmount < event.minBet) {
      return `Минимальная ставка: ${event.minBet} USDT`;
    }
    
    if (numAmount > event.maxBet) {
      return `Максимальная ставка: ${event.maxBet} USDT`;
    }
    
    if (numAmount > balance) {
      return 'Недостаточно средств на балансе';
    }
    
    return '';
  };

  // Обработчик изменения суммы
  const handleAmountChange = (e) => {
    const value = e.target.value;
    
    // Разрешаем только числа и точку
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }
    
    setBetAmount(value);
    setError(validateBetAmount(value));
  };

  // Обработчик быстрых кнопок
  const handleQuickAmount = (amount) => {
    setBetAmount(amount.toString());
    setError(validateBetAmount(amount.toString()));
  };

  // Обработчик кнопки "Всё"
  const handleMaxAmount = () => {
    const maxAmount = Math.min(balance, event.maxBet).toString();
    setBetAmount(maxAmount);
    setError(validateBetAmount(maxAmount));
  };

  // Обработчик размещения ставки
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateBetAmount(betAmount);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsPlacing(true);
    
    try {
      await onPlaceBet({
        amount: parseFloat(betAmount),
        odds: currentOdds,
        potentialWin: parseFloat(potentialWin)
      });
    } catch (err) {
      setError(err.message || 'Ошибка размещения ставки');
    } finally {
      setIsPlacing(false);
    }
  };

  // Обработчик клика по фону (закрытие модального окна)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="event-bet-modal" onClick={handleBackdropClick}>
      <div className="event-bet-container">
        {/* Заголовок */}
        <div className="bet-header">
          <h3>Размещение ставки</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Информация о событии */}
        <div className="bet-event-info">
          <div className="event-name">{event.title}</div>
          <div className="outcome-selected">
            <span className="outcome-label">Выбранный исход:</span>
            <span className="outcome-name">{outcome.name}</span>
          </div>
          <div className="current-odds">
            <span className="odds-label">Текущий коэффициент:</span>
            <span className="odds-value">×{currentOdds.toFixed(2)}</span>
          </div>
        </div>

        {/* Форма ставки */}
        <form onSubmit={handleSubmit} className="bet-form">
          {/* Баланс */}
          <div className="balance-info">
            <span className="balance-label">Доступно:</span>
            <span className="balance-amount">{balance.toFixed(2)} USDT</span>
          </div>

          {/* Поле ввода суммы */}
          <div className="amount-input-group">
            <label htmlFor="betAmount">Сумма ставки:</label>
            <div className="amount-input-container">
              <input
                type="text"
                id="betAmount"
                value={betAmount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className={`amount-input ${error ? 'error' : ''}`}
                disabled={isPlacing}
              />
              <span className="currency-label">USDT</span>
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>

          {/* Быстрые кнопки */}
          <div className="quick-amounts">
            <div className="quick-amounts-label">Быстрый выбор:</div>
            <div className="quick-buttons">
              {quickAmounts
                .filter(amount => amount <= balance && amount <= event.maxBet)
                .map(amount => (
                  <button
                    key={amount}
                    type="button"
                    className={`quick-button ${betAmount === amount.toString() ? 'active' : ''}`}
                    onClick={() => handleQuickAmount(amount)}
                    disabled={isPlacing}
                  >
                    {amount}
                  </button>
                ))}
              <button
                type="button"
                className={`quick-button max-button ${betAmount === Math.min(balance, event.maxBet).toString() ? 'active' : ''}`}
                onClick={handleMaxAmount}
                disabled={isPlacing || balance === 0}
              >
                Всё
              </button>
            </div>
          </div>

          {/* Информация о выигрыше */}
          {betAmount && !error && (
            <div className="win-info">
              <div className="win-item">
                <span className="win-label">Потенциальный выигрыш:</span>
                <span className="win-value">{potentialWin} USDT</span>
              </div>
              <div className="win-item">
                <span className="win-label">Чистая прибыль:</span>
                <span className="win-value profit">{potentialProfit} USDT</span>
              </div>
            </div>
          )}

          {/* Предупреждения */}
          <div className="bet-warnings">
            <div className="warning-item">
              ⚠️ Коэффициенты могут измениться до момента размещения ставки
            </div>
            <div className="warning-item">
              💡 Комиссия казино: {event.houseEdge}% уже учтена в коэффициентах
            </div>
          </div>

          {/* Кнопки */}
          <div className="bet-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isPlacing}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="place-bet-button"
              disabled={!betAmount || error || isPlacing}
            >
              {isPlacing ? 'Размещение...' : `Поставить ${betAmount || '0'} USDT`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventBet;
