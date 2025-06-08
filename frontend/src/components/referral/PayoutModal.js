// frontend/src/components/referral/PayoutModal.js
import React, { useState } from 'react';
import '../../styles/PayoutModal.css';

const PayoutModal = ({ referralBalance, onConfirm, onClose }) => {
  const [amount, setAmount] = useState('');
  const [useFullAmount, setUseFullAmount] = useState(false);

  const minAmount = 10;
  const maxAmount = referralBalance;

  const presetAmounts = [10, 50, 100, 500].filter(a => a <= maxAmount);

  const handleAmountChange = (value) => {
    const numValue = value.replace(/[^0-9.]/g, '');
    setAmount(numValue);
    setUseFullAmount(false);
  };

  const handlePresetClick = (presetAmount) => {
    setAmount(presetAmount.toString());
    setUseFullAmount(false);
  };

  const handleFullAmountToggle = () => {
    if (!useFullAmount) {
      setAmount(maxAmount.toFixed(2));
    }
    setUseFullAmount(!useFullAmount);
  };

  const handleConfirm = () => {
    const finalAmount = useFullAmount ? maxAmount : parseFloat(amount);

    if (isNaN(finalAmount) || finalAmount < minAmount || finalAmount > maxAmount) {
      return;
    }

    onConfirm(finalAmount);
  };

  const isValidAmount = () => {
    if (useFullAmount) return true;
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= minAmount && numAmount <= maxAmount;
  };

  return (
    <div className="payout-modal-overlay" onClick={onClose}>
      <div className="payout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payout-modal-header">
          <h2>💸 Вывод реферального баланса</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="payout-modal-body">
          <div className="balance-info">
            <span className="label">Доступно для вывода:</span>
            <span className="amount">{referralBalance.toFixed(2)} USDT</span>
          </div>

          <div className="amount-input-section">
            <label>Сумма вывода</label>
            <div className="amount-input-wrapper">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                disabled={useFullAmount}
              />
              <span className="currency">USDT</span>
            </div>
          </div>

          {/* Предустановленные суммы */}
          <div className="preset-amounts">
            {presetAmounts.map(preset => (
              <button
                key={preset}
                className={`preset-button ${amount === preset.toString() ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset)}
                disabled={useFullAmount}
              >
                {preset} USDT
              </button>
            ))}
          </div>

          {/* Чекбокс для вывода всей суммы */}
          <label className="full-amount-checkbox">
            <input
              type="checkbox"
              checked={useFullAmount}
              onChange={handleFullAmountToggle}
            />
            <span>Вывести весь баланс</span>
          </label>

          <div className="payout-info">
            <h4>ℹ️ Информация о выводе</h4>
            <ul>
              <li>Минимальная сумма: {minAmount} USDT</li>
              <li>Средства будут переведены на основной баланс</li>
              <li>Вывод происходит мгновенно</li>
              <li>Комиссия отсутствует</li>
            </ul>
          </div>

          {!isValidAmount() && amount && (
            <div className="error-message">
              {parseFloat(amount) < minAmount 
                ? `Минимальная сумма вывода: ${minAmount} USDT`
                : `Недостаточно средств. Максимум: ${maxAmount.toFixed(2)} USDT`
              }
            </div>
          )}
        </div>

        <div className="payout-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Отмена
          </button>
          <button 
            className="confirm-button"
            onClick={handleConfirm}
            disabled={!isValidAmount()}
          >
            Вывести {useFullAmount ? maxAmount.toFixed(2) : amount} USDT
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayoutModal;