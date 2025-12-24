import React from 'react';
import { LEARN_CONTENT, VISUAL_GRID_ORDER, SPECIAL_SQUARES } from '../constants';

export const LearnGuide: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 shadow-lg rounded-xl my-4 text-stone-800 leading-relaxed overflow-y-auto max-h-[80vh]">
      <div className="prose prose-stone max-w-none whitespace-pre-line font-serif">
        {LEARN_CONTENT}
      </div>
      
      <div className="mt-12 border-t-2 border-stone-200 pt-8 break-before-page">
        <h2 className="text-2xl font-bold mb-4 text-center font-serif">Printable Board Diagram</h2>
        <p className="text-center text-sm mb-6 italic text-stone-500">You can reference this layout to draw your own.</p>
        
        <div className="border-4 border-black p-1 max-w-lg mx-auto">
             <div className="grid grid-cols-10 border-l border-t border-black">
                {VISUAL_GRID_ORDER.map((pos) => {
                    const special = SPECIAL_SQUARES[pos as keyof typeof SPECIAL_SQUARES];
                    return (
                        <div key={pos} className="aspect-square flex flex-col items-center justify-center border-r border-b border-black relative">
                            <span className="font-bold text-lg">{pos}</span>
                            {special && <span className="text-[9px] text-center px-1 leading-none absolute bottom-1">{special.short}</span>}
                        </div>
                    )
                })}
             </div>
        </div>
      </div>
    </div>
  );
};