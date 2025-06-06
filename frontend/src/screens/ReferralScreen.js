// frontend/src/screens/ReferralScreen.js
import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout';
import { ReferralsList, EarningsHistory, PayoutModal } from '../components/referral';
import { referralApi } from '../services/api';
import { showNotification, showConfirmation } from '../utils/telegram';
import useTactileFeedback from '../hooks/useTactileFeedback';
import '../styles/ReferralScreen.css';

const ReferralScreen = ({ balance, onBalanceUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [partnerData, setPartnerData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { 
    buttonPressFeedback, 
    selectionChanged, 
    successNotification,
    errorNotification 
  } = useTactileFeedback();

  // Загрузка данных при монтировании
  useEffect(() => {
    fetchPartnerData();
  }, []);

  // Загрузка данных партнера
  const fetchPartnerData = async () => {
    try {
      setLoading(true);
      const response = await referralApi.getPartnerStats();
      
      if (response.data.success) {
        setPartnerData(response.data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных партнера:', error);
      showNotification('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // Обновление данных
  const handleRefresh = async () => {
    if (refreshing) return;
    
    buttonPressFeedback();
    setRefreshing(true);
    await fetchPartnerData();
    setRefreshing(false);
  };

  // Смена вкладки
  const handleTabChange = (tab) => {
    selectionChanged();
    setActiveTab(tab);
  };

  // Копирование реферальной ссылки
  const copyReferralLink = () => {
    if (!partnerData) return;
    
    buttonPressFeedback();
    const link = `https://t.me/Greenlightgames_bot?start=${partnerData.partner.referralCode}`;
    
    navigator.clipboard.writeText(link)
      .then(() => {
        successNotification();
        showNotification('Реферальная ссылка скопирована!');
      })
      .catch(() => {
        errorNotification();
        showNotification('Не удалось скопировать ссылку');
      });
  };

  // Поделиться ссылкой
  const shareReferralLink = () => {
    if (!partnerData) return;
    
    buttonPressFeedback();
    const link = `https://t.me/Greenlightgames_bot?start=${partnerData.partner.referralCode}`;
    const text = `🎰 Играй в Greenlight Casino и зарабатывай!\n\n💰 Бонус за регистрацию\n🎮 Лучшие игры\n💸 Быстрые выплаты\n\nРегистрируйся по моей ссылке:`;
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
      );
    }
  };

  // Создание выплаты
  const handleCreatePayout = async (amount) => {
    try {
      buttonPressFeedback();
      
      const response = await referralApi.createPayout(amount);
      
      if (response.data.success) {
        successNotification();
        showNotification(`Выплата ${amount} USDT переведена на основной баланс!`);
        
        // Обновляем данные
        await fetchPartnerData();
        
        // Обновляем основной баланс
        if (onBalanceUpdate) {
          onBalanceUpdate();
        }
        
        setShowPayoutModal(false);
      }
    } catch (error) {
      errorNotification();
      showNotification(error.response?.data?.message || 'Ошибка создания выплаты');
    }
  };

  // Форматирование уровня
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

  // Рендер заголовка
  const renderHeader = () => (
    <div className="referral-header">
      <h1 className="referral-title">👥 Партнерская программа</h1>
      <button 
        className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
        onClick={handleRefresh}
        disabled={refreshing}
      >
        🔄
      </button>
    </div>
  );

  // Рендер статистики
  const renderOverview = () => {
    if (!partnerData) return null;
    
    const levelInfo = getLevelDisplay(partnerData.partner.level);
    const progress = partnerData.partner.progress;
    
    return (
      <div className="referral-overview">
        {/* Карточка уровня */}
        <div className="level-card" style={{ borderColor: levelInfo.color }}>
          <div className="level-header">
            <div className="level-icon">{levelInfo.icon}</div>
            <div className="level-info">
              <h3>{levelInfo.name}</h3>
              <p className="commission-rate">{partnerData.stats.commissionPercent}% комиссия</p>
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

        {/* Баланс */}
        <div className="referral-balance-card">
          <div className="balance-header">
            <h3>💰 Реферальный баланс</h3>
            <button 
              className="payout-button"
              onClick={() => setShowPayoutModal(true)}
              disabled={partnerData.stats.referralBalance < 10}
            >
              Вывести
            </button>
          </div>
          <div className="balance-amount">
            {partnerData.stats.referralBalance.toFixed(2)} USDT
          </div>
          <div className="balance-stats">
            <div className="stat-item">
              <span>Всего заработано</span>
              <span>{partnerData.stats.totalEarned.toFixed(2)} USDT</span>
            </div>
            <div className="stat-item">
              <span>Выведено</span>
              <span>{partnerData.stats.totalWithdrawn.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>

        {/* Статистика рефералов */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{partnerData.stats.totalReferrals}</div>
              <div className="stat-label">Всего рефералов</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <div className="stat-value">{partnerData.stats.activeReferrals}</div>
              <div className="stat-label">Активных</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💎</div>
            <div className="stat-content">
              <div className="stat-value">{partnerData.stats.referralsWithDeposits}</div>
              <div className="stat-label">С депозитами</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-value">
                {partnerData.stats.periodEarned 
                  ? `+${partnerData.stats.periodEarned.toFixed(2)}` 
                  : '0.00'
                } USDT
              </div>
              <div className="stat-label">За сегодня</div>
            </div>
          </div>
        </div>

        {/* Реферальная ссылка */}
        <div className="referral-link-card">
          <h3>🔗 Ваша реферальная ссылка</h3>
          <div className="link-container">
            <input 
              type="text" 
              value={`https://t.me/Greenlightgames_bot?start=${partnerData.partner.referralCode}`}
              readOnly
            />
            <button onClick={copyReferralLink}>📋</button>
          </div>
          <div className="link-actions">
            <button className="share-button" onClick={shareReferralLink}>
              📤 Поделиться ссылкой
            </button>
          </div>
          <div className="referral-code">
            Ваш код: <span>{partnerData.partner.referralCode}</span>
          </div>
        </div>

        {/* Промо-материалы */}
        <div className="promo-section">
          <h3>📢 Промо-материалы</h3>
          <div className="promo-text">
            <p>🎰 <strong>Greenlight Casino</strong> - лучшее крипто-казино в Telegram!</p>
            <ul>
              <li>💰 Бонусы новым игрокам</li>
              <li>🎮 Уникальные игры с RTP 95%</li>
              <li>💸 Моментальные выплаты в USDT</li>
              <li>🔥 Еженедельные турниры</li>
            </ul>
            <p>Приглашай друзей и получай <strong>{partnerData.stats.commissionPercent}%</strong> с их проигрышей!</p>
          </div>
          <button className="copy-promo-button" onClick={() => {
            navigator.clipboard.writeText(
              `🎰 Greenlight Casino - лучшее крипто-казино в Telegram!\n\n` +
              `💰 Бонусы новым игрокам\n` +
              `🎮 Уникальные игры с RTP 95%\n` +
              `💸 Моментальные выплаты в USDT\n` +
              `🔥 Еженедельные турниры\n\n` +
              `Регистрируйся по моей ссылке:\n` +
              `https://t.me/Greenlightgames_bot?start=${partnerData.partner.referralCode}`
            );
            showNotification('Промо-текст скопирован!');
          }}>
            📋 Копировать текст
          </button>
        </div>
      </div>
    );
  };

  // Рендер вкладок
  const renderTabs = () => (
    <div className="referral-tabs">
      <button 
        className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => handleTabChange('overview')}
      >
        📊 Обзор
      </button>
      <button 
        className={`tab-button ${activeTab === 'referrals' ? 'active' : ''}`}
        onClick={() => handleTabChange('referrals')}
      >
        👥 Рефералы
      </button>
      <button 
        className={`tab-button ${activeTab === 'earnings' ? 'active' : ''}`}
        onClick={() => handleTabChange('earnings')}
      >
        💰 Начисления
      </button>
    </div>
  );

  // Рендер контента вкладки
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'referrals':
        return <ReferralsList />;
      case 'earnings':
        return <EarningsHistory />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="referral-screen">
        <Header balance={balance} />
        {renderHeader()}
        <div className="referral-loading">
          <div className="loader"></div>
          <p>Загрузка данных партнера...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-screen">
      <Header balance={balance} />
      {renderHeader()}
      {renderTabs()}
      
      <div className="referral-content">
        {renderTabContent()}
      </div>

      {/* Модальное окно выплаты */}
      {showPayoutModal && partnerData && (
        <PayoutModal
          referralBalance={partnerData.stats.referralBalance}
          onConfirm={handleCreatePayout}
          onClose={() => setShowPayoutModal(false)}
        />
      )}
    </div>
  );
};

export default ReferralScreen;