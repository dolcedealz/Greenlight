// frontend/src/components/profile/Deposits.js
import React, { useState, useEffect } from 'react';
import { paymentApi } from '../../services/api';
import { showNotification } from '../../utils/telegram';
import '../../styles/Deposits.css';

const Deposits = ({ balance, onBalanceUpdate }) => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Предустановленные суммы
  const presetAmounts = [10, 20, 50, 100, 500, 1000];

  // Загрузка истории депозитов
  useEffect(() => {
    fetchDepositHistory();
  }, []);

  const fetchDepositHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await paymentApi.getUserDeposits({ limit: 5 });
      setDeposits(response.data.data.deposits || []);
    } catch (error) {

    } finally {
      setLoadingHistory(false);
    }
  };

  // Создание депозита
  const handleCreateDeposit = async () => {
    const amount = parseFloat(depositAmount);

    if (isNaN(amount) || amount <= 0) {
      showNotification('Введите корректную сумму');
      return;
    }

    if (amount < 1) {
      showNotification('Минимальная сумма: 1 USDT');
      return;
    }

    if (amount > 10000) {
      showNotification('Максимальная сумма: 10000 USDT');
      return;
    }

    try {
      setLoading(true);

      const response = await paymentApi.createDeposit({
        amount,
        description: `Пополнение баланса на ${amount} USDT`
      });

      const depositData = response.data.data;

      // Открываем ссылку для оплаты
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.openLink(depositData.payUrl);
      } else {
        window.open(depositData.payUrl, '_blank');
      }

      showNotification('Счет создан! Перенаправляем на оплату...');

      // Закрываем модальное окно
      setShowDepositModal(false);
      setDepositAmount('');

      // Обновляем историю
      fetchDepositHistory();

      // Начинаем проверку статуса
      startStatusPolling(depositData.depositId);

    } catch (error) {

      showNotification(error.response?.data?.message || 'Ошибка создания депозита');
    } finally {
      setLoading(false);
    }
  };

  // Проверка статуса депозита
  const startStatusPolling = (depositId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 минут максимум

    const checkStatus = async () => {
      try {
        const response = await paymentApi.checkDepositStatus(depositId);
        const status = response.data.data;

        if (status.isPaid) {
          showNotification('✅ Депозит успешно зачислен!');

          // Обновляем баланс
          if (onBalanceUpdate) {
            const newBalance = await onBalanceUpdate();
            showNotification(`Новый баланс: ${newBalance.toFixed(2)} USDT`);
          }

          // Обновляем историю
          fetchDepositHistory();
          return;
        }

        if (status.isExpired) {
          showNotification('⏰ Срок действия счета истек');
          fetchDepositHistory();
          return;
        }

        // Продолжаем проверку
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000); // Проверяем каждые 5 секунд
        }
      } catch (error) {

      }
    };

    // Начинаем проверку через 5 секунд
    setTimeout(checkStatus, 5000);
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

  // Получение иконки статуса
  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return '✅';
      case 'pending': return '⏳';
      case 'expired': return '⏰';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  // Получение названия статуса
  const getStatusName = (status) => {
    switch (status) {
      case 'paid': return 'Оплачен';
      case 'pending': return 'Ожидает оплаты';
      case 'expired': return 'Истек';
      case 'failed': return 'Ошибка';
      default: return status;
    }
  };

  return (
    <div className="deposits-section">
      <div className="deposits-header">
        <h3>💰 Пополнение баланса</h3>
        <button 
          className="deposit-button"
          onClick={() => setShowDepositModal(true)}
        >
          Пополнить
        </button>
      </div>

      {/* История последних депозитов */}
      <div className="deposits-history">
        <h4>Последние пополнения</h4>
        {loadingHistory ? (
          <div className="deposits-loading">
            <div className="loader"></div>
          </div>
        ) : deposits.length === 0 ? (
          <div className="no-deposits">
            <p>У вас пока нет пополнений</p>
          </div>
        ) : (
          <div className="deposits-list">
            {deposits.map(deposit => (
              <div key={deposit._id} className="deposit-item">
                <div className="deposit-icon">
                  {getStatusIcon(deposit.status)}
                </div>
                <div className="deposit-details">
                  <div className="deposit-header">
                    <span className="deposit-amount">{deposit.amount} USDT</span>
                    <span className="deposit-status">{getStatusName(deposit.status)}</span>
                  </div>
                  <div className="deposit-date">{formatDate(deposit.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для создания депозита */}
      {showDepositModal && (
        <div className="deposit-modal">
          <div className="deposit-modal-content">
            <div className="deposit-modal-header">
              <h3>Пополнение баланса</h3>
              <button 
                className="close-button"
                onClick={() => setShowDepositModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="deposit-modal-body">
              <div className="deposit-input-group">
                <label>Сумма пополнения (USDT)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Введите сумму"
                  min="1"
                  max="10000"
                  step="0.01"
                />
              </div>

              <div className="preset-amounts">
                {presetAmounts.map(amount => (
                  <button
                    key={amount}
                    className="preset-amount-button"
                    onClick={() => setDepositAmount(amount.toString())}
                  >
                    {amount} USDT
                  </button>
                ))}
              </div>

              <div className="deposit-info">
                <p>💡 Минимальная сумма: 1 USDT</p>
                <p>💡 Максимальная сумма: 10,000 USDT</p>
                <p>💡 Пополнение через @CryptoBot</p>
              </div>
            </div>

            <div className="deposit-modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowDepositModal(false)}
              >
                Отмена
              </button>
              <button
                className="confirm-button"
                onClick={handleCreateDeposit}
                disabled={loading || !depositAmount}
              >
                {loading ? 'Создание...' : 'Создать счет'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deposits;