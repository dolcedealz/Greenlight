// GameBlock.js
import React from 'react';
import '../../styles/GameBlock.css';

const GameBlock = ({ name, icon, onClick }) => {
  return (
    <div className="game-block" onClick={onClick}>
      <div className="game-icon">{icon}</div>
      <div className="game-name">{name}</div>
    </div>
  );
};

export default GameBlock;