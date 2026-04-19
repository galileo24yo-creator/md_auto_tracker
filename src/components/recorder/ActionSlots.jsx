import React from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';

const ActionSlots = ({ 
  turn, 
  result, 
  diff, 
  mode, 
  isProcessing, 
  setTurn, 
  setResult, 
  setDiff, 
  setIsTurnLocked, 
  setIsResultLocked, 
  setIsDiffLocked,
  setRatingChange,
  saveMatch, 
  resetSlots,
  addLog,
  currentState,
  setCurrentState,
  stateRef,
  STATES
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div 
        onClick={() => { 
          const nextTurn = turn === '先' ? '後' : '先';
          setTurn(nextTurn); 
          setIsTurnLocked(true); 
          if (currentState === STATES.DETECTING_TURN) { 
            setCurrentState(STATES.IN_MATCH); 
            stateRef.current = STATES.IN_MATCH; 
            addLog(`Manual Operation: Set [${nextTurn}]`, 'success');
          } 
        }} 
        className="p-5 glass-card glass-card-hover bg-zinc-950/20 border-zinc-800/50 text-center cursor-pointer group"
      >
        <div className="text-[10px] text-zinc-500 uppercase font-black mb-1 group-hover:text-indigo-400 tracking-widest">Turn</div>
        <div className="text-2xl font-black text-indigo-400">{turn ? (turn + '攻') : '--'}</div>
      </div>

      <div 
        onClick={() => { 
          const nextResult = result === 'VICTORY' ? 'LOSE' : 'VICTORY';
          setResult(nextResult); 
          setIsResultLocked(true); 
          const n = (mode === 'ランク' || diff.trim() !== '') ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING; 
          if (currentState !== n) {
            setCurrentState(n); 
            stateRef.current = n; 
            addLog(`Manual Operation: Result [${nextResult}]`, 'info');
          }
        }} 
        className={`p-5 glass-card glass-card-hover bg-zinc-950/20 border-zinc-800/50 text-center cursor-pointer group ${result === 'LOSE' ? 'hover:border-rose-500/50' : 'hover:border-emerald-500/50'}`}
      >
        <div className={`text-[10px] uppercase font-black mb-1 ${result === 'LOSE' ? 'text-rose-500/40 group-hover:text-rose-400' : 'text-zinc-500 group-hover:text-emerald-400'} tracking-widest`}>Result</div>
        <div className={`text-2xl font-black ${result === 'LOSE' ? 'text-rose-500' : 'text-emerald-400'}`}>{result || '--'}</div>
      </div>

      <div className="glass-card bg-zinc-950/40 border-zinc-800/50 p-5 text-center col-span-2 relative">
        <label className="absolute top-3 left-4 text-[9px] text-zinc-500 uppercase font-black tracking-widest">Points / Rating</label>
        <input 
          type="text" 
          value={diff} 
          onChange={e => { 
            const v = e.target.value; 
            setDiff(v); 
            setRatingChange(v); 
            const l = v.trim() !== ''; 
            setIsDiffLocked(l); 
            if (l && currentState === STATES.DETECTING_RATING) { 
              setCurrentState(STATES.NEXT_MATCH_STANDBY); 
              stateRef.current = STATES.NEXT_MATCH_STANDBY; 
            } 
          }} 
          className="w-full bg-transparent text-3xl lg:text-4xl font-black text-indigo-400 outline-none text-center px-4" 
          placeholder="--" 
        />
      </div>

      <div className="flex flex-col gap-3 col-span-2 mt-2">
        <button 
          onClick={saveMatch} 
          disabled={isProcessing || !turn || !result} 
          className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} 
          Commit match record
        </button>
        <button 
          onClick={resetSlots} 
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> 
          Clear all slots
        </button>
      </div>
    </div>
  );
};

export default ActionSlots;
