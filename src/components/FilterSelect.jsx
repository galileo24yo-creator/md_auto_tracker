import React, { useState, useEffect, useRef, memo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const toKatakana = (str) => {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
};

const FilterSelect = memo(({ options, value, onChange, placeholder = "選択してください" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedFilteredOptions = React.useMemo(() => {
    let list = options.slice();
    if (searchValue) {
      const normalizedInput = toKatakana(searchValue.toLowerCase());
      list = list.filter(o => toKatakana(o.toLowerCase()).includes(normalizedInput));
    }
    return list.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [options, searchValue]);

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearchValue('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[10px] min-w-[100px] max-w-[150px] outline-none focus:ring-1 focus:ring-indigo-500 hover:border-zinc-700 transition-all text-left"
      >
        <span className="truncate">{value === 'ALL' ? placeholder : value}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[150] right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-top-1 duration-200">
          <div className="p-3 border-b border-zinc-800/50 bg-black/20 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              autoFocus
              type="text"
              placeholder="デッキ名を検索..."
              className="bg-transparent border-none text-[11px] text-zinc-100 outline-none w-full"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter' && sortedFilteredOptions.length > 0) {
                handleSelect(sortedFilteredOptions[0]);
              }
            }}
            />
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar bg-zinc-900">
            <div
              className={`px-4 py-2.5 cursor-pointer text-[11px] border-b border-zinc-800/30 font-black tracking-widest
                ${value === 'ALL' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
              onClick={() => handleSelect('ALL')}
            >
              {placeholder} (すべて)
            </div>
            {sortedFilteredOptions.map((opt) => (
              <div
                key={opt}
                className={`px-4 py-2.5 cursor-pointer text-[11px] flex items-center justify-between border-b border-zinc-800/30 transition-all
                  ${value === opt ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-indigo-400'}`}
                onClick={() => handleSelect(opt)}
              >
                <span className="font-bold truncate">{opt}</span>
              </div>
            ))}
            {sortedFilteredOptions.length === 0 && searchValue && (
              <div className="p-4 text-center text-[10px] text-zinc-600 italic">見つかりません</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default FilterSelect;
