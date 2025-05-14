// MinesGrid.js
import React from 'react';
import '../../../styles/MinesGrid.css';

const MinesGrid = ({ grid, revealed, onCellClick, gameActive, gameOver, loading }) => {
  // Обработчик клика по ячейке
  const handleCellClick = (rowIndex, colIndex) => {
    // Блокируем клики если:
    // - игра не активна
    // - игра завершена
    // - идет загрузка
    // - ячейка уже открыта
    const index = rowIndex * 5 + colIndex;
    if (!gameActive || gameOver || loading || revealed[index]) {
      return;
    }
    
    // Вызываем обработчик из родительского компонента
    onCellClick(rowIndex, colIndex);
  };

  return (
    <div className={`mines-grid ${gameOver ? 'game-over' : ''}`}>
      {loading && <div className="mines-overlay"><div className="mines-spinner"></div></div>}
      
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="mines-row">
          {row.map((cell, colIndex) => {
            const index = rowIndex * 5 + colIndex;
            const isRevealed = revealed[index];
            
            return (
              <div
                key={colIndex}
                className={`mines-cell 
                  ${isRevealed ? 'revealed' : ''} 
                  ${isRevealed && cell === 'mine' ? 'mine' : ''} 
                  ${isRevealed && cell !== 'mine' ? 'gem' : ''}
                  ${!gameActive && !isRevealed ? 'disabled' : ''}
                `}
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

export default React.memo(MinesGrid);