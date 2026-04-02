import React, { useState, useEffect, useRef, useDeferredValue, memo } from 'react';
import { X, Search } from 'lucide-react';

const STORAGE_KEY = 'md_tracker_deck_freq';

export default function DeckSelect({ availableDecks, selectedDecks, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [frequencies, setFrequencies] = useState({});
  const wrapperRef = useRef(null);
  const deferredInput = useDeferredValue(inputValue);

  // Load frequencies from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setFrequencies(JSON.parse(saved));
    } catch (e) { console.error('Failed to load deck frequencies', e); }
  }, []);

  // Update frequencies when a deck is selected
  const incrementFreq = (deckName) => {
    const newFreq = { ...frequencies, [deckName]: (frequencies[deckName] || 0) + 1 };
    setFrequencies(newFreq);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFreq));
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedSuggestions = React.useMemo(() => {
    // 1. Filter out already selected
    let list = availableDecks.filter(d => !selectedDecks.includes(d));
    
    // 2. Filter by search input
    if (deferredInput) {
      const lowerInput = deferredInput.toLowerCase();
      // ひらがな・カタカナの揺れ等も本来は対応すべきですが今回は単純な部分一致
      list = list.filter(d => d.toLowerCase().includes(lowerInput));
    }
    
    // 3. Sort by usage frequency (descending)
    list.sort((a, b) => {
      const freqA = frequencies[a] || 0;
      const freqB = frequencies[b] || 0;
      if (freqB !== freqA) return freqB - freqA;
      return a.localeCompare(b, 'ja');
    });

    // 4. Add the input itself as a suggestion if it doesn't exactly match any existing
    if (deferredInput && !list.includes(deferredInput) && !selectedDecks.includes(deferredInput)) {
      list.unshift(deferredInput);
    }
    
    return list;
  }, [availableDecks, selectedDecks, deferredInput, frequencies]);

  const handleSelect = (deck) => {
    if (!deck.trim()) return;
    const newSelected = [...selectedDecks, deck.trim()].sort((a, b) => a.localeCompare(b, 'ja'));
    onChange(newSelected);
    incrementFreq(deck.trim());
    setInputValue('');
  };

  const handleRemove = (deck) => {
    onChange(selectedDecks.filter(d => d !== deck));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue) {
      e.preventDefault();
      // 候補があれば一番上を選択、なければ入力をそのまま選択
      const target = sortedSuggestions.length > 0 ? sortedSuggestions[0] : inputValue;
      handleSelect(target);
    } else if (e.key === 'Backspace' && !inputValue && selectedDecks.length > 0) {
      handleRemove(selectedDecks[selectedDecks.length - 1]);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`flex flex-wrap gap-2 items-center min-h-[42px] p-2 bg-zinc-900 border rounded-lg transition-colors cursor-text
          ${isFocused ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-zinc-700 hover:border-zinc-600'}`}
        onClick={() => setIsFocused(true)}
      >
        {selectedDecks.map(deck => (
          <span 
            key={deck} 
            className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 text-sm px-2 py-1 rounded-md border border-indigo-500/30"
          >
            {deck}
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); handleRemove(deck); }}
              className="hover:text-white focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        <div className="flex-1 flex items-center min-w-[120px]">
          <Search className="w-4 h-4 text-zinc-500 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent text-zinc-200 focus:outline-none text-sm placeholder-zinc-500"
            placeholder={selectedDecks.length === 0 ? placeholder : ""}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {isFocused && (sortedSuggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {sortedSuggestions.slice(0, 50).map((deck, idx) => {
            const isNew = deferredInput && deck === deferredInput && !availableDecks.includes(deferredInput);
            return (
              <div
                key={deck}
                className="px-4 py-2 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-200 flex items-center justify-between border-b border-zinc-700/30 last:border-0"
                onClick={() => handleSelect(deck)}
              >
                <span>{deck}</span>
                {isNew ? (
                  <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">New</span>
                ) : (
                  frequencies[deck] > 0 && <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{frequencies[deck]}回</span>
                )}
              </div>
            );
          })}
          {sortedSuggestions.length > 50 && (
            <div className="p-3 text-center text-[10px] text-zinc-500 font-black uppercase tracking-widest">
              Showing top 50 / {sortedSuggestions.length} items. Keep typing to filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
