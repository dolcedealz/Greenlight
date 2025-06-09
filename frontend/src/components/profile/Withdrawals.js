// frontend/src/components/profile/Withdrawals.js
import React, { useState, useEffect } from 'react';
import { paymentApi } from '../../services/api';
import { showNotification, showConfirmation } from '../../utils/telegram';
import '../../styles/Withdrawals.css';

const Withdrawals = ({ balance, onBalanceUpdate }) => {
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState('username');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Предустановленные суммы
  const presetAmounts = [10, 20, 50, 100, 500, 1000];

  // Загрузка истории выводов
  useEffect(() => {
    fetchWithdrawalHistory();
  }, []);

  const fetchWithdrawalHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await paymentApi.getUserWithdrawals({ limit: 5 });
      setWithdrawals(response.data.data.withdrawals || []);
    } catch (error) {

    } finally {
      setLoadingHistory(false);
    }
  };

  // Валидация username
  const validateUsername = (username) => {
    return /^[a-zA-Z0-9_]{5,32}$/.test(username);
  };

  // Создание запроса на вывод
  const handleCreateWithdrawal = async () => {
    const amount = parseFloat(withdrawalAmount);

    // Валидация суммы
    if (isNaN(amount) || amount <= 0) {
      showNotification('Введите корректную сумму');
      return;
    }

    if (amount < 1) {
      showNotification('Минимальная сумма вывода: 1 USDT');
      return;
    }

    if (amount > 10000) {
      showNotification('Максимальная сумма вывода: 10000 USDT');
      return;
    }

    if (amount > balance) {
      showNotification(`Недостаточно средств. Ваш баланс: ${balance.toFixed(2)} USDT`);
      return;
    }

    // Валидация получателя
    if (!recipient.trim()) {
      showNotification('Введите получателя');
      return;
    }

    if (recipientType === 'username' && !validateUsername(recipient)) {
      showNotification('Некорректный username. Используйте только буквы, цифры и _ (5-32 символа)');
      return;
    }

    // Подтверждение операции
    const netAmount = (amount * 0.97).toFixed(2);
    showConfirmation(
      `Подтвердите вывод:\n\nСумма к списанию: ${amount} USDT\nКомиссия CryptoBot: ${(amount * 0.03).toFixed(2)} USDT (3%)\nВы получите: ${netAmount} USDT\nПолучатель: @${recipient}\n${amount > 300 ? '⚠️ Требует одобрения администратора' : '⚡ Автоматическая обработка'}`,
      async () => {
        try {
          setLoading(true);

          const response = await paymentApi.createWithdrawal({
            amount,
            recipient: recipient.replace('@', ''),
            recipientType,
            comment: comment || undefined
          });

          const withdrawalData = response.data.data;

          showNotification(
            withdrawalData.requiresApproval 
              ? `✅ Запрос на вывод создан!\nТребуется одобрение администратора.\nВремя обработки: 24-48 часов`
              : `✅ Запрос на вывод создан!\nОжидайте поступления средств в течение 5-15 минут`
          );

          // Закрываем модальное окно
          setShowWithdrawalModal(false);
          resetForm();

          // Обновляем историю
          fetchWithdrawalHistory();

          // Обновляем баланс
          if (onBalanceUpdate) {
            onBalanceUpdate();
          }

          // Начинаем проверку статуса для автоматических выводов
          if (!withdrawalData.requiresApproval) {
            startStatusPolling(withdrawalData.withdrawalId);
          }

        } catch (error) {

          showNotification(error.response?.data?.message || 'Ошибка создания запроса на вывод');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Проверка статуса вывода
  const startStatusPolling = (withdrawalId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 минут максимум

    const checkStatus = async () => {
      try {
        const response = await paymentApi.checkWithdrawalStatus(withdrawalId);
        const status = response.data.data;

        if (status.isCompleted) {
          showNotification('✅ Вывод успешно выполнен!');
          fetchWithdrawalHistory();
          return;
        }

        if (status.isRejected) {
          showNotification(`❌ Вывод отклонен: ${status.rejectionReason || 'без указания причины'}`);

          // Обновляем баланс (средства возвращены)
          if (onBalanceUpdate) {
            onBalanceUpdate();
          }

          fetchWithdrawalHistory();
          return;
        }

        if (status.isFailed) {
          showNotification('❌ Ошибка при обработке вывода. Средства возвращены на баланс.');

          // Обновляем баланс
          if (onBalanceUpdate) {
            onBalanceUpdate();
          }

          fetchWithdrawalHistory();
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

  // Сброс формы
  const resetForm = () => {
    setWithdrawalAmount('');
    setRecipient('');
    setComment('');
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
      case 'completed': return '✅';
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'processing': return '⚙️';
      case 'rejected': return '❌';
      case 'failed': return '⚠️';
      default: return '❓';
    }
  };

  // Получение названия статуса
  const getStatusName = (status) => {
    switch (status) {
      case 'completed': return 'Выполнен';
      case 'pending': return 'Ожидает';
      case 'approved': return 'Одобрен';
      case 'processing': return 'Обрабатывается';
      case 'rejected': return 'Отклонен';
      case 'failed': return 'Ошибка';
      default: return status;
    }
  };

  // Отмена запроса на вывод
  const handleCancelWithdrawal = async (withdrawalId) => {
    showConfirmation(
      'Вы уверены, что хотите отменить этот запрос на вывод?',
      async () => {
        try {
          await paymentApi.cancelWithdrawal(withdrawalId);
          showNotification('Запрос на вывод отменен. Средства возвращены на баланс.');

          // Обновляем историю и баланс
          fetchWithdrawalHistory();
          if (onBalanceUpdate) {
            onBalanceUpdate();
          }
        } catch (error) {

          showNotification(error.response?.data?.message || 'Не удалось отменить вывод');
        }
      }
    );
  };

  return (
    <div className="withdrawals-section">
      <div className="withdrawals-header">
        <h3>💸 Вывод средств</h3>
        <button 
          className="withdrawal-button"
          onClick={() => setShowWithdrawalModal(true)}
          disabled={balance < 1}
        >
          Вывести
        </button>
      </div>

      {balance < 1 && (
        <div className="withdrawal-warning">
          Минимальная сумма для вывода: 1 USDT
        </div>
      )}

      {/* История последних выводов */}
      <div className="withdrawals-history">
        <h4>Последние выводы</h4>
        {loadingHistory ? (
          <div className="withdrawals-loading">
            <div className="loader"></div>
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="no-withdrawals">
            <p>У вас пока нет выводов</p>
          </div>
        ) : (
          <div className="withdrawals-list">
            {withdrawals.map(withdrawal => (
              <div key={withdrawal.id} className="withdrawal-item">
                <div className="withdrawal-icon">
                  {getStatusIcon(withdrawal.status)}
                </div>
                <div className="withdrawal-details">
                  <div className="withdrawal-header">
                    <span className="withdrawal-amount">{withdrawal.amount} USDT</span>
                    <span className="withdrawal-status">{getStatusName(withdrawal.status)}</span>
                  </div>
                  <div className="withdrawal-info">
                    <span className="withdrawal-recipient">@{withdrawal.recipient}</span>
                    <span className="withdrawal-date">{formatDate(withdrawal.createdAt)}</span>
                  </div>
                  {withdrawal.rejectionReason && (
                    <div className="withdrawal-rejection">
                      Причина отклонения: {withdrawal.rejectionReason}
                    </div>
                  )}
                  {withdrawal.status === 'pending' && !withdrawal.requiresApproval && (
                    <button 
                      className="cancel-withdrawal-button"
                      onClick={() => handleCancelWithdrawal(withdrawal.id)}
                    >
                      Отменить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно для создания вывода */}
      {showWithdrawalModal && (
        <div className="withdrawal-modal">
          <div className="withdrawal-modal-content">
            <div className="withdrawal-modal-header">
              <h3>Вывод средств</h3>
              <button 
                className="close-button"
                onClick={() => setShowWithdrawalModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="withdrawal-modal-body">
              <div className="withdrawal-balance-info">
                <span>Доступно для вывода:</span>
                <span className="balance-amount">{balance.toFixed(2)} USDT</span>
              </div>

              <div className="withdrawal-input-group">
                <label>Сумма вывода (USDT)</label>
                <input
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="Введите сумму"
                  min="1"
                  max={Math.min(10000, balance)}
                  step="0.01"
                />
              </div>

              {/* НОВОЕ: Показ расчета комиссии */}
              {withdrawalAmount && !isNaN(parseFloat(withdrawalAmount)) && parseFloat(withdrawalAmount) > 0 && (
                <div className="commission-breakdown">
                  <div className="breakdown-item">
                    <span>Сумма к списанию:</span>
                    <span>{parseFloat(withdrawalAmount).toFixed(2)} USDT</span>
                  </div>
                  <div className="breakdown-item commission">
                    <span>Комиссия CryptoBot (3%):</span>
                    <span>-{(parseFloat(withdrawalAmount) * 0.03).toFixed(2)} USDT</span>
                  </div>
                  <div className="breakdown-item total">
                    <span><strong>Вы получите:</strong></span>
                    <span><strong>{(parseFloat(withdrawalAmount) * 0.97).toFixed(2)} USDT</strong></span>
                  </div>
                </div>
              )}

              <div className="preset-amounts">
                {presetAmounts.map(amount => (
                  <button
                    key={amount}
                    className="preset-amount-button"
                    onClick={() => setWithdrawalAmount(amount.toString())}
                    disabled={amount > balance}
                  >
                    {amount} USDT
                    <small>получите {(amount * 0.97).toFixed(2)}</small>
                  </button>
                ))}
              </div>

              <div className="withdrawal-input-group">
                <label>Telegram username получателя</label>
                <div className="input-with-prefix">
                  <span className="input-prefix">@</span>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value.replace('@', ''))}
                    placeholder="username"
                    maxLength="32"
                  />
                </div>
                <small className="input-hint">
                  Получатель должен быть зарегистрирован в @CryptoBot
                </small>
              </div>

              <div className="withdrawal-input-group">
                <label>Комментарий (необязательно)</label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Комментарий к выводу"
                  maxLength="100"
                />
              </div>

              <div className="withdrawal-info">
                <p>💡 Минимальная сумма: 1 USDT</p>
                <p>💡 Максимальная сумма: 10,000 USDT</p>
                <p>⚡ До 300 USDT - автоматически (5-15 мин)</p>
                <p>⏳ Свыше 300 USDT - требует одобрения (24-48 ч)</p>
                <p>ℹ️ Комиссия платежной системы: 3%</p>
              </div>
            </div>

            <div className="withdrawal-modal-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowWithdrawalModal(false);
                  resetForm();
                }}
              >
                Отмена
              </button>
              <button
                className="confirm-button"
                onClick={handleCreateWithdrawal}
                disabled={loading || !withdrawalAmount || !recipient}
              >
                {loading ? 'Создание...' : 'Создать запрос'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdrawals;