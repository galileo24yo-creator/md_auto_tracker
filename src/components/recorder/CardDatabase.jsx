import React, { useState } from 'react';
import { Eye, Bookmark, Tag, X } from 'lucide-react';

const CardDatabase = ({ detectedCards, handleCardClick, handleTagClick }) => {
  const [activeMenuId, setActiveMenuId] = useState(null);

  if (detectedCards.length === 0) return null;

  const handleCardItemClick = (e, cardId) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === cardId ? null : cardId);
  };

  return (
    <div className="glass-card p-6 border-zinc-800/40 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
        <div className="w-12 h-12 text-white"><Eye className="w-12 h-12" /></div>
      </div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        Detected Cards Database
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Blue Side */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-black text-indigo-400/60 mb-2 flex items-center gap-2 tracking-[0.2em]">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 
            Ally data
          </div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-3 custom-scrollbar">
            {detectedCards.filter(c => c.side === 'BLUE').map((c, i) => {
              const cardId = `blue-${i}`;
              const isOpen = activeMenuId === cardId;
              return (
                <div key={i} className="relative">
                  <div 
                    onClick={(e) => handleCardItemClick(e, cardId)}
                    className={`bg-zinc-950/40 border border-zinc-800/50 p-4 rounded-2xl flex flex-col gap-1 transition-all duration-200 group/item relative cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 active:scale-[0.98] ${isOpen ? 'ring-1 ring-indigo-500 border-indigo-500/50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-200 text-xs font-black truncate uppercase tracking-tight">{c.name}</span>
                      <span className="text-[10px] font-black text-indigo-400/40 tabular-nums shrink-0">x{c.hits || 1}</span>
                    </div>
                    {c.archetype && <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{c.archetype}</span>}
                    {/* Progress Bar */}
                    <div className="mt-2 w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${c.totalWeight >= 0.8 ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-700'}`}
                        style={{ width: `${Math.min(100, ((c.totalWeight || 0.1) / 3.0) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Popover Menu */}
                  {isOpen && (
                    <div className="absolute inset-0 z-10 bg-zinc-900/95 backdrop-blur-sm rounded-2xl border border-indigo-500/50 flex items-center justify-center gap-2 p-2 animate-in zoom-in-95 duration-200">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCardClick(c); setActiveMenuId(null); }}
                        className="flex-1 h-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex flex-col items-center justify-center transition-all group/btn"
                      >
                        <Bookmark className="w-4 h-4 mb-1 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase">Theme</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTagClick(c); setActiveMenuId(null); }}
                        className="flex-1 h-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex flex-col items-center justify-center transition-all group/btn"
                      >
                        <Tag className="w-4 h-4 mb-1 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase">Factor</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Red Side */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-black text-rose-400/60 mb-2 flex items-center gap-2 tracking-[0.2em] justify-end">
            Opponent data
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 
          </div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-3 custom-scrollbar">
            {detectedCards.filter(c => c.side === 'RED').map((c, i) => {
              const cardId = `red-${i}`;
              const isOpen = activeMenuId === cardId;
              return (
                <div key={i} className="relative">
                  <div 
                    onClick={(e) => handleCardItemClick(e, cardId)}
                    className={`bg-zinc-950/40 border border-zinc-800/50 p-4 rounded-2xl flex flex-col gap-1 text-right transition-all duration-200 group/item relative cursor-pointer hover:border-rose-500/50 hover:bg-rose-500/5 active:scale-[0.98] ${isOpen ? 'ring-1 ring-rose-500 border-rose-500/50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-200 text-xs font-black truncate uppercase tracking-tight">{c.name}</span>
                      <span className="text-[10px] font-black text-rose-400/40 tabular-nums shrink-0">x{c.hits || 1}</span>
                    </div>
                    {c.archetype && <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{c.archetype}</span>}
                    {/* Progress Bar */}
                    <div className="mt-2 w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${c.totalWeight >= 0.8 ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-zinc-700'}`}
                        style={{ width: `${Math.min(100, ((c.totalWeight || 0.1) / 3.0) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Popover Menu (Red context) */}
                  {isOpen && (
                    <div className="absolute inset-0 z-10 bg-zinc-900/95 backdrop-blur-sm rounded-2xl border border-rose-500/50 flex items-center justify-center gap-2 p-2 animate-in zoom-in-95 duration-200">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCardClick(c); setActiveMenuId(null); }}
                        className="flex-1 h-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center transition-all group/btn"
                      >
                        <Bookmark className="w-4 h-4 mb-1 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Theme</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTagClick(c); setActiveMenuId(null); }}
                        className="flex-1 h-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex flex-col items-center justify-center transition-all group/btn"
                      >
                        <Tag className="w-4 h-4 mb-1 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Factor</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDatabase;
