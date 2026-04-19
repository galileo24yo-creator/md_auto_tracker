import React from 'react';
import { Activity, Eye, EyeOff } from 'lucide-react';

const AnalysisMonitor = ({ 
  canvasRef, 
  showRoiOverlay, 
  setShowRoiOverlay, 
  currentCard 
}) => {
  return (
    <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center relative min-h-[220px]">
      <canvas ref={canvasRef} className="max-w-full h-auto rounded-xl border border-zinc-900 shadow-2xl" />
      <button 
        onClick={() => setShowRoiOverlay(!showRoiOverlay)} 
        className="absolute top-5 right-5 p-2 bg-zinc-950/80 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white transition-all z-10"
      >
        {showRoiOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      {currentCard.name && (
        <div className={`absolute bottom-3 left-3 right-3 p-3 rounded-2xl border shadow-2xl backdrop-blur-xl ${currentCard.side === 'BLUE' ? 'bg-indigo-600/80 border-indigo-400' : 'bg-rose-600/80 border-rose-400'}`}>
          <div className="flex items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="bg-black/40 px-2 py-0.5 rounded-md text-[8px] uppercase font-black shrink-0 tracking-widest">Detected</span>
              <span className="font-black text-sm text-white truncate uppercase tracking-tight">{currentCard.name}</span>
            </div>
            <div className="shrink-0 flex items-center gap-2">
               <span className="text-[10px] font-black text-white opacity-80 tabular-nums">{currentCard.confidence}%</span>
               <span className="status-dot bg-white animate-pulse" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-500 shadow-[0_0_10px_white]" style={{ width: `${Math.min(100, (currentCard.votes / 5) * 100)}%` }} />
            </div>
            <span className="text-[9px] font-black text-white opacity-60 uppercase">{currentCard.votes} Hits</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisMonitor;
