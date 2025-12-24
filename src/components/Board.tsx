import React from 'react';
import { VISUAL_GRID_ORDER, SPECIAL_SQUARES } from '../constants';
import { Token, Player, Move } from '../types';
import clsx from 'clsx';

interface BoardProps {
  tokens: Token[];
  validMoves: Move[];
  onSquareClick: (position: number) => void;
  selectedTokenId: string | null;
}

export const Board: React.FC<BoardProps> = ({ tokens, validMoves, onSquareClick, selectedTokenId }) => {
  const getSquareContent = (pos: number) => {
    const token = tokens.find(t => t.position === pos);
    const isValidDest = validMoves.some(m => m.to === pos && m.tokenId === selectedTokenId);
    const isSource = validMoves.some(m => m.from === pos);
    
    // For selecting a token to move
    const canSelect = isSource && !selectedTokenId;
    
    // For clicking a destination
    const canMoveTo = selectedTokenId && isValidDest;

    return { token, canSelect, canMoveTo };
  };

  return (
    <div className="grid grid-cols-10 gap-1 md:gap-2 max-w-4xl mx-auto p-2 bg-amber-800 rounded-lg shadow-xl border-4 border-amber-900">
      {VISUAL_GRID_ORDER.map((pos) => {
        const { token, canSelect, canMoveTo } = getSquareContent(pos);
        const special = SPECIAL_SQUARES[pos as keyof typeof SPECIAL_SQUARES];
        
        return (
          <div
            key={pos}
            onClick={() => {
              if (canSelect || canMoveTo) onSquareClick(pos);
              // Allow clicking own token to change selection if valid
              if (token && validMoves.some(m => m.from === pos)) onSquareClick(pos);
            }}
            className={clsx(
              "relative aspect-square flex flex-col items-center justify-center text-xs md:text-sm font-bold border-2 transition-all cursor-default select-none",
              // Backgrounds
              special ? "bg-amber-200" : "bg-amber-100",
              // Borders & Interactions
              canMoveTo ? "border-green-500 bg-green-100 cursor-pointer animate-pulse ring-2 ring-green-400 z-10" : "border-amber-900/30",
              canSelect ? "cursor-pointer hover:bg-amber-50" : "",
              selectedTokenId && token?.id === selectedTokenId ? "ring-4 ring-blue-500 z-10" : ""
            )}
          >
            {/* Square Number */}
            <span className="absolute top-0 left-1 text-[10px] md:text-xs text-amber-900/50">{pos}</span>
            
            {/* Special Label */}
            {special && (
               <span className="absolute bottom-0 w-full text-center text-[8px] md:text-[10px] leading-tight text-amber-800 font-serif px-1">
                 {special.short}
               </span>
            )}
            
            {/* Hieroglyph decorations (simplified) */}
            {pos === 26 && <span className="text-2xl opacity-20">𓄤</span>} 
            {pos === 27 && <span className="text-2xl opacity-20">𓈗</span>} 
            
            {/* Token */}
            {token && (
              <div
                className={clsx(
                  "w-3/4 h-3/4 rounded-full shadow-lg flex items-center justify-center border-2 transition-transform",
                  token.owner === Player.Light 
                    ? "bg-stone-100 border-stone-300 text-stone-600" 
                    : "bg-slate-800 border-slate-950 text-slate-200",
                  canSelect && !selectedTokenId ? "hover:scale-110" : ""
                )}
              >
                <div className="w-1/2 h-1/2 rounded-full border border-current opacity-30"></div>
              </div>
            )}
            
            {/* Movement Path Arrows/Indicators (Subtle) */}
            {/* Could add arrows here but the number sequence is usually sufficient */}
          </div>
        );
      })}
    </div>
  );
};