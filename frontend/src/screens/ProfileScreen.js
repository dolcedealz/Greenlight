// frontend/src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import Deposits from '../components/profile/Deposits';
import Withdrawals from '../components/profile/Withdrawals';
import useTactileFeedback from '../hooks/useTactileFeedback';
import { userApi, gameApi } from '../services';
import { showNotification } from '../utils/telegram';
import '../styles/ProfileScreen.css';

const ProfileScreen = ({ balance, onBalanceUpdate }) => {
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Добавляем тактильную обратную связь
  const { 
    buttonPressFeedback, 
    selectionChanged, 
    successNotification,
    navigationFeedback 
  } = useTactileFeedback();
  
  // Загружаем данные пользователя при загрузке компонента
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Загружаем профиль пользователя
        const profileResponse = await userApi.getUserProfile();
        setUserData(profileResponse.data.data);
        
        // Загружаем транзакции пользователя
        const transactionsResponse = await userApi.getTransactions({ limit: 20 });
        setTransactions(transactionsResponse.data.data.transactions);
        
        // Загружаем статистику игр
        const statsResponse = await gameApi.getGameStats();
        setStats(statsResponse.data.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Ошибка загрузки данных профиля:', err);
        setError('Не удалось загрузить данные профиля. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Копирование реферального кода с вибрацией
  const copyReferralCode = () => {
    if (userData && userData.referralCode) {
      buttonPressFeedback(); // Вибрация при нажатии
      
      navigator.clipboard.writeText(`https://t.me/greenlight_casino_bot?start=${userData.referralCode}`)
        .then(() => {
          successNotification(); // Вибрация успеха
          showNotification('Реферальная ссылка скопирована!');
        })
        .catch(err => {
          console.error('Ошибка при копировании:', err);
          showNotification('Не удалось скопировать ссылку');
        });
    }
  };

  // Обработчик смены вкладок с вибрацией
  const handleTabChange = (tab) => {
    if (activeTab !== tab) {
      selectionChanged(); // Вибрация при смене вкладки
    } else {
      navigationFeedback(); // Обычная навигационная вибрация
    }
    setActiveTab(tab);
  };

  // Обработчик переключателей с вибрацией
  const handleToggleChange = (e) => {
    selectionChanged(); // Вибрация при переключении
    // Здесь можно добавить логику сохранения настроек
  };

  // Обработчик попытки снова с вибрацией
  const handleRetryClick = () => {
    buttonPressFeedback(); // Вибрация при нажатии
    window.location.reload();
  };

  // Обработчик ссылок с вибрацией
  const handleLinkClick = () => {
    buttonPressFeedback(); // Вибрация при нажатии на ссылку
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
  
  // Получаем иконку для типа транзакции
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
  
  // Получаем название типа транзакции
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
  
  // Рендер вкладки профиля
  const renderProfileTab = () => {
    if (!userData) return null;
    
    return (
      <div className="profile-tab">
        <div className="profile-info">
          <div className="profile-avatar">
            {userData.firstName.charAt(0)}{userData.lastName ? userData.lastName.charAt(0) : ''}
          </div>
          <div className="profile-details">
            <h2>{userData.firstName} {userData.lastName}</h2>
            {userData.username && <p className="username">@{userData.username}</p>}
            <p className="join-date">На платформе с {formatDate(userData.createdAt)}</p>
          </div>
        </div>
        
        <div className="profile-balance">
          <div className="balance-header">
            <h3>Баланс</h3>
          </div>
          <div className="balance-amount">{balance.toFixed(2)} USDT</div>
        </div>
        
        {/* Компонент депозитов */}
        <Deposits balance={balance} onBalanceUpdate={onBalanceUpdate} />
        
        {/* Компонент выводов */}
        <Withdrawals balance={balance} onBalanceUpdate={onBalanceUpdate} />
        
        <div className="profile-stats">
          <h3>Статистика</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Всего игр</span>
              <span className="stat-value">{stats?.overall?.totalGames || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Проведено</span>
              <span className="stat-value">{stats?.overall?.totalBet?.toFixed(2) || '0.00'} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Выиграно</span>
              <span className="stat-value">{stats?.overall?.totalWin?.toFixed(2) || '0.00'} USDT</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Профит</span>
              <span className={`stat-value ${(stats?.overall?.totalWin - stats?.overall?.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
                {((stats?.overall?.totalWin || 0) - (stats?.overall?.totalLoss || 0)).toFixed(2)} USDT
              </span>
            </div>
          </div>
        </div>
        
        <div className="profile-referral">
          <h3>Реферальная программа</h3>
          <p className="referral-description">
            Приглашайте друзей и получайте 10% от их депозитов!
          </p>
          <div className="referral-code">
            <div className="code">{userData.referralCode}</div>
            <button className="copy-button" onClick={copyReferralCode}>Копировать ссылку</button>
          </div>
          <div className="referral-stats">
            <div className="referral-item">
              <span className="referral-label">Приглашено друзей</span>
              <span className="referral-value">{userData.referralCount}</span>
            </div>
            <div className="referral-item">
              <span className="referral-label">Заработано</span>
              <span className="referral-value">{userData.referralEarnings?.toFixed(2) || '0.00'} USDT</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Рендер вкладки транзакций
  const renderTransactionsTab = () => {
    return (
      <div className="transactions-tab">
        <h3>История транзакций</h3>
        
        {transactions.length === 0 ? (
          <div className="no-transactions">
            <p>У вас пока нет транзакций</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map(transaction => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-icon">
                  {getTransactionIcon(transaction.type)}
                </div>
                <div className="transaction-details">
                  <div className="transaction-header">
                    <span className="transaction-type">{getTransactionName(transaction.type)}</span>
                    <span className={`transaction-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                      {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-date">{formatDate(transaction.createdAt)}</span>
                    <span className="transaction-balance">Баланс: {transaction.balanceAfter.toFixed(2)} USDT</span>
                  </div>
                  {transaction.description && (
                    <div className="transaction-description">{transaction.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // ОБНОВЛЕННАЯ функция рендера статистики
  const renderStatsTab = () => {
    if (!stats) {
      return (
        <div className="stats-tab">
          <h3>📊 Детальная статистика</h3>
          <div className="no-game-stats">
            <div className="stats-icon">🎮</div>
            <div className="stats-text">Статистика пока пуста</div>
            <div className="stats-hint">Сыграйте несколько игр, чтобы увидеть детальную статистику</div>
          </div>
        </div>
      );
    }

    // Функция для получения процента выигрышей с индикатором
    const renderWinrateIndicator = (winRate) => {
      const percentage = (winRate * 100).toFixed(1);
      return (
        <div className="winrate-indicator">
          <span>{percentage}%</span>
          <div className="winrate-bar">
            <div 
              className="winrate-fill" 
              style={{ width: `${Math.min(winRate * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      );
    };

    // Функция для получения названия игры с иконкой
    const getGameDisplayName = (gameType) => {
      const gameNames = {
        'coin': 'Монетка',
        'mines': 'Мины', 
        'crash': 'Краш',
        'slots': 'Слоты'
      };
      return gameNames[gameType] || gameType;
    };
    
    return (
      <div className="stats-tab">
        <h3>📊 Детальная статистика</h3>
        
        {/* Общая статистика с улучшенным дизайном */}
        <div className="game-stats-summary">
          <div className="summary-item">
            <span className="summary-label">🎮 Всего игр</span>
            <span className="summary-value">{stats.overall.totalGames}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">🏆 Выигрыши</span>
            <span className="summary-value positive">
              {stats.overall.winCount} ({(stats.overall.winRate * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">💰 Проставлено</span>
            <span className="summary-value">{stats.overall.totalBet?.toFixed(2) || '0.00'} USDT</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">💎 Выиграно</span>
            <span className="summary-value positive">{stats.overall.totalWin?.toFixed(2) || '0.00'} USDT</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">📈 Общий результат</span>
            <span className={`summary-value ${(stats.overall.totalWin - stats.overall.totalLoss) >= 0 ? 'positive' : 'negative'}`}>
              {((stats.overall.totalWin || 0) - (stats.overall.totalLoss || 0)).toFixed(2)} USDT
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">🎯 Процент успеха</span>
            <span className="summary-value">
              {renderWinrateIndicator(stats.overall.winRate)}
            </span>
          </div>
        </div>
        
        {/* Детальная статистика по играм */}
        <div className="game-stats-details">
          <h4>🎲 Статистика по типам игр</h4>
          
          {Object.keys(stats.byGameType).length === 0 ? (
            <div className="no-game-stats">
              <div className="stats-icon">🎯</div>
              <div className="stats-text">Нет статистики по играм</div>
              <div className="stats-hint">Поиграйте в разные игры, чтобы увидеть детальную аналитику</div>
            </div>
          ) : (
            Object.keys(stats.byGameType).map(gameType => {
              const gameStats = stats.byGameType[gameType];
              const profitLoss = (gameStats.totalWin || 0) - (gameStats.totalLoss || 0);
              const avgBet = gameStats.totalGames > 0 ? (gameStats.totalBet / gameStats.totalGames) : 0;
              const avgWin = gameStats.winCount > 0 ? (gameStats.totalWin / gameStats.winCount) : 0;
              
              return (
                <div key={gameType} className="game-stat-item">
                  <div className="game-stat-header">
                    <h5 data-game={gameType}>{getGameDisplayName(gameType)}</h5>
                    <span className="game-stat-count">{gameStats.totalGames} игр</span>
                  </div>
                  
                  <div className="game-stat-details">
                    <div className="game-stat-detail">
                      <span>💰 Общие ставки:</span>
                      <span>{gameStats.totalBet?.toFixed(2) || '0.00'} USDT</span>
                    </div>
                    
                    <div className="game-stat-detail">
                      <span>🎯 Выигрыши:</span>
                      <span>{gameStats.winCount} из {gameStats.totalGames}</span>
                    </div>
                    
                    <div className="game-stat-detail">
                      <span>📊 Процент побед:</span>
                      <span>{renderWinrateIndicator(gameStats.winRate)}</span>
                    </div>
                    
                    <div className="game-stat-detail">
                      <span>💎 Общий выигрыш:</span>
                      <span className="positive">{gameStats.totalWin?.toFixed(2) || '0.00'} USDT</span>
                    </div>
                    
                    <div className="game-stat-detail">
                      <span>📈 Итоговый результат:</span>
                      <span className={profitLoss >= 0 ? 'positive' : 'negative'}>
                        {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USDT
                      </span>
                    </div>
                    
                    <div className="game-stat-detail">
                      <span>⚡ Средняя ставка:</span>
                      <span>{avgBet.toFixed(2)} USDT</span>
                    </div>
                    
                    {gameStats.winCount > 0 && (
                      <div className="game-stat-detail">
                        <span>🏆 Средний выигрыш:</span>
                        <span className="positive">{avgWin.toFixed(2)} USDT</span>
                      </div>
                    )}
                    
                    {gameStats.maxWin && gameStats.maxWin > 0 && (
                      <div className="game-stat-detail">
                        <span>🚀 Максимальный выигрыш:</span>
                        <span className="positive">{gameStats.maxWin.toFixed(2)} USDT</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };
  
  // Рендер вкладки настроек с вибрацией
  const renderSettingsTab = () => {
    return (
      <div className="settings-tab">
        <h3>Настройки</h3>
        
        <div className="settings-section">
          <h4>Уведомления</h4>
          <div className="setting-item">
            <span className="setting-label">Уведомления о выигрышах</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <span className="setting-label">Уведомления о депозитах</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <span className="setting-label">Уведомления о выводах</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-section">
          <h4>Отображение</h4>
          <div className="setting-item">
            <span className="setting-label">Показывать исторические данные</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <span className="setting-label">Показывать статистику игр</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-section">
          <h4>Безопасность</h4>
          <div className="setting-item">
            <span className="setting-label">Проверка честности игры</span>
            <label className="toggle">
              <input 
                type="checkbox" 
                defaultChecked 
                onChange={handleToggleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
        
        <div className="settings-section">
          <h4>О приложении</h4>
          <div className="about-item">
            <span className="about-label">Версия</span>
            <span className="about-value">1.0.0</span>
          </div>
          <div className="about-item">
            <span className="about-label">Разработчик</span>
            <span className="about-value">Greenlight Team</span>
          </div>
          <div className="about-links">
            <a 
              href="https://t.me/greenlight_news" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              Канал Telegram
            </a>
            <a 
              href="https://t.me/greenlight_support" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              Поддержка
            </a>
          </div>
        </div>
      </div>
    );
  };
  
  // Рендер активной вкладки
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'transactions':
        return renderTransactionsTab();
      case 'stats':
        return renderStatsTab();
      case 'settings':
        return renderSettingsTab();
      default:
        return renderProfileTab();
    }
  };
  
  return (
    <div className="profile-screen">
      <Header balance={balance} />
      
      <div className="profile-header">
        <h1 className="profile-title">Профиль</h1>
      </div>
      
      {loading ? (
        <div className="profile-loading">
          <div className="loader"></div>
          <p>Загрузка данных профиля...</p>
        </div>
      ) : error ? (
        <div className="profile-error">
          <p>{error}</p>
          <button onClick={handleRetryClick}>Попробовать снова</button>
        </div>
      ) : (
        <>
          <div className="profile-tabs">
            <button 
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`} 
              onClick={() => handleTabChange('profile')}
            >
              Профиль
            </button>
            <button 
              className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`} 
              onClick={() => handleTabChange('transactions')}
            >
              Транзакции
            </button>
            <button 
              className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`} 
              onClick={() => handleTabChange('stats')}
            >
              Статистика
            </button>
            <button 
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`} 
              onClick={() => handleTabChange('settings')}
            >
              Настройки
            </button>
          </div>
          
          <div className="profile-content">
            {renderActiveTab()}
          </div>
        </>
      )}
    </div>
  );
};

export default ProfileScreen;
