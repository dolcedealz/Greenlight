// frontend/src/components/referral/EarningsHistory.js
import React, { useState, useEffect } from 'react';
import { referralApi } from '../../services/api';
import '../../styles/EarningsHistory.css';

const EarningsHistory = () => {
  const [earnings, setEarnings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('earnings'); // earnings, payouts
  const [filter, setFilter] = useState('all'); // all, game_loss, registration_bonus
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totals, setTotals] = useState({
    totalEarned: 0,
    totalPaidOut: 0,
    pendingEarnings: 0
  });

  useEffect(() => {
    if (activeSection === 'earnings') {
      fetchEarnings();
    } else {
      fetchPayouts();
    }
  }, [activeSection, filter, page]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      
      const params = {
        limit: 50,
        skip: (page - 1) * 50
      };
      
      if (filter !== 'all') {
        params.type = filter;
      }
      
      const response = await referralApi.getEarningsHistory(params);
      
      if (response.data.success) {
        const newEarnings = response.data.data.earnings;
        
        if (page === 1) {
          setEarnings(newEarnings);
        } else {
          setEarnings(prev => [...prev, ...newEarnings]);
        }
        
        setHasMore(newEarnings.length === 50);
        
        // Подсчет общих сумм
        const total = newEarnings.reduce((sum, e) => sum + e.calculation.earnedAmount, 0);
        setTotals(prev => ({
          ...prev,
          totalEarned: page === 1 ? total : prev.totalEarned + total
        }));
      }
    } catch (error) {
      console.error('Ошибка загрузки начислений:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      
      const params = {
        limit: 20,
        skip: (page - 1) * 20
      };
      
      const response = await referralApi.getPayoutsHistory(params);
      
      if (response.data.success) {
        const newPayouts = response.data.data.payouts;
        
        if (page === 1) {
          setPayouts(newPayouts);
        } else {
          setPayouts(prev => [...prev, ...newPayouts]);
        }
        
        setHasMore(newPayouts.length === 20);
      }
    } catch (error) {
      console.error('Ошибка загрузки выплат:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setPage(1);
    setHasMore(true);
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEarningTypeInfo = (type) => {
    switch (type) {
      case 'game_loss':
        return { icon: '🎮', name: 'Комиссия с игры' };
      case 'registration_bonus':
        return { icon: '🎁', name: 'Бонус за регистрацию' };
      case 'coin_dispute_fee':
        return { icon: '🪙', name: 'Комиссия со спора' };
      default:
        return { icon: '💰', name: type };
    }
  };

  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'coin': return '🪙';
      case 'mines': return '💣';
      case 'crash': return '📈';
      case 'slots': return '🎰';
      default: return '🎮';
    }
  };

  const renderEarnings = () => {
    if (earnings.length === 0) {
      return (
        <div className="no-earnings">
          <div className="no-earnings-icon">📊</div>
          <h3>Нет начислений</h3>
          <p>Здесь будут отображаться ваши комиссионные</p>
        </div>
      );
    }

    // Группировка по дням
    const groupedByDay = earnings.reduce((groups, earning) => {
      const date = new Date(earning.createdAt).toLocaleDateString('ru-RU');
      if (!groups[date]) {
        groups[date] = {
          earnings: [],
          total: 0
        };
      }
      groups[date].earnings.push(earning);
      groups[date].total += earning.calculation.earnedAmount;
      return groups;
    }, {});

    return (
      <div className="earnings-list">
        {Object.entries(groupedByDay).map(([date, dayData]) => (
          <div key={date} className="earnings-day">
            <div className="day-header">
              <span className="day-date">{date}</span>
              <span className="day-total">+{dayData.total.toFixed(2)} USDT</span>
            </div>
            
            <div className="day-earnings">
              {dayData.earnings.map((earning) => {
                const typeInfo = getEarningTypeInfo(earning.type);
                
                return (
                  <div key={earning._id} className="earning-item">
                    <div className="earning-icon">{typeInfo.icon}</div>
                    <div className="earning-details">
                      <div className="earning-header">
                        <span className="earning-type">{typeInfo.name}</span>
                        <span className="earning-amount">+{earning.calculation.earnedAmount.toFixed(2)} USDT</span>
                      </div>
                      <div className="earning-info">
                        <span className="earning-referral">
                          {earning.referral.firstName} {earning.referral.lastName || ''}
                          {earning.referral.username && ` (@${earning.referral.username})`}
                        </span>
                        <span className="earning-time">{new Date(earning.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {earning.type === 'game_loss' && earning.game && (
                        <div className="earning-game">
                          <span className="game-icon">{getGameIcon(earning.metadata.gameType)}</span>
                          <span className="game-info">
                            Проигрыш: {earning.calculation.baseAmount.toFixed(2)} USDT
                            ({earning.calculation.commissionPercent}% комиссия)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPayouts = () => {
    if (payouts.length === 0) {
      return (
        <div className="no-payouts">
          <div className="no-payouts-icon">💸</div>
          <h3>Нет выплат</h3>
          <p>История ваших выводов реферального баланса</p>
        </div>
      );
    }

    return (
      <div className="payouts-list">
        {payouts.map((payout) => (
          <div key={payout._id} className="payout-item">
            <div className="payout-status">
              {payout.status === 'completed' ? '✅' : '⏳'}
            </div>
            <div className="payout-details">
              <div className="payout-header">
                <span className="payout-amount">{payout.amount.toFixed(2)} USDT</span>
                <span className="payout-date">{formatDate(payout.createdAt)}</span>
              </div>
              <div className="payout-info">
                <span>Тип: {payout.type === 'manual' ? 'Ручной вывод' : 'Автоматический'}</span>
                {payout.processing.method === 'balance_transfer' && (
                  <span className="transfer-info">→ Основной баланс</span>
                )}
              </div>
              <div className="payout-balances">
                <span>До: {payout.referralBalanceBefore.toFixed(2)} USDT</span>
                <span>→</span>
                <span>После: {payout.referralBalanceAfter.toFixed(2)} USDT</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="earnings-history">
      {/* Секции */}
      <div className="history-sections">
        <button 
          className={`section-button ${activeSection === 'earnings' ? 'active' : ''}`}
          onClick={() => handleSectionChange('earnings')}
        >
          💰 Начисления
        </button>
        <button 
          className={`section-button ${activeSection === 'payouts' ? 'active' : ''}`}
          onClick={() => handleSectionChange('payouts')}
        >
          💸 Выплаты
        </button>
      </div>

      {/* Фильтры для начислений */}
      {activeSection === 'earnings' && (
        <div className="earnings-filters">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => handleFilterChange('all')}
          >
            Все
          </button>
          <button 
            className={filter === 'game_loss' ? 'active' : ''}
            onClick={() => handleFilterChange('game_loss')}
          >
            Игры
          </button>
          <button 
            className={filter === 'registration_bonus' ? 'active' : ''}
            onClick={() => handleFilterChange('registration_bonus')}
          >
            Бонусы
          </button>
        </div>
      )}

      {/* Контент */}
      {loading && page === 1 ? (
        <div className="history-loading">
          <div className="loader"></div>
          <p>Загрузка истории...</p>
        </div>
      ) : (
        <>
          {activeSection === 'earnings' ? renderEarnings() : renderPayouts()}
          
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
    </div>
  );
};

export default EarningsHistory;