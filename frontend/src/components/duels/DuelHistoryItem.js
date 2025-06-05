// frontend/src/components/duels/DuelHistoryItem.js
import React from 'react';

const DuelHistoryItem = ({ duel, currentUserId }) => {
  if (!duel) return null;

  // Определяем, выиграл ли текущий пользователь
  const isWinner = duel.winnerId === currentUserId;
  const isChallenger = duel.challengerId === currentUserId;
  
  // Определяем оппонента
  const opponentUsername = isChallenger ? duel.opponentUsername : duel.challengerUsername;
  
  // Определяем результат
  const profit = isWinner ? (duel.winAmount || 0) : -(duel.amount || 0);
  
  // Игры и их эмодзи
  const gameEmojis = {
    '🎲': 'Кости',
    '🎯': 'Дартс', 
    '⚽': 'Футбол',
    '🏀': 'Баскетбол',
    '🎳': 'Боулинг',
    '🎰': 'Слоты'
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = () => {
    if (duel.status === 'completed') {
      return isWinner ? '🏆' : '😔';
    }
    return '⏳';
  };

  const getStatusText = () => {
    switch (duel.status) {
      case 'completed':
        return isWinner ? 'Победа' : 'Поражение';
      case 'active':
        return 'В процессе';
      case 'pending':
        return 'Ожидание';
      case 'cancelled':
        return 'Отменена';
      default:
        return duel.status;
    }
  };

  return (
    <div className="duel-history-item">
      <div className="duel-main-info">
        <div className="duel-game">
          <span className="game-emoji">{duel.gameType}</span>
          <span className="game-name">{gameEmojis[duel.gameType] || 'Дуэль'}</span>
        </div>
        
        <div className="duel-opponent">
          <span className="vs-text">vs</span>
          <span className="opponent-name">@{opponentUsername}</span>
        </div>
        
        <div className="duel-result">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{getStatusText()}</span>
        </div>
      </div>
      
      <div className="duel-details">
        <div className="duel-score">
          Счет: {duel.challengerScore || 0}-{duel.opponentScore || 0}
        </div>
        
        <div className="duel-amount">
          <span className={`profit ${profit >= 0 ? 'positive' : 'negative'}`}>
            {profit >= 0 ? '+' : ''}{profit} USDT
          </span>
        </div>
        
        <div className="duel-format">
          {duel.format?.toUpperCase() || 'Bo1'}
        </div>
      </div>
      
      <div className="duel-meta">
        <span className="duel-date">{formatDate(duel.completedAt || duel.createdAt)}</span>
        <span className="duel-id">#{duel.sessionId?.slice(-6) || duel.id?.slice(-6)}</span>
      </div>
    </div>
  );
};

export default DuelHistoryItem;