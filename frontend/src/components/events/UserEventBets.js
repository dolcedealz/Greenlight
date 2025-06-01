// frontend/src/components/events/UserEventBets.js - УЛУЧШЕННАЯ ВЕРСИЯ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
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
    console.log('UserEventBets: useEffect - начальная загрузка');
    fetchUserBets();
  }, []);

  // Загрузка ставок пользователя с детальным логированием
  const fetchUserBets = async (showLoader = true) => {
    try {
      console.log('UserEventBets: === НАЧАЛО ЗАГРУЗКИ СТАВОК ===');
      console.log('UserEventBets: showLoader:', showLoader);
      
      if (showLoader) {
        setLoading(true);
        console.log('UserEventBets: Устанавливаем loading = true');
      } else {
        setRefreshing(true);
        console.log('UserEventBets: Устанавливаем refreshing = true');
      }

      setError(null);
      console.log('UserEventBets: Сбрасываем ошибку');

      // Проверяем доступность API метода
      if (!eventsApi || typeof eventsApi.getUserBets !== 'function') {
        throw new Error('API метод eventsApi.getUserBets не найден');
      }

      console.log('UserEventBets: Вызываем eventsApi.getUserBets...');
      console.log('UserEventBets: API URL:', eventsApi.defaults?.baseURL || 'неизвестно');
      
      const startTime = Date.now();
      const response = await eventsApi.getUserBets({ limit: 50 });
      const endTime = Date.now();
      
      console.log(`UserEventBets: API запрос занял ${endTime - startTime}ms`);
      console.log('UserEventBets: Полный ответ API:', response);
      console.log('UserEventBets: response.data:', response.data);
      
      if (!response) {
        throw new Error('Получен пустой ответ от API');
      }

      if (!response.data) {
        throw new Error('Отсутствует поле data в ответе API');
      }
      
      if (response.data.success === false) {
        throw new Error(response.data.message || 'API вернул success: false');
      }

      if (response.data.success === true) {
        console.log('UserEventBets: API вернул success: true');
        
        if (!response.data.data) {
          console.warn('UserEventBets: Отсутствует поле data.data, устанавливаем пустой массив');
          setBets([]);
        } else {
          console.log('UserEventBets: response.data.data:', response.data.data);
          
          const betsData = response.data.data.bets || response.data.data || [];
          console.log('UserEventBets: Извлеченные ставки:', betsData);
          console.log('UserEventBets: Количество ставок:', Array.isArray(betsData) ? betsData.length : 'не массив');
          
          if (Array.isArray(betsData)) {
            setBets(betsData);
            console.log('UserEventBets: Ставки успешно установлены');
          } else {
            console.warn('UserEventBets: betsData не является массивом:', typeof betsData);
            setBets([]);
          }
        }
      } else {
        console.warn('UserEventBets: Неопределенный статус success:', response.data.success);
        setBets([]);
      }
      
      console.log('UserEventBets: === УСПЕШНОЕ ЗАВЕРШЕНИЕ ЗАГРУЗКИ ===');
      
    } catch (err) {
      console.error('UserEventBets: === ОШИБКА ПРИ ЗАГРУЗКЕ ===');
      console.error('UserEventBets: Тип ошибки:', err.constructor.name);
      console.error('UserEventBets: Сообщение ошибки:', err.message);
      console.error('UserEventBets: Полная ошибка:', err);
      
      if (err.response) {
        console.error('UserEventBets: HTTP статус:', err.response.status);
        console.error('UserEventBets: Заголовки ответа:', err.response.headers);
        console.error('UserEventBets: Данные ответа:', err.response.data);
      } else if (err.request) {
        console.error('UserEventBets: Запрос был отправлен, но ответ не получен');
        console.error('UserEventBets: Детали запроса:', err.request);
      } else {
        console.error('UserEventBets: Ошибка при настройке запроса:', err.message);
      }
      
      // Детальная обработка ошибок
      let errorMessage = 'Неизвестная ошибка';
      
      if (err.message.includes('getUserBets не найден')) {
        errorMessage = 'API метод getUserBets еще не реализован';
      } else if (err.response?.status === 404) {
        errorMessage = 'Эндпоинт для получения ставок не найден (404)';
      } else if (err.response?.status === 401) {
        errorMessage = 'Ошибка аутентификации (401) - проверьте данные Telegram';
      } else if (err.response?.status === 403) {
        errorMessage = 'Доступ запрещен (403)';
      } else if (err.response?.status === 500) {
        errorMessage = 'Ошибка сервера (500)';
      } else if (err.response?.status >= 400) {
        errorMessage = `Ошибка HTTP ${err.response.status}: ${err.response.data?.message || err.message}`;
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        errorMessage = 'Ошибка сети - сервер недоступен';
      } else {
        errorMessage = err.message;
      }
      
      console.error('UserEventBets: Финальное сообщение об ошибке:', errorMessage);
      setError(errorMessage);
      setBets([]); // Всегда устанавливаем пустой массив при ошибке
      
    } finally {
      console.log('UserEventBets: === БЛОК FINALLY ===');
      setLoading(false);
      setRefreshing(false);
      console.log('UserEventBets: loading и refreshing установлены в false');
    }
  };

  // Обработчик обновления
  const handleRefresh = () => {
    console.log('UserEventBets: Ручное обновление пользователем');
    fetchUserBets(false);
    if (onRefresh) {
      console.log('UserEventBets: Вызываем onRefresh callback');
      onRefresh();
    }
  };

  // Получение статуса ставки
  const getBetStatus = (bet) => {
    if (!bet.isSettled) {
      if (bet.event?.status === 'finished') {
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
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      console.error('UserEventBets: Ошибка форматирования даты:', dateString, err);
      return 'Неизвестно';
    }
  };

  // Расчет потенциального выигрыша
  const getPotentialWin = (bet) => {
    try {
      const win = bet.potentialWin || (bet.betAmount * bet.odds) || (bet.amount * bet.odds);
      return win.toFixed(2);
    } catch (err) {
      console.error('UserEventBets: Ошибка расчета потенциального выигрыша:', bet, err);
      return '0.00';
    }
  };

  // Создаем тестовые данные для демонстрации при ошибке API
  const createMockBets = () => {
    console.log('UserEventBets: Создаем тестовые данные');
    return [
      {
        _id: 'demo1',
        event: { title: 'Демо: Bitcoin достигнет $100,000 до конца года?', status: 'active' },
        outcomeName: 'Да',
        betAmount: 10.50,
        odds: 2.5,
        potentialWin: 26.25,
        isSettled: false,
        isWin: false,
        placedAt: new Date().toISOString()
      },
      {
        _id: 'demo2',
        event: { title: 'Демо: Ethereum достигнет $5000 в этом месяце?', status: 'finished' },
        outcomeName: 'Нет',
        betAmount: 25.00,
        odds: 1.8,
        potentialWin: 45.00,
        actualWin: 45.00,
        isSettled: true,
        isWin: true,
        placedAt: new Date(Date.now() - 86400000).toISOString(),
        settledAt: new Date().toISOString()
      },
      {
        _id: 'demo3',
        event: { title: 'Демо: Tesla выпустит новую модель в Q1?', status: 'finished' },
        outcomeName: 'Да',
        betAmount: 15.00,
        odds: 3.2,
        potentialWin: 48.00,
        actualWin: 0,
        isSettled: true,
        isWin: false,
        placedAt: new Date(Date.now() - 172800000).toISOString(),
        settledAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
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

  // Данные для отображения (реальные или демо при ошибке)
  const displayBets = error ? createMockBets() : bets;

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
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Показываем демо-интерфейс с тестовыми данными
          </div>
        </div>
      )}

      {/* Контент */}
      {displayBets.length === 0 ? (
        <div style={styles.noBets}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
          <h3>Нет ставок</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {!error 
              ? 'Вы еще не делали ставки на события. Выберите событие и сделайте свою первую ставку!'
              : 'Здесь будут отображаться ваши ставки после устранения проблем с API.'
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
                    <span style={styles.value}>{bet.betAmount.toFixed(2)} USDT</span>
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
                      {bet.isSettled && bet.isWin ? bet.actualWin.toFixed(2) : potentialWin} USDT
                    </span>
                  </div>

                  {bet.isSettled && (
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Прибыль:</span>
                      <span style={{
                        ...styles.value,
                        ...(bet.isWin ? styles.positive : styles.negative)
                      }}>
                        {bet.isWin ? '+' : '-'}{Math.abs(bet.isWin ? (bet.actualWin - bet.betAmount) : bet.betAmount).toFixed(2)} USDT
                      </span>
                    </div>
                  )}
                </div>

                {/* Дата */}
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                  Создана: {formatDate(bet.placedAt)}
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
                {displayBets.reduce((sum, bet) => sum + bet.betAmount, 0).toFixed(2)}
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
