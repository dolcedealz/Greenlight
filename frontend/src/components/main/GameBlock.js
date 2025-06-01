// frontend/src/components/main/GameBlock.js
import React from 'react';
import useTactileFeedback from '../../hooks/useTactileFeedback';
import '../../styles/GameBlock.css';

const GameBlock = ({ name, icon, onClick }) => {
  const { buttonPressFeedback } = useTactileFeedback();

  const handleClick = () => {
    buttonPressFeedback(); // Тактильная обратная связь
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className="game-block" onClick={handleClick}>
      <div className="game-icon">{icon}</div>
      <div className="game-name">{name}</div>
    </div>
  );
};

export default GameBlock;
