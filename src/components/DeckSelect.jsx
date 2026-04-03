import React, { useState, useEffect, useRef } from 'react';
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
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setFrequencies(JSON.parse(saved));
    } catch (e) { console.error('Failed to load frequencies', e); }
  }, []);

  const incrementFreq = (deck) => {
    const newFreq = { ...frequencies, [deck]: (frequencies[deck] || 0) + 1 };
    setFrequencies(newFreq);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFreq));
  };

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
    let list = availableDecks.filter(d => !selectedDecks.includes(d));
    if (inputValue) {
      const normalizedInv = toKatakana(inputValue.toLowerCase());
      list = list.filter(d => toKatakana(d.toLowerCase()).includes(normalizedInv));
    }
    list.sort((a, b) => a.localeCompare(b, 'ja'));
    if (inputValue && !list.some(d => d.toLowerCase() === inputValue.toLowerCase()) && !selectedDecks.includes(inputValue)) {
      list.unshift(inputValue);
    }
    return list;
  }, [availableDecks, selectedDecks, inputValue]);

  const handleSelect = (deck) => {
    if (!deck.trim()) return;
    onChange([...selectedDecks, deck.trim()].sort((a, b) => a.localeCompare(b, 'ja')));
    incrementFreq(deck.trim());
    setInputValue('');
  };

  const handleRemove = (deck) => {
    onChange(selectedDecks.filter(d => d !== deck));
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sortedSuggestions.length > 0) {
        handleSelect(sortedSuggestions[0]);
      } else if (inputValue) {
        handleSelect(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedDecks.length > 0) {
      handleRemove(selectedDecks[selectedDecks.length - 1]);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Container is now static border to avoid IME cut-off during paint changes */}
      <div 
        className="flex flex-wrap gap-2 items-center min-h-[48px] p-2 bg-zinc-900 border border-zinc-800 rounded-xl cursor-text shadow-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedDecks.map(deck => (
          <span key={deck} className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 text-[11px] font-black px-2 py-1 rounded-lg border border-indigo-500/20">
            {deck}
            <button type="button" onClick={(e) => { e.stopPropagation(); handleRemove(deck); }} className="hover:text-white p-0.5"><X className="w-3 h-3" /></button>
          </span>
        ))}
        
        <div className="flex-1 flex items-center min-w-[120px]">
          <Search className="w-4 h-4 mr-2 text-zinc-600" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-zinc-100 focus:outline-none text-sm placeholder-zinc-700"
            placeholder={selectedDecks.length === 0 ? placeholder : ""}
            value={inputValue}
            autoComplete="off"
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {isFocused && (inputValue || availableDecks.length > 0) && (
        <div className="absolute z-[100] w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1 duration-200">
          {sortedSuggestions.length > 0 ? (
            sortedSuggestions.slice(0, 30).map((deck) => (
              <div
                key={deck}
                className="px-4 py-3 cursor-pointer text-sm text-zinc-300 border-b border-zinc-800/30 font-bold hover:bg-zinc-800 hover:text-white transition-colors"
                onClick={() => handleSelect(deck)}
              >
                {deck}
                {!availableDecks.includes(deck) && <span className="ml-2 text-[8px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-black">NEW</span>}
              </div>
            ))
          ) : inputValue && (
            <div className="p-6 text-center text-zinc-600 text-[10px] uppercase font-black tracking-widest italic">Hit Enter to add "{inputValue}"</div>
          )}
        </div>
      )}
    </div>
  );
}
  );
}
