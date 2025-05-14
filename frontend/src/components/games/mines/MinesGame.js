// MinesGame.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MinesGrid } from './index';
import { MinesControls } from './index';
import { gameApi } from '../../../services';

const MinesGame = ({ balance, setBalance, gameStats, setGameResult, setError }) => {
  // Game state
  const [grid, setGrid] = useState(Array(5).fill().map(() => Array(5).fill('gem')));
  const [revealed, setRevealed] = useState(Array(25).fill(false));
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [betAmount, setBetAmount] = useState(1);
  const [minesCount, setMinesCount] = useState(5);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [possibleWin, setPossibleWin] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  
  // Store game data in a ref to avoid re-renders
  const gameDataRef = useRef(null);
  
  // Debug output when gameActive changes
  useEffect(() => {
    console.log("MINES COMPONENT: gameActive changed to:", gameActive);
  }, [gameActive]);

  // Update possible win when bet amount changes
  useEffect(() => {
    setPossibleWin(betAmount);
  }, [betAmount]);
  
  // Start new game - using useCallback to prevent unnecessary recreations
  const startGame = useCallback(async () => {
    try {
      console.log("MINES COMPONENT: Starting new game...");
      
      // Reset all game state
      setGameOver(false);
      setRevealed(Array(25).fill(false));
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setPossibleWin(betAmount);
      setGameActive(false); // Make sure game is inactive during setup
      setGameResult(null);
      setError(null);
      
      // Create unique seed
      const uniqueSeed = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Send API request
      console.log("MINES COMPONENT: Sending API request to create game");
      const response = await gameApi.playMines(betAmount, minesCount, uniqueSeed);
      
      const data = response.data.data;
      if (!data || !data.gameId) {
        throw new Error("API did not return gameId");
      }
      
      // Store game data
      gameDataRef.current = data;
      console.log("MINES COMPONENT: Game created with ID:", data.gameId);
      
      // Update balance from API response
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Reset grid
      setGrid(Array(5).fill().map(() => Array(5).fill('gem')));
      
      // CRITICAL: Activate game AFTER all other state is set
      console.log("MINES COMPONENT: Activating game now");
      setTimeout(() => {
        setGameActive(true);
        console.log("MINES COMPONENT: Game should be active now");
      }, 50);
      
    } catch (err) {
      console.error("MINES COMPONENT: Error starting game:", err);
      setError(err.response?.data?.message || "Failed to start game");
    }
  }, [betAmount, minesCount, setBalance, setError, setGameResult]);
  
  // Handle cell click
  const handleCellClick = useCallback(async (row, col) => {
    console.log(`MINES COMPONENT: Cell click [${row},${col}], gameActive=${gameActive}, gameOver=${gameOver}`);
    
    // Guard against clicks when game is inactive
    if (!gameActive || gameOver) {
      console.log("MINES COMPONENT: Ignoring click - game not active");
      return;
    }
    
    // Verify game data exists
    if (!gameDataRef.current?.gameId) {
      console.error("MINES COMPONENT: No game data available");
      setError("Game data not found. Please start a new game.");
      return;
    }
    
    const index = row * 5 + col;
    
    // Check if cell already revealed
    if (revealed[index]) {
      console.log("MINES COMPONENT: Cell already revealed");
      return;
    }
    
    try {
      // Prevent further clicks during processing
      setGameActive(false);
      
      // Send API request
      console.log(`MINES COMPONENT: Sending API request for cell [${row},${col}]`);
      const response = await gameApi.completeMinesGame(
        gameDataRef.current.gameId, 
        row, 
        col, 
        false
      );
      
      const data = response.data.data;
      
      // Update revealed cells
      const newRevealed = [...revealed];
      newRevealed[index] = true;
      setRevealed(newRevealed);
      setRevealedCount(prevCount => prevCount + 1);
      
      if (data.win === false) {
        // Hit a mine - game over
        console.log("MINES COMPONENT: Mine hit - game over");
        
        // Update grid with mine positions if provided
        if (data.grid) {
          setGrid(data.grid);
          
          // Reveal all mines
          const allRevealed = [...newRevealed];
          data.grid.forEach((rowData, rowIndex) => {
            rowData.forEach((cell, colIndex) => {
              if (cell === 'mine') {
                allRevealed[rowIndex * 5 + colIndex] = true;
              }
            });
          });
          setRevealed(allRevealed);
        }
        
        // End game
        setGameActive(false);
        setGameOver(true);
        
        // Show result
        setGameResult({
          win: false,
          amount: betAmount,
          newBalance: data.balanceAfter
        });
        
        // Update balance
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
      } else if (data.maxWin === true) {
        // All safe cells revealed - max win
        console.log("MINES COMPONENT: All safe cells revealed - max win");
        
        const finalMultiplier = data.multiplier || data.currentMultiplier || 1;
        setCurrentMultiplier(finalMultiplier);
        setPossibleWin(betAmount * finalMultiplier);
        
        // End game
        setGameActive(false);
        setGameOver(true);
        
        // Show result
        setGameResult({
          win: true,
          amount: data.profit,
          newBalance: data.balanceAfter,
          serverSeedHashed: data.serverSeedHashed,
          clientSeed: data.clientSeed,
          nonce: data.nonce
        });
        
        // Update balance
        if (data.balanceAfter !== undefined) {
          setBalance(data.balanceAfter);
        }
        
      } else {
        // Safe cell - continue game
        console.log("MINES COMPONENT: Safe cell - continue game");
        
        // Update multiplier and possible win
        if (data.currentMultiplier !== undefined) {
          setCurrentMultiplier(data.currentMultiplier);
          setPossibleWin(betAmount * data.currentMultiplier);
        }
        
        // Re-enable game
        setGameActive(true);
        
        // Check autoplay condition
        if (autoplay && data.currentMultiplier >= 2) {
          console.log("MINES COMPONENT: Autoplay condition met - cashing out");
          setTimeout(() => handleCashout(), 300);
        }
      }
    } catch (err) {
      console.error("MINES COMPONENT: Error processing cell click:", err);
      setError(err.response?.data?.message || "Error revealing cell");
      // Re-enable game on error
      setGameActive(true);
    }
  }, [gameActive, gameOver, revealed, betAmount, autoplay, setBalance, setError, setGameResult]);
  
  // Handle cashout
  const handleCashout = useCallback(async () => {
    console.log("MINES COMPONENT: Cashout requested, gameActive=", gameActive);
    
    if (!gameActive || gameOver) {
      console.log("MINES COMPONENT: Cannot cashout - game not active");
      return;
    }
    
    if (!gameDataRef.current?.gameId) {
      console.error("MINES COMPONENT: No game data for cashout");
      setError("Game data not found. Please start a new game.");
      return;
    }
    
    try {
      // Prevent further actions
      setGameActive(false);
      
      // Send API request
      console.log("MINES COMPONENT: Sending cashout request");
      const response = await gameApi.completeMinesGame(
        gameDataRef.current.gameId, 
        null, 
        null, 
        true
      );
      
      const data = response.data.data;
      
      // Mark game as over
      setGameOver(true);
      
      // Update balance
      if (data.balanceAfter !== undefined) {
        setBalance(data.balanceAfter);
      }
      
      // Show result
      setGameResult({
        win: true,
        amount: data.profit,
        newBalance: data.balanceAfter,
        serverSeedHashed: data.serverSeedHashed,
        clientSeed: data.clientSeed,
        nonce: data.nonce
      });
      
    } catch (err) {
      console.error("MINES COMPONENT: Error during cashout:", err);
      setError(err.response?.data?.message || "Error processing cashout");
      // Re-enable game on error
      setGameActive(true);
    }
  }, [gameActive, gameOver, setBalance, setError, setGameResult]);
  
  // Handle autoplay change
  const handleAutoplayChange = useCallback((value) => {
    console.log("MINES COMPONENT: Autoplay changed to:", value);
    setAutoplay(value);
  }, []);
  
  return (
    <>
      <MinesGrid 
        grid={grid}
        revealed={revealed}
        onCellClick={handleCellClick}
        gameActive={gameActive}
        gameOver={gameOver}
      />
      
      <MinesControls 
        balance={balance}
        onPlay={startGame}
        onCashout={handleCashout}
        gameActive={gameActive}
        currentMultiplier={currentMultiplier}
        possibleWin={possibleWin}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        minesCount={minesCount}
        setMinesCount={setMinesCount}
        revealedCount={revealedCount}
        onAutoplayChange={handleAutoplayChange}
        autoplay={autoplay}
      />
    </>
  );
};

export default MinesGame;