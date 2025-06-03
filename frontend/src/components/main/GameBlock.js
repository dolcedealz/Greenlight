// frontend/src/components/main/GameBlock.js - С ПОДДЕРЖКОЙ АНИМАЦИИ
import React, { useEffect, useRef } from 'react';
import '../../styles/GameBlock.css';

const GameBlock = ({ name, icon, onClick, gameType }) => {
  const blockRef = useRef(null);

  useEffect(() => {
    const block = blockRef.current;
    if (block) {
      // Небольшая задержка для инициализации
      const timer = setTimeout(() => {
        block.classList.add('animate-in');
      }, 50);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div 
      ref={blockRef}
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
