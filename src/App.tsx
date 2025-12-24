import React, { useState, useEffect, useCallback } from 'react';
import { Board } from './components/Board';
import { LearnGuide } from './components/LearnGuide';
import { GameState, GamePhase, Player, Move, Token } from './types';
import { INITIAL_STATE, getMoveDistance, hasExtraTurn, getValidMoves, checkWinCondition } from './utils/gameLogic';
import { RotateCcw, BookOpen, Gamepad2, Info, ArrowRight, Save, History, Trophy } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const [activeTab, setActiveTab] = useState<'play' | 'learn'>('play');
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem('senet_gamestate');
      if (saved) {
        const parsed = JSON.parse(saved);
        // specific check to ensure critical fields added later exist, otherwise reset
        if (parsed.setupTurnStep === undefined || !parsed.tokens) {
           console.warn("Detected old state format, resetting.");
           return INITIAL_STATE;
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved state", e);
    }
    return INITIAL_STATE;
  });
  
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('senet_gamestate', JSON.stringify(gameState));
  }, [gameState]);

  // Win Check
  useEffect(() => {
    if (gameState.phase !== GamePhase.GameOver) {
      const winner = checkWinCondition(gameState.tokens);
      if (winner) {
        setGameState(prev => ({
          ...prev,
          phase: GamePhase.GameOver,
          winner,
          message: `${winner} Wins the Game!`,
          moveHistory: [...prev.moveHistory, `GAME OVER: ${winner} wins!`]
        }));
      }
    }
  }, [gameState.tokens, gameState.phase]);

  const throwSticks = useCallback(() => {
    // Generate 4 random binary values (0 or 1)
    // 1 represents Light side up
    const rolls = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];
    const result = rolls.filter(r => r).length; // Sum of light sides (0-4)

    if (gameState.phase === GamePhase.Determination) {
      // Determine First Player logic
      if (result === 1) {
         // Current thrower becomes Dark
         // The thrower is tracked visually by toggling, but logically we just set Dark active
         // But prompt says: "First player to throw 1 plays dark... moves 10 to 11... gets to toss again"
         
         const newTokens = [...gameState.tokens];
         // Move 10 to 11
         const tIndex = newTokens.findIndex(t => t.position === 10);
         if (tIndex !== -1) newTokens[tIndex].position = 11;

         setGameState(prev => ({
           ...prev,
           stickResult: result,
           stickRollsHistory: rolls,
           phase: GamePhase.Rolling, // Rolling again for first move
           currentPlayer: Player.Dark,
           setupTurnStep: 1, // Step 1: Dark's free turn
           tokens: newTokens,
           message: "You threw a 1! You are Dark. Token moved 10->11. Throw again for your first move.",
           moveHistory: [...prev.moveHistory, "Dark determined (threw 1). Auto-moved 10->11."]
         }));
      } else {
        setGameState(prev => ({
           ...prev,
           stickResult: result,
           stickRollsHistory: rolls,
           message: `Threw ${result}. Need a 1 to start. Pass sticks.`,
        }));
      }
      return;
    }

    if (gameState.phase === GamePhase.WaterResolution) {
      // Option B logic
      if (result === 4) {
         // Success: Remove token, Extra Turn
         const newTokens = gameState.tokens.map(t => 
             t.id === gameState.waterTokenId ? { ...t, position: 31 } : t
         );
         setGameState(prev => ({
            ...prev,
            stickResult: result,
            stickRollsHistory: rolls,
            tokens: newTokens,
            waterTokenId: null,
            phase: GamePhase.Rolling, // Extra turn
            message: "Threw 4! Escaped Waters! Take an extra turn.",
            moveHistory: [...prev.moveHistory, `${prev.currentPlayer} escaped Waters (threw 4).`]
         }));
      } else {
         // Fail: Stay, Turn Ends
         setGameState(prev => ({
            ...prev,
            stickResult: result,
            stickRollsHistory: rolls,
            waterTokenId: null,
            phase: GamePhase.Rolling,
            currentPlayer: prev.currentPlayer === Player.Light ? Player.Dark : Player.Light,
            message: `Threw ${result}. Failed to escape. Turn ends.`,
            moveHistory: [...prev.moveHistory, `${prev.currentPlayer} failed to escape Waters.`]
         }));
      }
      return;
    }

    // Normal Play
    const moveDist = getMoveDistance(result);
    setGameState(prev => {
        // Prepare state to check valid moves
        const nextState = { ...prev, stickResult: result, stickRollsHistory: rolls, phase: GamePhase.Moving };
        const moves = getValidMoves(nextState);
        
        // Rule 3: If no valid moves, turn ends immediately
        if (moves.length === 0) {
             return {
                 ...prev,
                 lastState: JSON.stringify(prev),
                 stickResult: result,
                 stickRollsHistory: rolls,
                 phase: GamePhase.Rolling,
                 currentPlayer: prev.currentPlayer === Player.Light ? Player.Dark : Player.Light,
                 message: `Threw ${result} (${moveDist} moves). No valid moves! Turn passed.`,
                 moveHistory: [...prev.moveHistory, `${prev.currentPlayer} threw ${result}. No moves.`]
             };
        }

        return {
           ...prev,
           lastState: JSON.stringify(prev),
           stickResult: result,
           stickRollsHistory: rolls,
           phase: GamePhase.Moving,
           message: `Threw ${result} (${moveDist} spaces). Select a token.`
        };
    });
  }, [gameState]);

  const handleSquareClick = (pos: number) => {
    if (gameState.phase !== GamePhase.Moving) return;

    // Is this a selection or a move?
    const validMoves = getValidMoves(gameState);
    
    // Check if clicking a valid source
    const clickedMyToken = validMoves.some(m => m.from === pos);
    
    // Check if clicking a valid destination for selected token
    const clickedDest = selectedTokenId ? validMoves.find(m => m.tokenId === selectedTokenId && m.to === pos) : null;

    if (clickedDest) {
      // Execute Move
      const movingToken = gameState.tokens.find(t => t.id === selectedTokenId);
      if (!movingToken) return;

      const newTokens = [...gameState.tokens];
      const tIndex = newTokens.findIndex(t => t.id === selectedTokenId);
      
      let logMsg = `${gameState.currentPlayer} moved ${movingToken.position} -> ${pos}`;

      // Handle Swap
      if (clickedDest.isSwap) {
         const enemyIndex = newTokens.findIndex(t => t.position === pos);
         if (enemyIndex !== -1) {
            newTokens[enemyIndex].position = movingToken.position; // Send back
            logMsg += ` (Swapped)`;
         }
      }

      // Update Mover
      newTokens[tIndex].position = pos;

      // Handle House of Second Life (15) -> 1
      if (pos === 15) {
         newTokens[tIndex].position = 1;
         logMsg += ` (Life -> 1)`;
      }

      // Handle House of Waters (27)
      let nextPhase = GamePhase.Rolling;
      let nextPlayer = gameState.currentPlayer;
      let nextWaterId = null;

      if (pos === 27) {
         logMsg += ` (Fell into Waters)`;
         // "Lose additional turns... next turn must deal with this"
         // We switch player regardless of extra turn roll.
         nextPlayer = gameState.currentPlayer === Player.Light ? Player.Dark : Player.Light;
         nextWaterId = null; 
      } else {
          // Normal Turn End / Extra Turn Logic
          const dist = getMoveDistance(gameState.stickResult || 0);
          const earnedExtra = hasExtraTurn(gameState.stickResult || 0);
          
          if (earnedExtra && pos !== 27) {
             logMsg += ` (Extra Turn)`;
             nextPlayer = gameState.currentPlayer;
          } else {
             nextPlayer = gameState.currentPlayer === Player.Light ? Player.Dark : Player.Light;
          }
      }
      
      // Update Setup Step
      let nextSetupStep = gameState.setupTurnStep;
      if (gameState.setupTurnStep === 1 && gameState.currentPlayer === Player.Dark) nextSetupStep = 2; // Dark done, Light's turn
      else if (gameState.setupTurnStep === 2 && gameState.currentPlayer === Player.Light) nextSetupStep = 3; // Light done, Normal play

      setGameState(prev => ({
         ...prev,
         tokens: newTokens,
         moveHistory: [...prev.moveHistory, logMsg],
         currentPlayer: nextPlayer,
         phase: GamePhase.Rolling,
         stickResult: null,
         selectedTokenId: null,
         waterTokenId: nextWaterId,
         setupTurnStep: nextSetupStep,
         message: `${nextPlayer}'s Turn. Throw Sticks.`
      }));
      setSelectedTokenId(null);
      
      // Check for Start of Turn "Water" Lock
      const playerHasWater = newTokens.find(t => t.owner === nextPlayer && t.position === 27);
      if (playerHasWater) {
          setGameState(prev => ({
             ...prev,
             tokens: newTokens,
             moveHistory: [...prev.moveHistory, logMsg],
             currentPlayer: nextPlayer,
             phase: GamePhase.WaterResolution,
             stickResult: null,
             waterTokenId: playerHasWater.id,
             setupTurnStep: nextSetupStep,
             message: `${nextPlayer} is stuck in House of Waters! Choose Option.`
          }));
      }

    } else if (clickedMyToken) {
       // Select it
       // If clicking self, deselect
       if (selectedTokenId === gameState.tokens.find(t => t.position === pos)?.id) {
           setSelectedTokenId(null);
       } else {
           const t = gameState.tokens.find(t => t.position === pos);
           if (t) setSelectedTokenId(t.id);
       }
    }
  };

  const resolveWaterOptionA = () => {
     // Return to 15, End Turn
     const newTokens = gameState.tokens.map(t => 
        t.id === gameState.waterTokenId ? { ...t, position: 15 } : t
     );
     setGameState(prev => ({
        ...prev,
        tokens: newTokens,
        waterTokenId: null,
        phase: GamePhase.Rolling,
        currentPlayer: prev.currentPlayer === Player.Light ? Player.Dark : Player.Light,
        message: "Returned to House of Second Life. Turn Ended.",
        moveHistory: [...prev.moveHistory, `${prev.currentPlayer} chose Water Option A (15).`]
     }));
  };

  const undoLastMove = () => {
    if (gameState.lastState) {
       const restored = JSON.parse(gameState.lastState);
       setGameState(restored);
       setSelectedTokenId(null);
    }
  };

  const resetGame = () => {
     if(confirm("Reset game? Progress will be lost.")) {
        setGameState(INITIAL_STATE);
        setSelectedTokenId(null);
     }
  };

  const validMoves = gameState.stickResult !== null ? getValidMoves(gameState) : [];

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-amber-900 text-amber-50 p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold font-serif tracking-wider">SENET</h1>
            <span className="text-xs uppercase opacity-70 border border-amber-700 px-1 rounded">Make & Play</span>
          </div>
          <nav className="flex gap-4">
             <button 
                onClick={() => setActiveTab('play')}
                className={clsx("flex items-center gap-1 hover:text-white transition-colors", activeTab === 'play' ? "text-amber-200 font-bold border-b-2 border-amber-200" : "text-amber-400/80")}
             >
               <Gamepad2 size={18} /> Play
             </button>
             <button 
                onClick={() => setActiveTab('learn')}
                className={clsx("flex items-center gap-1 hover:text-white transition-colors", activeTab === 'learn' ? "text-amber-200 font-bold border-b-2 border-amber-200" : "text-amber-400/80")}
             >
               <BookOpen size={18} /> Guide
             </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-4 bg-amber-50">
        {activeTab === 'learn' ? (
          <LearnGuide />
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
             
             {/* Left Col: Game Controls */}
             <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
                
                {/* Status Card */}
                <div className="bg-white p-4 rounded-lg shadow border border-amber-100">
                   <h2 className="text-lg font-bold border-b pb-2 mb-2 flex justify-between">
                     <span>Status</span>
                     <span className={clsx("px-2 rounded text-sm", gameState.currentPlayer === Player.Light ? "bg-stone-200 text-stone-800" : "bg-slate-800 text-white")}>
                       {gameState.currentPlayer}'s Turn
                     </span>
                   </h2>
                   
                   <p className="text-sm min-h-[3rem] italic text-slate-600 mb-4">{gameState.message}</p>

                   {/* Sticks Display */}
                   <div className="flex justify-center gap-2 mb-4 p-2 bg-amber-50 rounded-lg">
                      {gameState.stickRollsHistory.map((isLight, i) => (
                         <div key={i} className={clsx(
                           "w-4 h-16 rounded-full border-2 border-slate-400 shadow-sm transition-all",
                           isLight ? "bg-stone-100" : "bg-slate-800"
                         )}></div>
                      ))}
                   </div>
                   
                   <div className="text-center font-bold text-xl mb-4">
                     Result: {gameState.stickResult !== null ? gameState.stickResult : "-"} 
                     {gameState.stickResult !== null && <span className="text-sm font-normal text-slate-500 ml-2">
                       ({gameState.stickResult === 0 ? 5 : gameState.stickResult} moves)
                     </span>}
                   </div>

                   {/* Controls */}
                   <div className="space-y-2">
                      {gameState.phase === GamePhase.WaterResolution ? (
                         <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={resolveWaterOptionA}
                              className="bg-amber-700 hover:bg-amber-800 text-white p-2 rounded text-sm"
                            >
                              Option A: Return to 15
                            </button>
                            <button 
                              onClick={throwSticks}
                              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded text-sm"
                            >
                              Option B: Throw for 4
                            </button>
                         </div>
                      ) : (
                        <button 
                          onClick={throwSticks}
                          disabled={gameState.phase !== GamePhase.Rolling && gameState.phase !== GamePhase.Determination}
                          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                          <History className="animate-pulse" size={20} />
                          {gameState.phase === GamePhase.Determination ? "Throw to Determine Start" : "Throw Sticks"}
                        </button>
                      )}

                      {gameState.phase === GamePhase.Moving && gameState.stickResult !== null && (
                         <div className="text-center text-xs text-amber-700 animate-bounce">
                            Select a highlighted token to move
                         </div>
                      )}
                   </div>
                </div>

                {/* Game Actions */}
                <div className="flex gap-2 text-sm">
                   <button onClick={undoLastMove} disabled={!gameState.lastState} className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 flex items-center justify-center gap-1 disabled:opacity-50">
                     <RotateCcw size={16} /> Undo
                   </button>
                   <button onClick={resetGame} className="flex-1 py-2 px-3 bg-slate-200 hover:bg-red-100 hover:text-red-700 rounded text-slate-700 flex items-center justify-center gap-1">
                     Reset Match
                   </button>
                </div>

                {/* Log */}
                <div className="bg-slate-50 p-3 rounded border h-48 overflow-y-auto text-xs font-mono">
                   <h3 className="font-bold text-slate-400 mb-2 uppercase">Match Log</h3>
                   {gameState.moveHistory.slice().reverse().map((entry, i) => (
                      <div key={i} className="mb-1 border-b border-slate-100 pb-1">{entry}</div>
                   ))}
                   {gameState.moveHistory.length === 0 && <span className="opacity-50">Game started...</span>}
                </div>

             </div>

             {/* Right Col: Board */}
             <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col justify-start">
                <Board 
                  tokens={gameState.tokens} 
                  validMoves={validMoves}
                  onSquareClick={handleSquareClick}
                  selectedTokenId={selectedTokenId}
                />
                
                <div className="mt-6 bg-amber-100 p-4 rounded-lg border border-amber-200 text-sm">
                   <h3 className="font-bold flex items-center gap-2 text-amber-800">
                     <Info size={16} /> Quick Rules
                   </h3>
                   <ul className="list-disc list-inside mt-2 space-y-1 text-amber-900/80">
                      <li><strong>Goal:</strong> Move all 5 pieces off the board (past square 30).</li>
                      <li><strong>Moves:</strong> 0 sticks = 5 moves. 1=1, 2=2, 3=3, 4=4.</li>
                      <li><strong>Extra Turn:</strong> Only on 1, 4, or 0 (5).</li>
                      <li><strong>Protection:</strong> 2 adjacent pieces of same color cannot be attacked.</li>
                      <li><strong>Houses:</strong> 15 (Life &rarr; 1), 26 (Beauty - Stop Exact), 27 (Water - Lose turn/Reset), 30 (Horus).</li>
                   </ul>
                </div>
             </div>

          </div>
        )}
      </main>

      {/* Game Over Modal */}
      {gameState.phase === GamePhase.GameOver && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-300">
               <Trophy size={64} className="mx-auto text-yellow-500 mb-4" />
               <h2 className="text-3xl font-bold mb-2 text-slate-800">{gameState.winner} Wins!</h2>
               <p className="text-slate-600 mb-6">Congratulations on successfully navigating the afterlife journey.</p>
               <button 
                 onClick={() => setGameState(INITIAL_STATE)}
                 className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105"
               >
                 Start New Match
               </button>
            </div>
         </div>
      )}
    </div>
  );
}

export default App;
