// frontend/src/components/events/UserEventBets.js - УСТОЙЧИВАЯ ВЕРСИЯ
import React, { useState, useEffect } from 'react';
import { eventsApi } from '../../services/api';

const UserEventBets = ({ onRefresh }) => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);

  console.log('UserEventBets: Компонент загружен');

  // Загрузка ставок при монтировании
  useEffect(() => {
    fetchUserBets();
  }, []);

  // Загрузка ставок пользователя с защитой от ошибок
  const fetchUserBets = async (showLoader = true) => {
    try {
      console.log('UserEventBets: Попытка загрузки ставок...');
      
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null); // Сбрасываем ошибку

      // Проверяем, доступен ли метод API
      if (!eventsApi.getUserBets) {
        throw new Error('API метод getUserBets не найден');
      }

      const response = await eventsApi.getUserBets({ limit: 50 });
      console.log('UserEventBets: Успешный ответ API:', response.data);
      
      if (response.data && response.data.success) {
        setBets(response.data.data.bets || []);
        setApiAvailable(true);
        console.log('UserEventBets: Загружено ставок:', response.data.data.bets?.length || 0);
      } else {
        console.warn('UserEventBets: API вернул неуспешный ответ:', response.data);
        setError('API вернул неуспешный ответ');
        setBets([]); // Устанавливаем пустой массив
      }
    } catch (err) {
      console.error('UserEventBets: Ошибка при загрузке ставок:', err);
      
      // Обрабатываем разные типы ошибок
      if (err.message.includes('getUserBets не найден')) {
        setError('API метод getUserBets еще не реализован на сервере');
        setApiAvailable(false);
      } else if (err.response?.status === 404) {
        setError('Эндпоинт для получения ставок не найден (404)');
        setApiAvailable(false);
      } else if (err.response?.status === 500) {
        setError('Ошибка сервера при получении ставок');
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError('Ошибка сети - сервер недоступен');
      } else {
        setError(err.response?.data?.message || err.message || 'Неизвестная ошибка');
      }
      
      setBets([]); // Всегда устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Обработчик обновления
  const handleRefresh = () => {
    console.log('UserEventBets: Ручное обновление...');
    fetchUserBets(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  // Создаем тестовые данные для демонстрации интерфейса
  const createMockBets = () => {
    return [
      {
        _id: 'mock1',
        event: { title: 'Тестовое событие 1', status: 'active' },
        outcomeName: 'Исход А',
        amount: 10.50,
        odds: 2.5,
        isSettled: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: 'mock2',
        event: { title: 'Тестовое событие 2', status: 'finished' },
        outcomeName: 'Исход Б',
        amount: 25.00,
        odds: 1.8,
        isSettled: true,
        isWin: true,
        winAmount: 45.00,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        settledAt: new Date().toISOString()
      },
      {
        _id: 'mock3',
        event: { title: 'Тестовое событие 3', status: 'finished' },
        outcomeName: 'Исход В',
        amount: 15.00,
        odds: 3.2,
        isSettled: true,
        isWin: false,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        settledAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
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
    errorBox: {
      backgroundColor: 'rgba(255, 149, 0, 0.1)',
      border: '1px solid rgba(255, 149, 0, 0.3)',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '20px'
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
      borderLeft: '4px solid transparent'
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
    }
  };

  // Данные для отображения (реальные или мок)
  const displayBets = apiAvailable ? bets : (error ? createMockBets() : bets);

  // Рендер загрузки
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          <div>Загрузка ставок...</div>
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

      {/* Уведомление об ошибке API */}
      {error && (
        <div style={styles.errorBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span>⚠️</span>
            <strong style={{ color: '#ff9500' }}>Проблема с API</strong>
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '10px' }}>
            {error}
          </div>
          {!apiAvailable && (
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Показываем демо-интерфейс с тестовыми данными
            </div>
          )}
        </div>
      )}

      {/* Контент */}
      {displayBets.length === 0 ? (
        <div style={styles.noBets}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
          <h3>Нет ставок</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {apiAvailable 
              ? 'Вы еще не делали ставки на события. Выберите событие и сделайте свою первую ставку!'
              : 'Здесь будут отображаться ваши ставки после реализации API на сервере.'
            }
          </p>
        </div>
      ) : (
        <div style={styles.betsList}>
          {displayBets.map(bet => {
            const status = getBetStatus(bet);
            const potentialWin = getPotentialWin(bet);

            return (
              <div 
                key={bet._id} 
                style={{
                  ...styles.betItem,
                  borderLeftColor: bet.isSettled 
                    ? (bet.isWin ? '#0ba84a' : '#ff3b30') 
                    : '#ff9500'
                }}
              >
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
      {displayBets.length > 0 && (
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
                {displayBets.length}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Всего ставок
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0ba84a' }}>
                {displayBets.filter(bet => bet.isSettled && bet.isWin).length}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                Выиграно
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                {displayBets.reduce((sum, bet) => sum + bet.amount, 0).toFixed(2)}
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
