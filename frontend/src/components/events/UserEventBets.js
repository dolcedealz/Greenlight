// frontend/src/components/events/UserEventBets.js
import React, { useState, useEffect } from 'react';
import { eventsApi } from '../../services/api';
import '../../styles/UserEventBets.css';

const UserEventBets = ({ onRefresh }) => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'settled'

  // Загрузка ставок при монтировании
  useEffect(() => {
    fetchUserBets();
  }, []);

  // Загрузка ставок пользователя
  const fetchUserBets = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await eventsApi.getUserBets({ limit: 50 });
      
      if (response.data.success) {
        setBets(response.data.data.bets || []);
        setError(null);
      } else {
        setError('Не удалось загрузить ставки');
      }
    } catch (err) {
      console.error('Ошибка загрузки ставок:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Обработчик обновления
  const handleRefresh = () => {
    fetchUserBets(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  // Фильтрация ставок
  const filteredBets = bets.filter(bet => {
    switch (filter) {
      case 'active':
        return bet.event.status === 'active' && !bet.isSettled;
      case 'settled':
        return bet.isSettled;
      default:
        return true;
    }
  });

  // Получение статуса ставки
  const getBetStatus = (bet) => {
    if (!bet.isSettled) {
      if (bet.event.status === 'finished') {
        return { text: 'Ожидает расчета', color: '#ff9500', icon: '⏳' };
      }
      return { text: 'Активна', color: '#0ba84a', icon: '🎯' };
    }

    if (bet.isWin) {
      return { text: 'Выигрыш', color: '#0ba84a', icon: '🏆' };
    } else {
      return { text: 'Проигрыш', color: '#ff3b30', icon: '❌' };
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Расчет потенциального выигрыша
  const getPotentialWin = (bet) => {
    return (bet.amount * bet.odds).toFixed(2);
  };

  // Расчет прибыли
  const getProfit = (bet) => {
    if (!bet.isSettled) return null;
    return bet.isWin ? (bet.winAmount - bet.amount).toFixed(2) : (-bet.amount).toFixed(2);
  };

  // Рендер фильтров
  const renderFilters = () => (
    <div className="bets-filters">
      <button 
        className={`filter-button ${filter === 'all' ? 'active' : ''}`}
        onClick={() => setFilter('all')}
      >
        Все
      </button>
      <button 
        className={`filter-button ${filter === 'active' ? 'active' : ''}`}
        onClick={() => setFilter('active')}
      >
        Активные
      </button>
      <button 
        className={`filter-button ${filter === 'settled' ? 'active' : ''}`}
        onClick={() => setFilter('settled')}
      >
        Завершенные
      </button>
    </div>
  );

  // Рендер статистики
  const renderStats = () => {
    const totalBets = bets.length;
    const settledBets = bets.filter(bet => bet.isSettled);
    const wonBets = settledBets.filter(bet => bet.isWin);
    const totalStaked = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = settledBets.reduce((sum, bet) => sum + (bet.isWin ? bet.winAmount : 0), 0);
    const totalProfit = totalWon - settledBets.reduce((sum, bet) => sum + bet.amount, 0);

    return (
      <div className="bets-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Всего ставок</span>
            <span className="stat-value">{totalBets}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Выиграно</span>
            <span className="stat-value">{wonBets.length} из {settledBets.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Поставлено</span>
            <span className="stat-value">{totalStaked.toFixed(2)} USDT</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Прибыль</span>
            <span className={`stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} USDT
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Рендер загрузки
  if (loading) {
    return (
      <div className="user-bets-loading">
        <div className="loader"></div>
        <p>Загрузка ставок...</p>
      </div>
    );
  }

  // Рендер ошибки
  if (error) {
    return (
      <div className="user-bets-error">
        <h3>Ошибка загрузки</h3>
        <p>{error}</p>
        <button onClick={() => fetchUserBets()} className="retry-button">
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="user-event-bets">
      {/* Заголовок с кнопкой обновления */}
      <div className="bets-header">
        <h3>Мои ставки на события</h3>
        <button 
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          🔄
        </button>
      </div>

      {/* Статистика */}
      {bets.length > 0 && renderStats()}

      {/* Фильтры */}
      {bets.length > 0 && renderFilters()}

      {/* Список ставок */}
      {filteredBets.length === 0 ? (
        <div className="no-bets">
          <div className="no-bets-icon">📊</div>
          <h3>
            {filter === 'all' ? 'Нет ставок' : 
             filter === 'active' ? 'Нет активных ставок' : 
             'Нет завершенных ставок'}
          </h3>
          <p>
            {filter === 'all' ? 
              'Вы еще не делали ставки на события. Выберите событие и сделайте свою первую ставку!' :
              filter === 'active' ?
              'У вас нет активных ставок в данный момент.' :
              'У вас пока нет завершенных ставок.'
            }
          </p>
        </div>
      ) : (
        <div className="bets-list">
          {filteredBets.map(bet => {
            const status = getBetStatus(bet);
            const profit = getProfit(bet);

            return (
              <div key={bet._id} className={`bet-item ${bet.isSettled ? (bet.isWin ? 'win' : 'lose') : 'active'}`}>
                <div className="bet-header">
                  <div className="event-title">{bet.event.title}</div>
                  <div className="bet-status" style={{ color: status.color }}>
                    {status.icon} {status.text}
                  </div>
                </div>

                <div className="bet-outcome">
                  <span className="outcome-label">Исход:</span>
                  <span className="outcome-name">{bet.outcomeName}</span>
                </div>

                <div className="bet-details">
                  <div className="bet-amount">
                    <span className="label">Ставка:</span>
                    <span className="value">{bet.amount.toFixed(2)} USDT</span>
                  </div>
                  
                  <div className="bet-odds">
                    <span className="label">Коэффициент:</span>
                    <span className="value">×{bet.odds.toFixed(2)}</span>
                  </div>

                  <div className="potential-win">
                    <span className="label">
                      {bet.isSettled && bet.isWin ? 'Выигрыш:' : 'Потенциальный выигрыш:'}
                    </span>
                    <span className="value positive">
                      {bet.isSettled && bet.isWin ? bet.winAmount.toFixed(2) : getPotentialWin(bet)} USDT
                    </span>
                  </div>

                  {profit !== null && (
                    <div className="bet-profit">
                      <span className="label">Прибыль:</span>
                      <span className={`value ${parseFloat(profit) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(profit) >= 0 ? '+' : ''}{profit} USDT
                      </span>
                    </div>
                  )}
                </div>

                <div className="bet-footer">
                  <div className="bet-date">
                    <span>Создана: {formatDate(bet.createdAt)}</span>
                  </div>
                  {bet.isSettled && bet.settledAt && (
                    <div className="settled-date">
                      <span>Рассчитана: {formatDate(bet.settledAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserEventBets;
