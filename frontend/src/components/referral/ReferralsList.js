// frontend/src/components/referral/ReferralsList.js
import React, { useState, useEffect } from 'react';
import { referralApi } from '../../services/api';
import '../../styles/ReferralsList.css';

const ReferralsList = () => {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [sortBy, setSortBy] = useState('date'); // date, wagered, earned
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchReferrals();
  }, [filter, sortBy, page]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      
      const params = {
        limit: 20,
        skip: (page - 1) * 20,
        activeOnly: filter === 'active'
      };
      
      const response = await referralApi.getReferrals(params);
      
      if (response.data.success) {
        const newReferrals = response.data.data.referrals;
        
        // Сортировка на клиенте
        const sorted = [...newReferrals].sort((a, b) => {
          switch (sortBy) {
            case 'wagered':
              return b.totalWagered - a.totalWagered;
            case 'earned':
              return (b.totalWagered * 0.05) - (a.totalWagered * 0.05); // Примерный расчет
            default:
              return new Date(b.createdAt) - new Date(a.createdAt);
          }
        });
        
        if (page === 1) {
          setReferrals(sorted);
        } else {
          setReferrals(prev => [...prev, ...sorted]);
        }
        
        setHasMore(newReferrals.length === 20);
      }
    } catch (error) {
      console.error('Ошибка загрузки рефералов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatActivity = (lastActivity) => {
    const now = new Date();
    const last = new Date(lastActivity);
    const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return `${days} дней назад`;
    if (days < 30) return `${Math.floor(days / 7)} недель назад`;
    return `${Math.floor(days / 30)} месяцев назад`;
  };

  return (
    <div className="referrals-list">
      {/* Фильтры и сортировка */}
      <div className="referrals-controls">
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => handleFilterChange('all')}
          >
            Все ({referrals.length})
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''}
            onClick={() => handleFilterChange('active')}
          >
            Активные
          </button>
          <button 
            className={filter === 'inactive' ? 'active' : ''}
            onClick={() => handleFilterChange('inactive')}
          >
            Неактивные
          </button>
        </div>
        
        <select 
          className="sort-select"
          value={sortBy} 
          onChange={(e) => handleSortChange(e.target.value)}
        >
          <option value="date">По дате регистрации</option>
          <option value="wagered">По объему ставок</option>
          <option value="earned">По заработку</option>
        </select>
      </div>

      {/* Список рефералов */}
      {loading && page === 1 ? (
        <div className="referrals-loading">
          <div className="loader"></div>
          <p>Загрузка рефералов...</p>
        </div>
      ) : referrals.length === 0 ? (
        <div className="no-referrals">
          <div className="no-referrals-icon">😔</div>
          <h3>У вас пока нет рефералов</h3>
          <p>Поделитесь реферальной ссылкой с друзьями и начните зарабатывать!</p>
        </div>
      ) : (
        <>
          <div className="referrals-grid">
            {referrals.map((referral) => {
              const isActive = referral.isActive;
              const earned = referral.totalWagered * 0.05; // Примерный расчет
              
              return (
                <div key={referral._id} className={`referral-card ${isActive ? 'active' : 'inactive'}`}>
                  <div className="referral-header">
                    <div className="referral-avatar">
                      {referral.firstName ? referral.firstName.charAt(0) : '?'}
                    </div>
                    <div className="referral-info">
                      <h4>{referral.firstName} {referral.lastName || ''}</h4>
                      {referral.username && (
                        <p className="referral-username">@{referral.username}</p>
                      )}
                    </div>
                    <div className={`referral-status ${isActive ? 'active' : 'inactive'}`}>
                      {isActive ? '🟢' : '🔴'}
                    </div>
                  </div>
                  
                  <div className="referral-stats">
                    <div className="stat">
                      <span className="stat-label">Зарегистрирован</span>
                      <span className="stat-value">{formatDate(referral.createdAt)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Последняя активность</span>
                      <span className="stat-value">{formatActivity(referral.lastActivity)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Объем ставок</span>
                      <span className="stat-value">{referral.totalWagered.toFixed(2)} USDT</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Ваш заработок</span>
                      <span className="stat-value earned">+{earned.toFixed(2)} USDT</span>
                    </div>
                  </div>
                  
                  <div className="referral-profit">
                    <div className="profit-indicator">
                      {referral.profitLoss >= 0 ? (
                        <span className="profit positive">
                          Игрок в плюсе: +{referral.profitLoss.toFixed(2)} USDT
                        </span>
                      ) : (
                        <span className="profit negative">
                          Игрок в минусе: {referral.profitLoss.toFixed(2)} USDT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Кнопка загрузки еще */}
          {hasMore && (
            <div className="load-more-container">
              <button 
                className="load-more-button"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Загрузка...' : 'Показать еще'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Статистика внизу */}
      <div className="referrals-summary">
        <div className="summary-card">
          <h4>💡 Как увеличить доход?</h4>
          <ul>
            <li>Приглашайте активных игроков</li>
            <li>Помогайте рефералам освоиться</li>
            <li>Делитесь стратегиями игры</li>
            <li>Повышайте свой уровень партнера</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralsList;