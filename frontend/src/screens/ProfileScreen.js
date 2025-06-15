// frontend/src/screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import Deposits from '../components/profile/Deposits';
import Withdrawals from '../components/profile/Withdrawals';
import { ReferralsList, EarningsHistory, PayoutModal } from '../components/referral';
import { PromoCodeInput, UserPromoCodes } from '../components/promocodes';
import useTactileFeedback from '../hooks/useTactileFeedback';
import { userApi, gameApi, referralApi, giveawayApi } from '../services';
import { showNotification } from '../utils/telegram';
import '../styles/ProfileScreen.css';

const ProfileScreen = ({ balance, onBalanceUpdate }) => {
  const [userData, setUserData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [referralData, setReferralData] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [giveawayData, setGiveawayData] = useState({
    activeGiveaways: [],
    userParticipations: {},
    participationHistory: [],
    loading: false
  });

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

        setError('Не удалось загрузить данные профиля. Пожалуйста, попробуйте еще раз.');
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Загружаем реферальные данные при переходе на вкладку рефералов
  useEffect(() => {
    if (activeTab === 'referrals' && !referralData) {
      const fetchReferralData = async () => {
        try {
          const response = await referralApi.getPartnerStats();
          if (response.data.success) {
            setReferralData(response.data.data);
          }
        } catch (err) {

          showNotification('Не удалось загрузить реферальные данные');
        }
      };

      fetchReferralData();
    }
  }, [activeTab, referralData]);

  // Загружаем данные розыгрышей при переходе на вкладку giveaways
  useEffect(() => {
    if (activeTab === 'giveaways') {
      fetchGiveawayData();
    }
  }, [activeTab]);

  const fetchGiveawayData = async () => {
    try {
      setGiveawayData(prev => ({ ...prev, loading: true }));

      // Загружаем активные розыгрыши
      const giveawaysResponse = await giveawayApi.getActiveGiveaways();
      const activeGiveaways = giveawaysResponse.data.data;

      // Загружаем статус участия для каждого розыгрыша
      const participations = {};
      for (const giveaway of activeGiveaways) {
        try {
          const participationResponse = await giveawayApi.checkParticipationStatus(giveaway._id);
          participations[giveaway._id] = participationResponse.data.data;
        } catch (err) {
          console.error(`Ошибка загрузки статуса участия для розыгрыша ${giveaway._id}:`, err);
          participations[giveaway._id] = { 
            isParticipating: false, 
            hasTodayDeposit: false, 
            participation: null 
          };
        }
      }

      // Загружаем историю участия
      const historyResponse = await giveawayApi.getUserParticipationHistory(1, 10);
      const participationHistory = historyResponse.data.data.participations;

      setGiveawayData({
        activeGiveaways,
        userParticipations: participations,
        participationHistory,
        loading: false
      });

    } catch (err) {
      console.error('Ошибка загрузки данных розыгрышей:', err);
      setGiveawayData(prev => ({ ...prev, loading: false }));
      showNotification('Не удалось загрузить данные розыгрышей');
    }
  };

  // Участие в розыгрыше
  const handleParticipateInGiveaway = async (giveawayId) => {
    try {
      buttonPressFeedback();

      const response = await giveawayApi.participateInGiveaway(giveawayId);
      
      if (response.data.success) {
        successNotification();
        showNotification(response.data.message);
        
        // Обновляем данные розыгрышей
        await fetchGiveawayData();
      }
    } catch (error) {
      console.error('Ошибка участия в розыгрыше:', error);
      showNotification(error.response?.data?.message || 'Ошибка участия в розыгрыше');
    }
  };

  // Копирование реферального кода для вкладки рефералов
  const copyReferralCode = () => {
    if (referralData?.partner?.referralCode) {
      buttonPressFeedback(); // Вибрация при нажатии

      navigator.clipboard.writeText(`https://t.me/Greenlightgames_bot?start=${referralData.partner.referralCode}`)
        .then(() => {
          successNotification(); // Вибрация успеха
          showNotification('Реферальная ссылка скопирована!');
        })
        .catch(err => {

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

  // Обработчик открытия изображения в модальном окне
  const handleImageClick = (src, alt) => {
    setImageModal({ show: true, src, alt });
  };

  // Обработчик закрытия модального окна
  const handleCloseImageModal = () => {
    setImageModal({ show: false, src: '', alt: '' });
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

  // Создание реферальной выплаты
  const handleCreatePayout = async (amount) => {
    try {
      buttonPressFeedback();

      const response = await referralApi.createPayout(amount);

      if (response.data.success) {
        successNotification();
        showNotification(`Выплата ${amount} USDT переведена на основной баланс!`);

        // Обновляем реферальные данные
        const updatedReferralData = await referralApi.getPartnerStats();
        if (updatedReferralData.data.success) {
          setReferralData(updatedReferralData.data.data);
        }

        // Обновляем основной баланс
        if (onBalanceUpdate) {
          onBalanceUpdate();
        }

        setShowPayoutModal(false);
      }
    } catch (error) {

      showNotification(error.response?.data?.message || 'Ошибка создания выплаты');
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

        {/* Компоненты промокодов */}
        <div className="promocodes-section">
          <h3>🎁 Промокоды</h3>
          <PromoCodeInput onBalanceUpdate={onBalanceUpdate} />
          <UserPromoCodes />
        </div>

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
                  
                  {/* НОВОЕ: Показ информации о комиссии для депозитов и выводов */}
                  {transaction.payment && (transaction.type === 'deposit' || transaction.type === 'withdrawal') && (
                    <div className="transaction-commission-info">
                      {transaction.payment.grossAmount && (
                        <span className="commission-detail">
                          Валовая сумма: {transaction.payment.grossAmount.toFixed(2)} USDT
                        </span>
                      )}
                      {transaction.payment.fee && transaction.payment.fee > 0 && (
                        <span className="commission-detail commission-fee">
                          Комиссия CryptoBot: {transaction.payment.fee.toFixed(2)} USDT (3%)
                        </span>
                      )}
                    </div>
                  )}
                  
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

  // Рендер вкладки рефералов
  const renderReferralsTab = () => {
    if (!referralData) {
      return (
        <div className="referrals-tab">
          <div className="referrals-loading">
            <div className="loader"></div>
            <p>Загрузка реферальных данных...</p>
          </div>
        </div>
      );
    }

    const { partner, stats } = referralData;

    // Функция для получения отображения уровня
    const getLevelDisplay = (level) => {
      const levels = {
        bronze: { name: 'Бронза', icon: '🥉', color: '#CD7F32' },
        silver: { name: 'Серебро', icon: '🥈', color: '#C0C0C0' },
        gold: { name: 'Золото', icon: '🥇', color: '#FFD700' },
        platinum: { name: 'Платина', icon: '💎', color: '#E5E4E2' },
        vip: { name: 'VIP', icon: '🌟', color: '#9400D3' }
      };
      return levels[level] || { name: level, icon: '🎯', color: '#0ba84a' };
    };

    const levelInfo = getLevelDisplay(partner.level);
    const progress = partner.progress;

    return (
      <div className="referrals-tab">
        {/* Карточка уровня партнера */}
        <div className="referral-level-card" style={{ borderColor: levelInfo.color }}>
          <div className="level-header">
            <div className="level-icon">{levelInfo.icon}</div>
            <div className="level-info">
              <h3>{levelInfo.name}</h3>
              <p className="commission-rate">{stats.commissionPercent}% комиссия</p>
            </div>
          </div>

          {progress.nextLevel && (
            <div className="level-progress">
              <div className="progress-info">
                <span>До {getLevelDisplay(progress.nextLevel).name}</span>
                <span>{progress.current}/{progress.current + progress.needed} активных</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${progress.progress}%`,
                    backgroundColor: levelInfo.color 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Реферальный баланс */}
        <div className="referral-balance-card">
          <div className="balance-header">
            <h3>💰 Реферальный баланс</h3>
            <button 
              className="payout-button"
              onClick={() => setShowPayoutModal(true)}
              disabled={stats.referralBalance < 10}
            >
              Вывести
            </button>
          </div>
          <div className="balance-amount">
            {stats.referralBalance.toFixed(2)} USDT
          </div>
          <div className="balance-stats">
            <div className="stat-item">
              <span>Всего заработано</span>
              <span>{stats.totalEarned.toFixed(2)} USDT</span>
            </div>
            <div className="stat-item">
              <span>Выведено</span>
              <span>{stats.totalWithdrawn.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>

        {/* Статистика рефералов */}
        <div className="referral-stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalReferrals}</div>
              <div className="stat-label">Всего рефералов</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeReferrals}</div>
              <div className="stat-label">Активных</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💎</div>
            <div className="stat-content">
              <div className="stat-value">{stats.referralsWithDeposits}</div>
              <div className="stat-label">С депозитами</div>
            </div>
          </div>
        </div>

        {/* Реферальная ссылка */}
        <div className="referral-link-section">
          <h3>🔗 Ваша реферальная ссылка</h3>
          <div className="link-container">
            <input 
              type="text" 
              value={`https://t.me/Greenlightgames_bot?start=${partner.referralCode}`}
              readOnly
            />
            <button onClick={copyReferralCode}>📋</button>
          </div>
          <div className="referral-code">
            Ваш код: <span>{partner.referralCode}</span>
          </div>
        </div>

        {/* Компоненты рефералов */}
        <div className="referral-components">
          <div className="referral-section">
            <h4>👥 Список рефералов</h4>
            <ReferralsList />
          </div>

          <div className="referral-section">
            <h4>💰 История начислений</h4>
            <EarningsHistory />
          </div>
        </div>
      </div>
    );
  };

  // Рендер вкладки розыгрышей
  const renderGiveawaysTab = () => {
    if (giveawayData.loading) {
      return (
        <div className="giveaways-tab">
          <div className="giveaways-loading">
            <div className="loader"></div>
            <p>Загрузка розыгрышей...</p>
          </div>
        </div>
      );
    }

    const formatGiveawayTime = (type, drawDate) => {
      const date = new Date(drawDate);
      const now = new Date();
      
      // Показываем реальное время розыгрыша в МСК
      const timeString = date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      if (type === 'daily') {
        // Проверяем, действительно ли это сегодня
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const drawDateDay = new Date(date);
        drawDateDay.setHours(0, 0, 0, 0);
        
        if (drawDateDay.getTime() === today.getTime()) {
          return `Сегодня в ${timeString}`;
        } else if (drawDateDay.getTime() === tomorrow.getTime()) {
          return `Завтра в ${timeString}`;
        } else {
          // Для других дней показываем дату
          const dayDate = date.toLocaleDateString('ru-RU', {
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit'
          });
          return `${dayDate} в ${timeString}`;
        }
      } else if (type === 'weekly') {
        const day = date.toLocaleDateString('ru-RU', { 
          weekday: 'long',
          timeZone: 'Europe/Moscow'
        });
        const dayDate = date.toLocaleDateString('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: '2-digit',
          month: '2-digit'
        });
        return `${day} ${dayDate} в ${timeString}`;
      } else {
        // Для кастомных розыгрышей показываем полную дату и время
        const fullDate = date.toLocaleString('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return fullDate;
      }
    };

    const renderGiveawayCard = (giveaway) => {
      const participation = giveawayData.userParticipations[giveaway._id] || {};
      const { isParticipating, hasTodayDeposit, hasValidDeposit } = participation;
      
      // Для всех типов розыгрышей используем hasValidDeposit если он есть
      // Если нет, то для обратной совместимости используем hasTodayDeposit
      const hasDeposit = hasValidDeposit !== undefined ? hasValidDeposit : hasTodayDeposit;
      const canParticipate = !isParticipating && hasDeposit;

      return (
        <div key={giveaway._id} className={`giveaway-card ${giveaway.type}`}>
          <div className="giveaway-header">
            <h4>
              {giveaway.type === 'daily' ? '🏆 Ежедневный розыгрыш' : giveaway.type === 'weekly' ? '💎 Недельный розыгрыш' : '🎯 Кастомный розыгрыш'}
            </h4>
            <span className="giveaway-time">
              {formatGiveawayTime(giveaway.type, giveaway.drawDate)}
            </span>
          </div>
          
          <div className="giveaway-prize">
            <div className="prize-visual">
              {giveaway.prize?.imageUrl ? (
                <img 
                  src={giveaway.prize.imageUrl} 
                  alt={giveaway.prize.name}
                  className="prize-image"
                  onClick={() => handleImageClick(giveaway.prize.imageUrl, giveaway.prize.name)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <div className="prize-icon" style={{ display: giveaway.prize?.imageUrl ? 'none' : 'block' }}>
                {giveaway.prize?.type === 'telegram_gift' ? '🎁' : 
                 giveaway.prize?.type === 'promo_code' ? '🎫' : 
                 giveaway.prize?.type === 'balance_bonus' ? '💰' : '🎁'}
              </div>
            </div>
            <div className="prize-info">
              <div className="prize-name">
                {giveaway.prize?.name || 'Telegram Gift'}
              </div>
              <div className="prize-description">
                {giveaway.prize?.description || 'Приз будет объявлен'}
              </div>
              {giveaway.prize?.value && (
                <div className="prize-value">
                  Ценность: {giveaway.prize.value} USDT
                </div>
              )}
            </div>
          </div>

          <div className="giveaway-stats">
            <div className="stat-item">
              <span className="stat-label">Участников:</span>
              <span className="stat-value">{giveaway.participationCount || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Победителей:</span>
              <span className="stat-value">{giveaway.winnersCount}</span>
            </div>
            {giveaway.minDepositAmount && (
              <div className="stat-item">
                <span className="stat-label">Мин. депозит:</span>
                <span className="stat-value">{giveaway.minDepositAmount} USDT</span>
              </div>
            )}
          </div>

          <div className="giveaway-actions">
            {isParticipating ? (
              <button className="participate-btn" disabled>
                ✅ Вы участвуете (#{participation.participation?.participationNumber})
              </button>
            ) : canParticipate ? (
              <button 
                className="participate-btn" 
                onClick={() => handleParticipateInGiveaway(giveaway._id)}
              >
                🎯 Участвовать
              </button>
            ) : (
              <button className="participate-btn" disabled>
                💰 Сначала сделайте депозит
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="giveaways-tab">
        <h3>🎁 Розыгрыши</h3>
        

        <div className="active-giveaways">
          {giveawayData.activeGiveaways.length === 0 ? (
            <div className="no-giveaways">
              <div className="no-giveaways-icon">🎁</div>
              <div className="no-giveaways-text">Сейчас нет активных розыгрышей</div>
              <div className="no-giveaways-hint">Следите за обновлениями в нашем канале</div>
            </div>
          ) : (
            giveawayData.activeGiveaways.map(renderGiveawayCard)
          )}
        </div>

        <div className="giveaway-history">
          <h4>📊 История участия</h4>
          {giveawayData.participationHistory.length === 0 ? (
            <div className="no-history">
              <div className="history-icon">📋</div>
              <div className="history-text">У вас пока нет истории участия</div>
              <div className="history-hint">Примите участие в розыгрыше, и здесь появится история</div>
            </div>
          ) : (
            <div className="history-list">
              {giveawayData.participationHistory.map((participation, index) => (
                <div key={index} className="history-item">
                  <div className="history-prize">
                    <div className="history-prize-visual">
                      {participation.giveaway.prize?.imageUrl ? (
                        <img 
                          src={participation.giveaway.prize.imageUrl} 
                          alt={participation.giveaway.prize.name}
                          className="history-prize-image"
                          onClick={() => handleImageClick(participation.giveaway.prize.imageUrl, participation.giveaway.prize.name)}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <span 
                        className="history-icon" 
                        style={{ display: participation.giveaway.prize?.imageUrl ? 'none' : 'block' }}
                      >
                        {participation.giveaway.prize?.type === 'telegram_gift' ? '🎁' : 
                         participation.giveaway.prize?.type === 'promo_code' ? '🎫' : 
                         participation.giveaway.prize?.type === 'balance_bonus' ? '💰' : '🎁'}
                      </span>
                    </div>
                    <div className="history-details">
                      <div className="history-title">{participation.giveaway.title}</div>
                      <div className="history-prize-name">
                        🎁 {participation.giveaway.prize?.name || 'Telegram Gift'}
                      </div>
                      {participation.giveaway.prize?.description && (
                        <div className="history-prize-desc">
                          {participation.giveaway.prize.description}
                        </div>
                      )}
                      {participation.giveaway.prize?.value && (
                        <div className="history-prize-value">
                          💰 Ценность: {participation.giveaway.prize.value} USDT
                        </div>
                      )}
                      <div className="history-participation-info">
                        🎯 Участник #{participation.participationNumber} из {participation.giveaway.participationCount || 0}
                      </div>
                      <div className="history-date">
                        📅 {new Date(participation.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                  <div className="history-status">
                    {participation.isWinner ? (
                      <span className="winner-badge">🏆 Победитель</span>
                    ) : participation.giveaway.status === 'completed' ? (
                      <span className="not-winner-badge">Не выиграл</span>
                    ) : (
                      <span className="pending-badge">Ожидание</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="giveaway-rules">
          <h4>📋 Правила</h4>
          <div className="rules-list">
            <div className="rule-item">
              <span className="rule-icon">✅</span>
              <span className="rule-text">Для участия в ежедневном розыгрыше нужен депозит в тот же день</span>
            </div>
            <div className="rule-item">
              <span className="rule-icon">✅</span>
              <span className="rule-text">Для недельного розыгрыша достаточно одного депозита за неделю</span>
            </div>
            <div className="rule-item">
              <span className="rule-icon">✅</span>
              <span className="rule-text">Результаты публикуются в нашем Telegram канале</span>
            </div>
            <div className="rule-item">
              <span className="rule-icon">✅</span>
              <span className="rule-text">Розыгрыш проводится прозрачно с помощью Telegram</span>
            </div>
          </div>
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
              href="https://t.me/greenlightgames" 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              Канал Telegram
            </a>
            <a 
              href="https://t.me/greenlightgamessupport" 
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
      case 'referrals':
        return renderReferralsTab();
      case 'giveaways':
        return renderGiveawaysTab();
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
              className={`tab-button ${activeTab === 'referrals' ? 'active' : ''}`} 
              onClick={() => handleTabChange('referrals')}
            >
              Рефералы
            </button>
            <button 
              className={`tab-button ${activeTab === 'giveaways' ? 'active' : ''}`} 
              onClick={() => handleTabChange('giveaways')}
            >
              Розыгрыши
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

          {/* Модальное окно выплаты */}
          {showPayoutModal && referralData && (
            <PayoutModal
              referralBalance={referralData.stats.referralBalance}
              onConfirm={handleCreatePayout}
              onClose={() => setShowPayoutModal(false)}
            />
          )}
        </>
      )}

      {/* Модальное окно изображения */}
      {imageModal.show && (
        <div className="image-modal" onClick={handleCloseImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={handleCloseImageModal}>×</button>
            <img src={imageModal.src} alt={imageModal.alt} className="image-modal-img" />
            <div className="image-modal-title">{imageModal.alt}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
