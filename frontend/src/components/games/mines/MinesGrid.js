// frontend/src/components/games/mines/MinesGrid.js
import React, { useEffect } from 'react';
import '../../../styles/MinesGrid.css';

const MinesGrid = ({ grid, revealed, onCellClick, gameActive, gameOver }) => {
  // Add debug logging for props changes
  useEffect(() => {
    console.log("MinesGrid received props - gameActive:", gameActive, "gameOver:", gameOver);
  }, [gameActive, gameOver]);

  const handleCellClick = (rowIndex, colIndex) => {
    console.log(`MinesGrid: click on cell [${rowIndex},${colIndex}], gameActive=${gameActive}, gameOver=${gameOver}`);
    
    // Only process clicks when game is active and not over
    if (!gameActive || gameOver) {
      console.log("MinesGrid: ignoring click - game not active or is over");
      return;
    }
    
    const index = rowIndex * 5 + colIndex;
    if (revealed[index]) {
      console.log("MinesGrid: cell already revealed");
      return;
    }
    
    // Call parent handler
    onCellClick(rowIndex, colIndex);
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

export default React.memo(MinesGrid); // Use React.memo to prevent unnecessary re-renders