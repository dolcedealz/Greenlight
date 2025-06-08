import React, { useState, useEffect } from 'react';
import { getUserPromoCodes } from '../../services/api';
import { Loader } from '../common';
import './UserPromoCodes.css';

const UserPromoCodes = () => {
  const [promocodes, setPromocodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserPromocodes();
  }, []);

  const loadUserPromocodes = async () => {
    try {
      setIsLoading(true);
      setError('');

      const result = await getUserPromoCodes();

      if (result.success) {
        setPromocodes(result.data.promocodes);
      } else {
        setError(result.message || 'Ошибка загрузки промокодов');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при загрузке');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      'balance': '💰',
      'freespins': '🎮',
      'deposit': '📈',
      'vip': '🏆'
    };
    return icons[type] || '🎁';
  };

  const getTypeDisplayName = (type) => {
    const names = {
      'balance': 'Бонус на баланс',
      'freespins': 'Бесплатные игры',
      'deposit': 'Бонус к депозиту',
      'vip': 'VIP статус'
    };
    return names[type] || 'Бонус';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Только что';
    } else if (diffHours < 24) {
      return `${diffHours} ч. назад`;
    } else if (diffDays < 7) {
      return `${diffDays} дн. назад`;
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="user-promocodes loading">
        <Loader />
        <p>Загрузка промокодов...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-promocodes error">
        <div className="error-message">
          <span className="error-icon">❌</span>
          <p>{error}</p>
          <button onClick={loadUserPromocodes} className="retry-button">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (promocodes.length === 0) {
    return (
      <div className="user-promocodes empty">
        <div className="empty-state">
          <span className="empty-icon">🎁</span>
          <h3>Нет активированных промокодов</h3>
          <p>Вы пока не активировали ни одного промокода. Введите промокод выше, чтобы получить бонусы!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-promocodes">
      <div className="promocodes-header">
        <h3>Мои промокоды ({promocodes.length})</h3>
        <button onClick={loadUserPromocodes} className="refresh-button">
          🔄
        </button>
      </div>

      <div className="promocodes-list">
        {promocodes.map((promo, index) => (
          <div key={index} className="promocode-item">
            <div className="promocode-main">
              <div className="promocode-icon">
                {getTypeIcon(promo.type)}
              </div>

              <div className="promocode-info">
                <div className="promocode-code">{promo.code}</div>
                <div className="promocode-type">{getTypeDisplayName(promo.type)}</div>
                {promo.description && (
                  <div className="promocode-description">{promo.description}</div>
                )}
              </div>

              <div className="promocode-status">
                <span className="status-badge activated">
                  ✅ Активирован
                </span>
                <div className="activation-date">
                  {formatDate(promo.activatedAt)}
                </div>
              </div>
            </div>

            {promo.transactionId && (
              <div className="promocode-details">
                <small className="transaction-id">
                  ID транзакции: {promo.transactionId}
                </small>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="promocodes-footer">
        <p className="info-text">
          💡 Промокоды применяются автоматически после активации
        </p>
      </div>
    </div>
  );
};

export default UserPromoCodes;