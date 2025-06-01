// frontend/src/components/events/UserEventBets.js
import React, { useState, useEffect } from 'react';
import { eventsApi } from '../../services/api';

const UserEventBets = ({ onRefresh }) => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  console.log('UserEventBets: Компонент загружен');

  // Загрузка ставок при монтировании
  useEffect(() => {
    fetchUserBets();
  }, []);

  // Загрузка ставок пользователя
  const fetchUserBets = async (showLoader = true) => {
    try {
      console.log('UserEventBets: Начинаем загрузку ставок...');
      
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await eventsApi.getUserBets({ limit: 50 });
      console.log('UserEventBets: Ответ API:', response.data);
      
      if (response.data.success) {
        setBets(response.data.data.bets || []);
        setError(null);
        console.log('UserEventBets: Загружено ставок:', response.data.data.bets?.length || 0);
      } else {
        setError('Не удалось загрузить ставки');
        console.error('UserEventBets: API вернул ошибку:', response.data);
      }
    } catch (err) {
      console.error('UserEventBets: Ошибка загрузки ставок:', err);
      setError(err.response?.data?.message || 'Ошибка подключения к серверу');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Обработчик обновления
  const handleRefresh = () => {
    console.log('UserEventBets: Обновление ставок...');
    fetchUserBets(false);
    if (onRefresh) {
      onRefresh();
    }
  };

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

  // Стили
  const styles = {
    container: {
      padding: '20px',
      backgroundColor: '#1e1e1e',
      borderRadius: '12px',
      color: 'white',
      minHeight: '300px'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    title: {
      color: '#0ba84a',
      margin: 0,
      fontSize: '20px',
      fontWeight: 'bold'
    },
    refreshBtn: {
      background: 'none',
      border: 'none',
      color: 'white',
      fontSize: '18px',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '50%',
      transition: 'all 0.3s ease'
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      color: 'rgba(255, 255, 255, 0.7)'
    },
    error: {
      textAlign: 'center',
      padding: '40px',
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 59, 48, 0.3)'
    },
    noBets: {
      textAlign: 'center',
      padding: '60px 20px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '2px dashed rgba(255, 255, 255, 0.1)'
    },
    betsList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    },
    betItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      padding: '15px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.3s ease'
    },
    betHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10px',
      gap: '10px'
    },
    eventTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'white',
      flex: 1
    },
    betStatus: {
      fontSize: '12px',
      fontWeight: 'bold',
      padding: '4px 8px',
      borderRadius: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)'
    },
    outcomeInfo: {
      marginBottom: '10px',
      padding: '8px',
      backgroundColor: 'rgba(11, 168, 74, 0.1)',
      borderRadius: '6px'
    },
    detailsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '8px',
      marginBottom: '10px'
    },
    detailItem: {
      padding: '6px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '4px',
      fontSize: '12px'
    },
    label: {
      color: 'rgba(255, 255, 255, 0.7)',
      display: 'block'
    },
    value: {
      fontWeight: 'bold',
      color: 'white'
    },
    positive: {
      color: '#0ba84a'
    },
    negative: {
      color: '#ff3b30'
    },
    retryBtn: {
      backgroundColor: '#0ba84a',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 20px',
      cursor: 'pointer',
      marginTop: '15px'
    }
  };

  // Рендер загрузки
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div>⏳ Загрузка ставок...</div>
        </div>
      </div>
    );
  }

  // Рендер ошибки
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3 style={{ color: '#ff3b30', margin: '0 0 10px 0' }}>Ошибка загрузки</h3>
          <p style={{ margin: '0 0 15px 0' }}>{error}</p>
          <button onClick={() => fetchUserBets()} style={styles.retryBtn}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Заголовок */}
      <div style={styles.header}>
        <h3 style={styles.title}>🎯 Мои ставки на события</h3>
        <button 
          style={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '⟳' : '🔄'}
        </button>
      </div>

      {/* Контент */}
      {bets.length === 0 ? (
        <div style={styles.noBets}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
          <h3>Нет ставок</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы еще не делали ставки на события. Выберите событие и сделайте свою первую ставку!
          </p>
        </div>
      ) : (
        <div style={styles.betsList}>
          {bets.map(bet => {
            const status = getBetStatus(bet);
            const potentialWin = getPotentialWin(bet);

            return (
              <div key={bet._id} style={styles.betItem}>
                {/* Заголовок ставки */}
                <div style={styles.betHeader}>
                  <div style={styles.eventTitle}>{bet.event.title}</div>
                  <div style={{ ...styles.betStatus, color: status.color }}>
                    {status.icon} {status.text}
                  </div>
                </div>

                {/* Информация об исходе */}
                <div style={styles.outcomeInfo}>
                  <strong style={{ color: '#0ba84a' }}>Исход:</strong> {bet.outcomeName}
                </div>

                {/* Детали ставки */}
                <div style={styles.detailsGrid}>
                  <div style={styles.detailItem}>
                    <span style={styles.label}>Ставка:</span>
                    <span style={styles.value}>{bet.amount.toFixed(2)} USDT</span>
                  </div>
                  
                  <div style={styles.detailItem}>
                    <span style={styles.label}>Коэффициент:</span>
                    <span style={styles.value}>×{bet.odds.toFixed(2)}</span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.label}>
                      {bet.isSettled && bet.isWin ? 'Выигрыш:' : 'Потенциальный выигрыш:'}
                    </span>
                    <span style={{ ...styles.value, ...styles.positive }}>
                      {bet.isSettled && bet.isWin ? bet.winAmount.toFixed(2) : potentialWin} USDT
                    </span>
                  </div>

                  {bet.isSettled && (
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Прибыль:</span>
                      <span style={{
                        ...styles.value,
                        ...(bet.isWin ? styles.positive : styles.negative)
                      }}>
                        {bet.isWin ? '+' : '-'}{Math.abs(bet.isWin ? (bet.winAmount - bet.amount) : bet.amount).toFixed(2)} USDT
                      </span>
                    </div>
                  )}
                </div>

                {/* Дата */}
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                  Создана: {formatDate(bet.createdAt)}
                  {bet.isSettled && bet.settledAt && (
                    <span style={{ marginLeft: '15px' }}>
                      • Рассчитана: {formatDate(bet.settledAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Статистика */}
      {bets.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: 'rgba(11, 168, 74, 0.1)', 
          borderRadius: '8px',
          border: '1px solid rgba(11, 168, 74, 0.3)'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0ba84a' }}>📈 Статистика</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0ba84a' }}>
                {bets.length}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Всего ставок
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0ba84a' }}>
                {bets.filter(bet => bet.isSettled && bet.isWin).length}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Выиграно
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                {bets.reduce((sum, bet) => sum + bet.amount, 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Поставлено USDT
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserEventBets;
