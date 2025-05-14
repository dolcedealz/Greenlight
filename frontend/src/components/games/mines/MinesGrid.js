// frontend/src/components/games/mines/MinesGrid.js
import React from 'react';
import '../../../styles/MinesGrid.css';

/// frontend/src/components/games/mines/MinesGrid.js
const MinesGrid = ({ grid, revealed, onCellClick, gameActive, gameOver }) => {
  // Добавляем отладочную информацию
  console.log("Рендер MinesGrid, gameActive:", gameActive);
  
  const handleCellClick = (rowIndex, colIndex) => {
    console.log(`MinesGrid: клик на ячейке [${rowIndex}, ${colIndex}], gameActive: ${gameActive}`);
    
    // Если игра активна и ячейка не открыта, вызываем обработчик
    const index = rowIndex * 5 + colIndex;
    if (gameActive && !revealed[index]) {
      onCellClick(rowIndex, colIndex);
    } else {
      console.log(`MinesGrid: клик игнорирован, gameActive: ${gameActive}, revealed: ${revealed[index]}`);
    }
  };

  return (
    <div className={`mines-grid ${gameOver ? 'game-over' : ''}`}>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="mines-row">
          {row.map((cell, colIndex) => {
            const index = rowIndex * 5 + colIndex;
            const isRevealed = revealed[index];
            
            // Обновляем обработчик клика для дополнительного логирования
            return (
              <div
                key={colIndex}
                className={`mines-cell ${isRevealed ? 'revealed' : ''} ${isRevealed && cell === 'mine' ? 'mine' : ''} ${isRevealed && cell !== 'mine' ? 'gem' : ''}`}
                onClick={() => handleCellClick(rowIndex, colIndex)}
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