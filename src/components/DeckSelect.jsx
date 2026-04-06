import React, { useState, useEffect, useRef, memo } from 'react';
import { X, Search } from 'lucide-react';

const STORAGE_KEY = 'md_tracker_deck_freq';

const toKatakana = (str) => {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
};

export default function DeckSelect({ availableDecks, selectedDecks, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [frequencies, setFrequencies] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

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

  // 常に位置をリセットするために inputValue や availableDecks を監視
  useEffect(() => { setSelectedIndex(0); }, [inputValue, availableDecks]);

  const sortedSuggestions = React.useMemo(() => {
    let list = availableDecks.filter(d => !selectedDecks.includes(d));
    
    if (inputValue) {
      const normalizedInput = toKatakana(inputValue.toLowerCase());
      list = list.filter(d => {
        const normalizedDeck = toKatakana(d.toLowerCase());
        return normalizedDeck.includes(normalizedInput);
      });
    }
    
    // 基本のソート（表示順は50音順など）
    list.sort((a, b) => a.localeCompare(b, 'ja'));

    // 入力値自体を候補に追加（既存にない場合）
    if (inputValue && !list.some(d => d.toLowerCase() === inputValue.toLowerCase()) && !selectedDecks.includes(inputValue)) {
      list.unshift(inputValue);
    }
    
    return list;
  }, [availableDecks, selectedDecks, inputValue]);

  const popularDecks = React.useMemo(() => {
    return Object.entries(frequencies)
      .filter(([name]) => availableDecks.includes(name) && !selectedDecks.includes(name))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);
  }, [frequencies, availableDecks, selectedDecks]);

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
    // 日本語入力中（変換完了前）は独自のキー動作を停止する
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, sortedSuggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + sortedSuggestions.length) % Math.max(1, sortedSuggestions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sortedSuggestions.length > 0) {
        handleSelect(sortedSuggestions[selectedIndex]);
      } else if (inputValue) {
        handleSelect(inputValue);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
    } else if (e.key === 'Backspace' && !inputValue && selectedDecks.length > 0) {
      handleRemove(selectedDecks[selectedDecks.length - 1]);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`flex flex-wrap gap-2 items-center min-h-[48px] max-h-[120px] overflow-y-auto custom-scrollbar p-2 bg-zinc-900 border rounded-xl transition-all cursor-text
          ${isFocused ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-zinc-900/50 shadow-lg shadow-indigo-500/5' : 'border-zinc-800 hover:border-zinc-700'}`}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedDecks.map(deck => (
          <span 
            key={deck} 
            className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 text-xs font-black px-2.5 py-1 rounded-lg border border-indigo-500/20 animate-in zoom-in-95 duration-200"
          >
            {deck}
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); handleRemove(deck); }}
              className="hover:text-white transition-colors p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        <div className="flex-1 flex items-center min-w-[120px]">
          <Search className={`w-4 h-4 mr-2 transition-colors ${isFocused ? 'text-indigo-500' : 'text-zinc-600'}`} />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-zinc-100 focus:outline-none text-sm placeholder-zinc-600 font-medium"
            placeholder={selectedDecks.length === 0 ? placeholder : ""}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setIsFocused(true); }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {isFocused && (popularDecks.length > 0 || sortedSuggestions.length > 0) && (
        <div className="absolute z-[100] w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-h-[300px] overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-200">
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {/* Popular Decks Quick Access */}
            {!inputValue && popularDecks.length > 0 && (
              <div className="p-4 border-b border-zinc-800/50 bg-indigo-500/5">
                <div className="text-[10px] font-black text-indigo-400/70 uppercase tracking-widest mb-3 px-1">よく使う</div>
                <div className="flex flex-wrap gap-2">
                  {popularDecks.map(deck => (
                    <button
                      key={`pop-${deck}`}
                      type="button"
                      onClick={() => handleSelect(deck)}
                      className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 hover:border-indigo-500 hover:text-indigo-400 transition-all active:scale-95"
                    >
                      {deck}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sortedSuggestions.length > 0 ? (
              sortedSuggestions.slice(0, 50).map((deck, idx) => {
                const isActive = idx === selectedIndex;
                const isNew = inputValue && deck.toLowerCase() === inputValue.toLowerCase() && !availableDecks.includes(deck);
                return (
                  <div
                    key={deck}
                    className={`px-4 py-3 cursor-pointer text-sm flex items-center justify-between border-b border-zinc-800/30 last:border-0 transition-all
                      ${isActive ? 'bg-indigo-600 text-white shadow-inner' : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-indigo-400'}`}
                    onClick={() => handleSelect(deck)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${isActive ? 'text-white' : 'text-zinc-100'}`}>{deck}</span>
                    </div>
                    {isNew ? (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400'}`}>New Deck</span>
                    ) : (
                      frequencies[deck] > 0 && (
                        <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white/60' : 'text-zinc-600'}`}>
                          {frequencies[deck]} matches
                        </span>
                      )
                    )}
                  </div>
                );
              })
            ) : inputValue && (
              <div className="p-8 text-center text-zinc-500 italic text-sm">
                No matching decks. Press <kbd className="bg-zinc-800 px-1 rounded font-mono text-xs">Enter</kbd> to add "{inputValue}".
              </div>
            )}
          </div>

          {sortedSuggestions.length > 50 && (
            <div className="p-3 bg-zinc-950/50 text-center text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] border-t border-zinc-800/50">
              Top 50 of {sortedSuggestions.length} Results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
