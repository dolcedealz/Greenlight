import React, { useState } from 'react';
import { Button, Input, Modal } from '../common';
import { activatePromoCode, validatePromoCode } from '../../services/api';
import './PromoCodeInput.css';

const PromoCodeInput = ({ onActivation }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleCodeChange = async (value) => {
    const upperCode = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(upperCode);
    setError('');

    // Валидация в реальном времени при достижении минимальной длины
    if (upperCode.length >= 3) {
      try {
        const result = await validatePromoCode(upperCode);
        if (result.success) {
          setValidation(result.data);
        } else {
          setValidation(null);
        }
      } catch (err) {
        setValidation(null);
      }
    } else {
      setValidation(null);
    }
  };

  const handleActivate = async () => {
    if (!code || code.length < 3) {
      setError('Введите промокод (минимум 3 символа)');
      return;
    }

    // Если есть валидация, показываем подтверждение
    if (validation && validation.canUse) {
      setShowConfirmModal(true);
      return;
    }

    await executeActivation();
  };

  const executeActivation = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await activatePromoCode(code);

      if (result.success) {
        // Уведомляем родительский компонент об успешной активации
        if (onActivation) {
          onActivation(result.data);
        }

        // Показываем успешное сообщение
        showSuccessMessage(result.data);

        // Очищаем форму
        setCode('');
        setValidation(null);
      } else {
        setError(result.message || 'Ошибка активации промокода');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Произошла ошибка при активации');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  const showSuccessMessage = (data) => {
    const { reward, promocode } = data;
    let message = `🎉 Промокод "${promocode.code}" успешно активирован!\n\n`;

    switch (reward.type) {
      case 'balance':
        message += `💰 Получен бонус: ${reward.amount} ${reward.currency}`;
        break;
      case 'freespins':
        message += `🎮 Получено фриспинов: ${reward.count} в игре ${reward.game}`;
        break;
      case 'deposit_bonus':
        message += `📈 Бонус к депозиту: ${reward.percentage}%`;
        if (reward.maxBonus) {
          message += ` (макс. ${reward.maxBonus} USDT)`;
        }
        break;
      case 'vip':
        message += `🏆 VIP статус продлен на ${reward.days} дней`;
        break;
      default:
        message += '🎁 Бонус получен!';
    }

    // Используем встроенный alert или кастомное уведомление
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert(message);
    } else {
      alert(message);
    }
  };

  const getValidationStatus = () => {
    if (!validation) return null;

    if (validation.canUse) {
      return {
        type: 'success',
        message: `✅ ${getRewardDescription(validation.rewardPreview)}`
      };
    } else {
      return {
        type: 'error',
        message: `❌ ${validation.reason}`
      };
    }
  };

  const getRewardDescription = (reward) => {
    if (!reward) return 'Промокод готов к использованию';

    switch (reward.type) {
      case 'balance':
        return `Бонус ${reward.amount} ${reward.currency}`;
      case 'freespins':
        return `${reward.count} фриспинов в ${reward.game}`;
      case 'deposit_bonus':
        return `Бонус ${reward.percentage}% к депозиту`;
      case 'vip':
        return `VIP статус на ${reward.days} дней`;
      default:
        return 'Специальный бонус';
    }
  };

  const validationStatus = getValidationStatus();

  return (
    <div className="promo-code-input">
      <div className="input-section">
        <Input
          type="text"
          value={code}
          onChange={handleCodeChange}
          placeholder="Введите промокод"
          maxLength={20}
          disabled={isLoading}
          className={`promo-input ${
            validationStatus?.type === 'success' ? 'success' : 
            validationStatus?.type === 'error' ? 'error' : ''
          }`}
        />

        <Button
          onClick={handleActivate}
          disabled={isLoading || !code || code.length < 3}
          loading={isLoading}
          className="activate-button"
        >
          {isLoading ? 'Активация...' : 'Активировать'}
        </Button>
      </div>

      {validationStatus && (
        <div className={`validation-message ${validationStatus.type}`}>
          {validationStatus.message}
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Модальное окно подтверждения */}
      {showConfirmModal && validation && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Подтверждение активации"
        >
          <div className="confirmation-content">
            <p><strong>Промокод:</strong> {code}</p>
            <p><strong>Тип:</strong> {validation.type}</p>
            {validation.description && (
              <p><strong>Описание:</strong> {validation.description}</p>
            )}
            <p><strong>Награда:</strong> {getRewardDescription(validation.rewardPreview)}</p>

            <div className="confirmation-actions">
              <Button
                onClick={executeActivation}
                loading={isLoading}
                className="confirm-button"
              >
                Подтвердить активацию
              </Button>
              <Button
                onClick={() => setShowConfirmModal(false)}
                variant="secondary"
                disabled={isLoading}
              >
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PromoCodeInput;