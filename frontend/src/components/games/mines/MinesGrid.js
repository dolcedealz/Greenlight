import React from 'react';
import useTactileFeedback from '../../../hooks/useTactileFeedback';
import '../../../styles/MinesGrid.css';

const MinesGrid = ({ grid, clickedCells = [], onCellClick, gameActive, gameOver, loading }) => {
  const { gameActionFeedback } = useTactileFeedback();

  // Обработчик клика по ячейке
  const handleCellClick = (rowIndex, colIndex) => {
    // Блокируем клики если:
    // - игра не активна
    // - игра завершена
    // - идет загрузка
    // - ячейка уже открыта
    
    // Проверяем, открыта ли ячейка через массив координат
    const alreadyClicked = clickedCells.some(cell => 
      cell[0] === rowIndex && cell[1] === colIndex
    );
    
    if (!gameActive || gameOver || loading || alreadyClicked) {
      return;
    }
    
    // Вибрация при клике по ячейке
    gameActionFeedback();
    
    // Вызываем обработчик из родительского компонента
    onCellClick(rowIndex, colIndex);
  };

  return (
    <div className={`mines-grid ${gameOver ? 'game-over' : ''}`}>
      {loading && <div className="mines-overlay"><div className="mines-spinner"></div></div>}
      
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} className="mines-row">
          {row.map((cell, colIndex) => {
            // Проверяем, находится ли ячейка в списке открытых
            const isRevealed = clickedCells.some(coords => 
              coords[0] === rowIndex && coords[1] === colIndex
            );
            
            const cellClass = `mines-cell 
              ${isRevealed ? 'revealed' : ''} 
              ${isRevealed && cell === 'mine' ? 'mine' : ''} 
              ${isRevealed && cell === 'gem' ? 'gem' : ''}
              ${!gameActive && !isRevealed ? 'disabled' : ''}
            `;
            
            return (
              <div
                key={colIndex}
                className={cellClass}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {isRevealed && cell === 'mine' && <span className="mine-icon">💣</span>}
                {isRevealed && cell === 'gem' && <span className="gem-icon">💎</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default React.memo(MinesGrid);
