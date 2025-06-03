// frontend/src/components/main/GameBlock.js - ОБНОВЛЕННАЯ ВЕРСИЯ
import React from 'react';
import '../../styles/GameBlock.css';

const GameBlock = ({ name, icon, onClick, gameType }) => {
  return (
    <div 
      className="game-block" 
      onClick={onClick}
      data-game={gameType}
    >
      <div className="game-icon">{icon}</div>
      <div className="game-name">{name}</div>
    </div>
  );
};

export default GameBlock;
