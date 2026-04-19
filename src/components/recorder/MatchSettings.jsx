import React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import DeckSelect from '../DeckSelect';

const MatchSettings = ({ 
  mode, 
  setMode, 
  availableDecks, 
  availableTags,
  myDecks, 
  setMyDecks, 
  isMyDeckLocked, 
  setIsMyDeckLocked,
  oppDecks, 
  setOppDecks, 
  isOpponentDeckLocked, 
  setIsOpponentDeckLocked,
  selectedTags, 
  setSelectedTags, 
  isTagsLocked, 
  setIsTagsLocked,
  setIsInputActive
}) => {
  return (
    <div className="glass-card p-8 border-white/5 shadow-2xl space-y-6" onFocusCapture={() => setIsInputActive(true)} onBlurCapture={() => setIsInputActive(false)}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Mode Selection</label>
          <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold">
            <option value="ランク">Normal Ranked</option>
            <option value="レート戦">Rating Match</option>
            <option value="DC">DC / Event Match</option>
          </select>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Deck & Attributes</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <DeckSelect availableDecks={availableDecks} onChange={setMyDecks} selectedDecks={myDecks} placeholder="Your Deck" />
              </div>
              <button onClick={() => setIsMyDeckLocked(!isMyDeckLocked)} className={`p-4 rounded-2xl border transition-all ${isMyDeckLocked ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
                {isMyDeckLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <DeckSelect availableDecks={availableDecks} onChange={setOppDecks} selectedDecks={oppDecks} placeholder="Opponent Deck" />
            </div>
            <button onClick={() => setIsOpponentDeckLocked(!isOpponentDeckLocked)} className={`p-4 rounded-2xl border transition-all ${isOpponentDeckLocked ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
              {isOpponentDeckLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <DeckSelect availableDecks={availableTags} onChange={setSelectedTags} selectedDecks={selectedTags} placeholder="Match Keywords" />
            </div>
            <button onClick={() => setIsTagsLocked(!isTagsLocked)} className={`p-4 rounded-2xl border transition-all ${isTagsLocked ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
              {isTagsLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchSettings;
