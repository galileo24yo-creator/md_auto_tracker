import React from 'react';
import { Eye } from 'lucide-react';

const CardDatabase = ({ detectedCards, handleCardClick }) => {
  if (detectedCards.length === 0) return null;

  return (
    <div className="glass-card p-6 border-zinc-800/40 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
        <div className="w-12 h-12 text-white"><Eye className="w-12 h-12" /></div>
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        Detected Cards Database
      </h3>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-black text-indigo-400/60 mb-2 flex items-center gap-2 tracking-[0.2em]">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 
            Ally data
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-3 custom-scrollbar">
            {detectedCards.filter(c => c.side === 'BLUE').map((c, i) => (
              <div 
                key={i} 
                onClick={() => handleCardClick(c)}
                className={`bg-zinc-950/40 border border-zinc-800/50 p-3.5 rounded-2xl flex flex-col gap-1 transition-all duration-200 group/item ${c.archetype ? 'cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 active:scale-95' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-200 text-xs font-black truncate uppercase tracking-tight">{c.name}</span>
                  <span className="text-[10px] font-black text-indigo-400/40 tabular-nums shrink-0">x{c.hits || 1}</span>
                </div>
                {c.archetype && <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{c.archetype}</span>}
                <div className="mt-2 w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${c.totalWeight >= 3.0 ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-700'}`}
                    style={{ width: `${Math.min(100, ((c.totalWeight || 0.1) / 3.0) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] uppercase font-black text-rose-400/60 mb-2 flex items-center gap-2 tracking-[0.2em] justify-end">
            Opponent data
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-3 custom-scrollbar">
            {detectedCards.filter(c => c.side === 'RED').map((c, i) => (
              <div 
                key={i} 
                onClick={() => handleCardClick(c)}
                className={`bg-zinc-950/40 border border-zinc-800/50 p-3.5 rounded-2xl flex flex-col gap-1 text-right transition-all duration-200 group/item ${c.archetype ? 'cursor-pointer hover:border-rose-500/50 hover:bg-rose-500/5 active:scale-95' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-200 text-xs font-black truncate uppercase tracking-tight">{c.name}</span>
                  <span className="text-[10px] font-black text-rose-400/40 tabular-nums shrink-0">x{c.hits || 1}</span>
                </div>
                {c.archetype && <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{c.archetype}</span>}
                <div className="mt-2 w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${c.totalWeight >= 3.0 ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-zinc-700'}`}
                    style={{ width: `${Math.min(100, ((c.totalWeight || 0.1) / 3.0) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDatabase;
