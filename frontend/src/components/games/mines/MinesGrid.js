// frontend/src/components/games/mines/MinesGrid.js
import React from 'react';
import '../../../styles/MinesGrid.css';

const MinesGrid = ({ grid, revealed, onCellClick, gameActive, gameOver }) => {
  // Получение класса и содержимого ячейки
  const getCellContent = (cell, isRevealed) => {
    if (!isRevealed) {
      return null;
    }
    
    if (cell === 'mine') {
      return <span className="mine-icon">💣</span>;
    } else {
      return <span className="gem-icon">💎</span>;
    }
  };
  
  // Определение класса ячейки
  const getCellClass = (cell, isRevealed) => {
    let cellClass = 'mines-cell';
    
    if (isRevealed) {
      cellClass += ' revealed';
      if (cell === 'mine') {
        cellClass += ' mine';
      } else {
        cellClass += ' gem';
      }
    } else if (!gameActive) {
      cellClass += ' disabled';
    }
    
    return cellClass;
  };
  
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
                className={getCellClass(cell, isRevealed)}
                onClick={() => {
                  if (gameActive && !isRevealed) {
                    onCellClick(rowIndex, colIndex);
                  }
                }}
              >
                {getCellContent(cell, isRevealed)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MinesGrid;