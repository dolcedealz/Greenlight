// frontend/src/screens/HistoryScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { userApi, gameApi } from '../services';
import '../styles/HistoryScreen.css';

const HistoryScreen = () => {
  const [balance, setBalance] = useState(0);
  const [games, setGames] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeSection, setActiveSection] = useState('games');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  
  // Загрузка данных при монтировании
  useEffect(() => {
    fetchData();
  }, []);
  
  // Загрузка данных в зависимости от фильтров
  const fetchData = async (gameType = null, transactionType = null) => {
    try {
      setLoading(true);
      
      // Загрузка баланса
      const balanceResponse = await userApi.getBalance();
      setBalance(balanceResponse.data.data.balance);
      
      // Загрузка истории игр
      const gameParams = { limit: 20 };
      if (gameType && gameType !== 'all') {
        gameParams.gameType = gameType;
      }
      
      const gamesResponse = await gameApi.getGameHistory(gameParams);
      setGames(gamesResponse.data.data.games || []);
      
      // Загрузка истории транзакций
      const transactionParams = { limit: 20 };
      if (transactionType && transactionType !== 'all') {
        transactionParams.type = transactionType;
      }
      
      const transactionsResponse = await userApi.getTransactions(transactionParams);
      setTransactions(transactionsResponse.data.data.transactions || []);
      
      setLoading(false);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setError('Не удалось загрузить историю. Пожалуйста, попробуйте еще раз.');
      setLoading(false);
    }
  };
  
  // Обработчик изменения фильтра
  const handleFilterChange = (type) => {
    setFilterType(type);
    
    if (activeSection === 'games') {
      fetchData(type, null);
    } else {
      fetchData(null, type);
    }
  };
  
  // Получение иконок для игр
  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'coin': return '🪙';
      case 'mines': return '💣';
      case 'crash': return '📈';
      case 'slots': return '🎰';
      default: return '🎮';
    }
  };
  
  // Получение названий игр
  const getGameName = (gameType) => {
    switch (gameType) {
      case 'coin': return 'Монетка';
      case 'mines': return 'Мины';
      case 'crash': return 'Краш';
      case 'slots': return 'Слоты';
      default: return gameType;
    }
  };
  
  // Получение иконок для транзакций
  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit': return '💰';
      case 'withdrawal': return '💸';
      case 'bet': return '🎮';
      case 'win': return '🏆';
      case 'referral': return '👥';
      case 'bonus': return '🎁';
      default: return '📋';
    }
  };
  
  // Получение названий транзакций
  const getTransactionName = (type) => {
    switch (type) {
      case 'deposit': return 'Пополнение';
      case 'withdrawal': return 'Вывод';
      case 'bet': return 'Ставка';
      case 'win': return 'Выигрыш';
      case 'referral': return 'Реферальный бонус';
      case 'bonus': return 'Бонус';
      default: return type;
    }
  };
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Рендер фильтров для игр
  const renderGameFilters = () => {
    return (
      <div className="history-filters">
        <button 
          className={`filter-button ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          Все
        </button>
        <button 
          className={`filter-button ${filterType === 'coin' ? 'active' : ''}`}
          onClick={() => handleFilterChange('coin')}
        >
          Монетка
        </button>
        <button 
          className={`filter-button ${filterType === 'mines' ? 'active' : ''}`}
          onClick={() => handleFilterChange('mines')}
        >
          Мины
        </button>
        <button 
          className={`filter-button ${filterType === 'crash' ? 'active' : ''}`}
          onClick={() => handleFilterChange('crash')}
        >
          Краш
        </button>
        <button 
          className={`filter-button ${filterType === 'slots' ? 'active' : ''}`}
          onClick={() => handleFilterChange('slots')}
        >
          Слоты
        </button>
      </div>
    );
  };
  
  // Рендер фильтров для транзакций
  const renderTransactionFilters = () => {
    return (
      <div className="history-filters">
        <button 
          className={`filter-button ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          Все
        </button>
        <button 
          className={`filter-button ${filterType === 'deposit' ? 'active' : ''}`}
          onClick={() => handleFilterChange('deposit')}
        >
          Пополнения
        </button>
        <button 
          className={`filter-button ${filterType === 'withdrawal' ? 'active' : ''}`}
          onClick={() => handleFilterChange('withdrawal')}
        >
          Выводы
        </button>
        <button 
          className={`filter-button ${filterType === 'win' ? 'active' : ''}`}
          onClick={() => handleFilterChange('win')}
        >
          Выигрыши
        </button>
        <button 
          className={`filter-button ${filterType === 'bet' ? 'active' : ''}`}
          onClick={() => handleFilterChange('bet')}
        >
          Ставки
        </button>
      </div>
    );
  };
  
  // Рендер истории игр
  const renderGames = () => {
    if (games.length === 0) {
      return (
        <div className="no-history">
          <p>У вас пока нет истории игр</p>
        </div>
      );
    }
    
    return (
      <div className="history-list">
        {games.map((game) => (
          <div key={game._id} className={`history-item ${game.win ? 'win' : 'lose'}`}>
            <div className="history-icon">
              {getGameIcon(game.gameType)}
            </div>
            <div className="history-details">
              <div className="history-header">
                <span className="history-title">{getGameName(game.gameType)}</span>
                <span className={`history-amount ${game.win ? 'positive' : 'negative'}`}>
                  {game.win ? '+' : '-'}{Math.abs(game.profit).toFixed(2)} USDT
                </span>
              </div>
              <div className="history-info">
                <span className="history-date">{formatDate(game.createdAt)}</span>
                <span className="history-result">{game.win ? 'Выигрыш' : 'Проигрыш'}</span>
              </div>
              <div className="history-details-row">
                <div className="detail-item">
                  <span className="detail-label">Ставка:</span>
                  <span className="detail-value">{game.bet.toFixed(2)} USDT</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Множитель:</span>
                  <span className="detail-value">x{game.multiplier.toFixed(2)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Баланс после:</span>
                  <span className="detail-value">{game.balanceAfter.toFixed(2)} USDT</span>
                </div>
              </div>
              {game.gameType === 'coin' && game.result && (
                <div className="game-specific-details">
                  <div className="detail-item">
                    <span className="detail-label">Выбрано:</span>
                    <span className="detail-value">
                      {game.result.selectedSide === 'heads' ? 'Орёл' : 'Решка'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Результат:</span>
                    <span className="detail-value">
                      {game.result.result === 'heads' ? 'Орёл' : 'Решка'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Рендер истории транзакций
  const renderTransactions = () => {
    if (transactions.length === 0) {
      return (
        <div className="no-history">
          <p>У вас пока нет истории транзакций</p>
        </div>
      );
    }
    
    return (
      <div className="history-list">
        {transactions.map((transaction) => (
          <div key={transaction._id} className="history-item">
            <div className="history-icon">
              {getTransactionIcon(transaction.type)}
            </div>
            <div className="history-details">
              <div className="history-header">
                <span className="history-title">{getTransactionName(transaction.type)}</span>
                <span className={`history-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                  {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)} USDT
                </span>
              </div>
              <div className="history-info">
                <span className="history-date">{formatDate(transaction.createdAt)}</span>
                <span className="history-status">{transaction.status}</span>
              </div>
              <div className="history-details-row">
                <div className="detail-item">
                  <span className="detail-label">Баланс до:</span>
                  <span className="detail-value">{transaction.balanceBefore.toFixed(2)} USDT</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Баланс после:</span>
                  <span className="detail-value">{transaction.balanceAfter.toFixed(2)} USDT</span>
                </div>
              </div>
              {transaction.description && (
                <div className="transaction-description">
                  {transaction.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="history-screen">
      <Header balance={balance} />
      
      <div className="history-header">
        <h1 className="history-title">История</h1>
      </div>
      
      <div className="history-sections">
        <button 
          className={`section-button ${activeSection === 'games' ? 'active' : ''}`}
          onClick={() => {
            setActiveSection('games');
            setFilterType('all');
            fetchData('all', null);
          }}
        >
          Игры
        </button>
        <button 
          className={`section-button ${activeSection === 'transactions' ? 'active' : ''}`}
          onClick={() => {
            setActiveSection('transactions');
            setFilterType('all');
            fetchData(null, 'all');
          }}
        >
          Транзакции
        </button>
      </div>
      
      {/* Фильтры */}
      {activeSection === 'games' ? renderGameFilters() : renderTransactionFilters()}
      
      {loading ? (
        <div className="history-loading">
          <div className="loader"></div>
          <p>Загрузка истории...</p>
        </div>
      ) : error ? (
        <div className="history-error">
          <p>{error}</p>
          <button onClick={() => {
            setFilterType('all');
            fetchData();
          }}>Попробовать снова</button>
        </div>
      ) : (
        /* Контент истории */
        <div className="history-content">
          {activeSection === 'games' ? renderGames() : renderTransactions()}
        </div>
      )}
    </div>
  );
};

export default HistoryScreen;