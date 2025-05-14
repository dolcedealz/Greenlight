// frontend/src/components/games/mines/MinesGrid.js
import React from 'react';
import '../../../styles/MinesGrid.css';

// frontend/src/components/games/mines/MinesGrid.js
const MinesGrid = ({ grid, revealed, onCellClick, gameActive, gameOver }) => {
  return (
    <div className={`mines-grid ${gameOver ? 'game-over' : ''}`}>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="mines-row">
          {row.map((cell, colIndex) => {
            const index = rowIndex * 5 + colIndex;
            const isRevealed = revealed[index];
            
            return (
              <div
                key={colIndex}
                className={`mines-cell ${isRevealed ? 'revealed' : ''} ${isRevealed && cell === 'mine' ? 'mine' : ''} ${isRevealed && cell !== 'mine' ? 'gem' : ''} ${!gameActive && !isRevealed ? 'disabled' : ''}`}
                onClick={() => {
                  if (gameActive && !isRevealed) {
                    console.log(`Клик на ячейке [${rowIndex}, ${colIndex}]`);
                    onCellClick(rowIndex, colIndex);
                  }
                }}
              >
                {isRevealed && cell === 'mine' && <span className="mine-icon">💣</span>}
                {isRevealed && cell !== 'mine' && <span className="gem-icon">💎</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MinesGrid;