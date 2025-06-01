// frontend/src/components/layout/Header.js
import React from 'react';
import '../../styles/Header.css';

const Header = ({ balance }) => {
  return (
    <div className="header">
      <div className="logo">
        Greenlight
      </div>
      <div className="balance">
        <span className="balance-label">Баланс:</span>
        <span className="balance-amount">{balance.toFixed(2)}</span>
        <span className="balance-currency">USDT</span>
      </div>
    </div>
  );
};

export default Header;
