import React, { useMemo, useState, useEffect, memo, useCallback, useRef, useTransition } from 'react';
import { toPng } from 'html-to-image';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Copy, Check, ExternalLink as LinkIcon, Trophy, Swords, XCircle, TrendingUp, Activity, Download, ArrowLeftRight, Pencil, Save, Loader2, Trash2, Settings, Plus, ExternalLink, Calendar, ChevronLeft, ChevronRight, X, Camera } from 'lucide-react';
import { postData } from '../lib/api';
import DeckSelect from './DeckSelect';
import FilterSelect from './FilterSelect';
import SmartInsights from './SmartInsights';
import FactorAnalysis from './FactorAnalysis';
import { normalizeTheme, normalizeThemeString } from '../lib/themeUtils';
import { useMatchAnalytics, COLORS, getFilteredRecords, getRankings } from '../hooks/useMatchAnalytics';
import { RatingWidget, WinRateWidget, RecentMatchesWidget, CauseTrendWidget, MatchupWinRateWidget, TurnStatsWidget, StreakWidget, SummaryBarWidget, MyDeckStatsWidget, MatchupTableWidget } from './VisualBoard';

// ==========================================
// Sub-components (Memoized)
// ==========================================

const StatCard = memo(({ title, value, icon, color = "text-zinc-100" }) => (
  <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center relative overflow-hidden group shadow-lg">
    <div className="text-zinc-300 text-[10px] mb-1 font-black uppercase tracking-widest z-10">{title}</div>
    <div className={`text-3xl font-black z-10 ${color}`}>{value}</div>
    {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity duration-300 transform group-hover:scale-110">{icon}</div>}
  </div>
));

const VisualWidgetLink = memo(({ title, url, description, children }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col shadow-xl">
      <div className="h-48 bg-black/40 relative overflow-hidden p-6 flex items-center justify-center">
        <div className="w-full h-full relative z-0">
          {children}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/20 to-transparent opacity-80 group-hover:opacity-40 transition-opacity" />
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-3 bg-indigo-500 rounded-full" />
          <h4 className="text-zinc-100 font-extrabold uppercase text-[11px] tracking-wider group-hover:text-indigo-400 transition-colors">{title}</h4>
        </div>
        <p className="text-zinc-500 text-[10px] font-bold mb-6 line-clamp-2 leading-relaxed">{description}</p>
        <div className="mt-auto flex gap-2">
          <button 
            onClick={handleCopy} 
            className={`flex-1 ${copied ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/50'} border py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy URL"}
          </button>
          <a 
            href={url} 
            target="_blank" 
            rel="noreferrer" 
            className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20 transition-all"
          >
            <LinkIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
});

const DualRangeSlider = ({ min, max, value, onChange }) => {
  const [minVal, setMinVal] = useState(value[0]);
  const [maxVal, setMaxVal] = useState(value[1]);
  useEffect(() => { setMinVal(value[0]); setMaxVal(value[1]); }, [value]);

  const handleMinChange = (e) => {
    const v = Math.min(Number(e.target.value), maxVal);
    setMinVal(v); onChange([v, maxVal]);
  };
  const handleMaxChange = (e) => {
    const v = Math.max(Number(e.target.value), minVal);
    setMaxVal(v); onChange([minVal, v]);
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[8px] font-black text-zinc-600 uppercase w-12 shrink-0">Start</span>
        <div className="relative flex-1 group">
          <input 
            type="range" min={min} max={max} value={minVal} onChange={handleMinChange} 
            className="w-full h-1 bg-zinc-800 rounded-full appearance-none outline-none focus:ring-1 focus:ring-indigo-500/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125" 
          />
        </div>
        <span className="text-[10px] font-black text-zinc-300 w-6 text-center">{minVal}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[8px] font-black text-zinc-600 uppercase w-12 shrink-0">End</span>
        <div className="relative flex-1 group">
          <input 
            type="range" min={min} max={max} value={maxVal} onChange={handleMaxChange} 
            className="w-full h-1 bg-zinc-800 rounded-full appearance-none outline-none focus:ring-1 focus:ring-indigo-500/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125" 
          />
        </div>
        <span className="text-[10px] font-black text-zinc-300 w-6 text-center">{maxVal}</span>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-2xl ring-1 ring-white/5">
        <p className="text-[9px] text-zinc-500 font-mono mb-1">{data.date}</p>
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-xs font-bold text-zinc-200">{data.opponentDeck || data.OpponentDeck}</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${data.result === 'WIN' || (String(data.result).toUpperCase().includes('VIC')) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{data.result}</span>
        </div>
        <div className="text-lg font-black text-indigo-400">Rate: {data.rating}</div>
      </div>
    );
  }
  return null;
};

const MatchList = memo(({ records, onSelect }) => {
  const [displayCount, setDisplayCount] = useState(30);
  
  // フィルター変更時に表示数をリセット
  useEffect(() => {
    setDisplayCount(30);
  }, [records]);

  const displayedRecords = records.slice(0, displayCount);
  const hasMore = records.length > displayCount;

  return (
    <div className="bg-zinc-800/80 p-5 rounded-xl border border-zinc-700/50 flex flex-col h-full shadow-lg">
      <h3 className="text-zinc-300 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center justify-between">
        Match History
        <span className="text-zinc-500 font-normal">{records.length} matches</span>
      </h3>
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {displayedRecords.map((r, i) => {
          const myDeckStr = r._myThemes && r._myThemes.length > 0 ? r._myThemes.join(' + ') : (r.myDeck || "---");
          const oppDeckStr = r._oppThemes && r._oppThemes.length > 0 ? r._oppThemes.join(' + ') : (r.opponentDeck || "---");
          
          return (
            <button key={i} onClick={() => onSelect(r)} className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800 text-sm hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all group">
              <div className="flex flex-col flex-1 mx-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-xs mr-1 shrink-0">
                    {oppDeckStr}
                  </span>
                  {(r.memo || r.Memo) && String(r.memo || r.Memo).split(/[,、，]+/).map((rawTag, idx) => {
                    const tag = rawTag.trim();
                    const isPos = tag.includes('[+]') || tag.includes('［＋］');
                    const isNeg = tag.includes('[-]') || tag.includes('［－］');
                    const colorClass = isPos ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : isNeg ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300';
                    return <span key={idx} className={`px-1.5 py-0.5 rounded border ${colorClass} text-[9px] font-bold whitespace-nowrap`}>{tag}</span>;
                  })}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                  <span className="text-zinc-500">MY:</span>
                  <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">{myDeckStr}</span>
                </div>
                <span className="text-[8px] text-zinc-400 uppercase tracking-widest font-bold mt-1">{String(r.date || "").split(' ')[0]} • {r.mode} • {r.turn}</span>
              </div>
              <div className={`font-black px-3 py-1 rounded-full text-[10px] ${r._isWin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{r._isWin ? 'WIN' : 'LOSE'}</div>
            </button>
          );
        })}
        
        {hasMore && (
          <button 
            onClick={() => setDisplayCount(prev => prev + 50)}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest rounded-lg border border-zinc-800 transition-all active:scale-95"
          >
            Show More (+50)
          </button>
        )}
        
        {records.length === 0 && <div className="h-full flex items-center justify-center text-zinc-600 italic text-xs">NO DATA</div>}
      </div>
    </div>
  );
});

const MatchupRankings = memo(({ data, tab, onTabChange, minLimit, onLimitChange, onDeckClick, currentDecks }) => (
  <div className="bg-zinc-800/80 p-5 rounded-xl border border-zinc-700/50 flex flex-col h-full shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-zinc-300 text-[10px] font-black uppercase tracking-widest">Matchup Analysis</h3>
        <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
          {['FREQ', 'WORST', 'BEST'].map(t => {
            const isActive = tab === t;
            const theme = 
              t === 'FREQ' ? (isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-600 hover:text-indigo-400') :
              t === 'BEST' ? (isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-zinc-600 hover:text-emerald-400') :
              (isActive ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-zinc-600 hover:text-rose-400');

            return (
              <button 
                key={t} 
                onClick={() => onTabChange(t)} 
                className={`px-3 py-1 text-[9px] font-black rounded-md transition-all uppercase ${theme}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      <select value={minLimit} onChange={(e) => onLimitChange(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 text-zinc-400 rounded px-1.5 py-0.5 text-[9px] font-bold">
        {[1, 3, 5].map(v => <option key={v} value={v}>{v}+ matches</option>)}
      </select>
    </div>
    <div className="flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-left border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[#27272a]">
          <tr className="text-zinc-400 text-[9px] font-black uppercase tracking-wider">
            <th className="pb-2 pr-4 border-b border-zinc-800">Deck</th>
            <th className="pb-2 px-2 text-center border-b border-zinc-800">Total</th>
            <th className="pb-2 px-2 text-right border-b border-zinc-800">Win%</th>
            <th className="pb-2 px-2 text-right border-b border-zinc-800">1st Rate</th>
            <th className="pb-2 px-2 text-right border-b border-zinc-800">1st Win</th>
            <th className="pb-2 pl-2 text-right border-b border-zinc-800">2nd Win</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/30">
          {data.map((d, i) => {
            const isSelected = currentDecks.join(' + ') === d.name;
            return (
              <tr key={i} className={`group hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-indigo-500/5' : ''}`}>
                <td className="py-2.5 pr-4 text-xs font-bold">
                  <button 
                    onClick={() => onDeckClick(d.name)}
                    className={`truncate max-w-[90px] block transition-colors text-left ${isSelected ? 'text-indigo-400 font-black' : 'text-zinc-200 group-hover:text-indigo-400'}`} 
                    title={d.name}
                  >
                    {d.name}
                    {isSelected && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />}
                  </button>
                </td>
                <td className="py-2.5 px-2 text-center font-mono text-zinc-400 text-[10px]">{d.total}</td>
                <td className={`py-2.5 px-2 text-right font-black text-xs ${d.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.winRate.toFixed(0)}%</td>
                <td className="py-2.5 px-2 text-right text-zinc-400 text-[10px]">{d.firstRate.toFixed(0)}%</td>
                <td className={`py-2.5 px-2 text-right text-[10px] ${d.firstWinRate >= 50 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{d.firstWinRate.toFixed(0)}%</td>
                <td className={`py-2.5 pl-2 text-right text-[10px] ${d.secondWinRate >= 50 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{d.secondWinRate.toFixed(0)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
));

// ==========================================
// Data Processing Utilities (Pure Functions)
// ==========================================
// DateRange Selector Modal
// ==========================================

const CalendarModal = memo(({ isOpen, onClose, startDate, endDate, onApply }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tempStart, setTempStart] = useState(startDate ? new Date(startDate) : null);
  const [tempEnd, setTempEnd] = useState(endDate ? new Date(endDate) : null);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDayClick = (day) => {
    const selected = new Date(year, month, day);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(selected);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (selected < tempStart) {
        setTempEnd(tempStart);
        setTempStart(selected);
      } else {
        setTempEnd(selected);
      }
    }
  };

  const isSelected = (d) => {
    const target = new Date(year, month, d);
    if (tempStart && target.toDateString() === tempStart.toDateString()) return 'start';
    if (tempEnd && target.toDateString() === tempEnd.toDateString()) return 'end';
    if (tempStart && tempEnd && target > tempStart && target < tempEnd) return 'between';
    return null;
  };

  const formatDateLabel = (d) => d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : "---";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100">Select Range</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-sm font-black text-white">{year} / {month + 1}</div>
            <button onClick={nextMonth} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[10px] font-black text-zinc-600 pb-2">{d}</div>)}
            {Array(firstDay).fill(0).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(d => {
              const state = isSelected(d);
              return (
                <button 
                  key={d} 
                  onClick={() => handleDayClick(d)}
                  className={`aspect-square text-[10px] font-bold rounded-lg transition-all flex items-center justify-center
                    ${state === 'start' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 
                      state === 'end' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 
                      state === 'between' ? 'bg-indigo-500/20 text-indigo-400' : 
                      'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-center">
              <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">From</div>
              <div className="text-[10px] font-bold text-zinc-300">{formatDateLabel(tempStart)}</div>
            </div>
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 text-center">
              <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">To</div>
              <div className="text-[10px] font-bold text-zinc-300">{formatDateLabel(tempEnd)}</div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white/[0.01] border-t border-zinc-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={() => onApply(tempStart, tempEnd)} 
            disabled={!tempStart}
            className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/20 transition-all"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );
});

// ==========================================
// Main Dashboard
// ==========================================

export default function Dashboard({ records, onRefresh, decks, reasons, displayReasons, activeProfile }) {
  const [filterMode, setFilterMode] = useState('ALL');
  const [filterDateType, setFilterDateType] = useState('30D');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [chunkSize, setChunkSize] = useState('ALL');
  const [setRange, setSetRange] = useState([1, 1]);
  const [filterMyDecks, setFilterMyDecks] = useState([]);
  const [filterOpponentDecks, setFilterOpponentDecks] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [matchupTab, setMatchupTab] = useState('WORST');
  const [minMatchLimit, setMinMatchLimit] = useState(3);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettingsEditor, setShowSettingsEditor] = useState(false);
  const [editingDecks, setEditingDecks] = useState(decks || []);
  const [editingReasons, setEditingReasons] = useState(reasons || []);
  const [newTagTrait, setNewTagTrait] = useState('negative'); // 'positive' | 'negative'
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [activeWidget, setActiveWidget] = useState('rating');
  const [showNotification, setShowNotification] = useState(false);
  const [isPending, startTransition] = useTransition(); 
  const widgetRef = useRef(null);

  // モーダルが閉じられたら状態をリセット
  useEffect(() => {
    if (!selectedMatch) {
      setIsEditing(false);
      setIsConfirmingDelete(false);
    }
  }, [selectedMatch]);

  // 【階層リセットロジック】
  // L1 (期間・モード) が変更されたら、L2 (セット指定) と L3 (詳細フィルタ) をリセット
  useEffect(() => {
    setSetRange([1, 1]);
    setFilterMyDecks([]);
    setFilterOpponentDecks([]);
    setFilterTags([]);
  }, [filterDateType, filterMode, startDate, endDate]);

  // L2 (セット指定) が変更されたら、L3 (詳細フィルタ) をリセット
  // chunkSize の変更も L2 の構造自体を変えるため、L3 をリセットする
  useEffect(() => {
    setFilterMyDecks([]);
    setFilterOpponentDecks([]);
    setFilterTags([]);
  }, [setRange, chunkSize]);

  const handleSaveImage = async () => {
    if (!widgetRef.current) return;
    try {
      const dataUrl = await toPng(widgetRef.current, { 
        backgroundColor: '#09090b',
        style: { borderRadius: '0' },
        pixelRatio: 2
      });
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `MatchReport_${activeWidget}_${timestamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save image:', err);
    }
  };

  const handleCopyOBSUrl = () => {
    const urlParams = new URLSearchParams();
    urlParams.set('view', 'obs');
    if (activeWidget !== 'full') urlParams.set('widget', activeWidget);
    urlParams.set('gas_url', activeProfile?.url || "");
    urlParams.set('dateType', filterDateType);
    urlParams.set('mode', filterMode);
    urlParams.set('myDecks', filterMyDecks.join(','));
    urlParams.set('opponentDecks', filterOpponentDecks.join(','));
    urlParams.set('tags', filterTags.join(','));
    urlParams.set('startDate', startDate);
    urlParams.set('endDate', endDate);
    urlParams.set('chunkSize', chunkSize);
    urlParams.set('setRange', setRange.join('-'));

    const url = `${window.location.origin}${window.location.pathname}?${urlParams.toString()}`;
    navigator.clipboard.writeText(url);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
  };

  const startEditing = () => {
    setEditData({
      mode: selectedMatch.mode || "ランク",
      turn: selectedMatch.turn || "先",
      result: String(selectedMatch.result).toUpperCase().includes('VIC') || selectedMatch.result === 'WIN' ? 'VICTORY' : 'LOSE',
      myDeck: selectedMatch.myDeck ? String(selectedMatch.myDeck).split(/[,、，]+/).map(t => String(t).trim()).filter(Boolean) : [],
      oppDeck: selectedMatch.opponentDeck ? String(selectedMatch.opponentDeck).split(/[,、，]+/).map(t => String(t).trim()).filter(Boolean) : [],
      diff: selectedMatch.diff || selectedMatch.rating || "",
      memo: selectedMatch.memo ? String(selectedMatch.memo).split(/[,、，]+/).map(t => String(t).trim()).filter(Boolean) : []
    }); setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      if (!selectedMatch) return;
      setIsSaving(true);
      const payload = {
        id: selectedMatch.date,
        mode: editData.mode || "ランク戦",
        turn: editData.turn || "先",
        result: editData.result || "VICTORY",
        myDeck: Array.isArray(editData.myDeck) ? editData.myDeck.join(', ') : "",
        opponentDeck: Array.isArray(editData.oppDeck) ? editData.oppDeck.join(', ') : "",
        diff: editData.diff || "",
        memo: Array.isArray(editData.memo) ? editData.memo.join(', ') : ""
      };
      const res = await postData(payload);
      if (res?.success) {
        if (onRefresh) await onRefresh();
        setSelectedMatch(null);
        setIsEditing(false);
      } else {
        alert("保存エラー: " + (res?.error || "不明なエラー"));
      }
    } catch (e) {
      alert("致命的なエラーが発生しました: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    try {
      if (!selectedMatch) return;
      setIsSaving(true);
      const res = await postData({ action: 'DELETE_RECORD', id: selectedMatch.date });
      if (res?.success) {
        if (onRefresh) await onRefresh();
        setSelectedMatch(null);
        setIsConfirmingDelete(false);
      } else {
        alert("削除エラー: " + (res?.error || "データが見つかりません。"));
        setIsConfirmingDelete(false);
      }
    } catch (e) {
      alert("致命的なエラーが発生しました: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const res = await postData({ action: 'UPDATE_SETTINGS', decks: editingDecks, reasons: editingReasons });
    if (res?.success) { if (onRefresh) await onRefresh(); setShowSettingsEditor(false); }
    else { alert("Error: " + (res?.error || "Update failed")); }
    setIsSaving(false);
  };

  const exportToCSV = () => {
    if (!filteredRecords.length) return;
    const h = ["Date", "Mode", "MyDeck", "OpponentDeck", "Result", "Turn", "Diff", "Memo"];
    const r = filteredRecords.map(m => [m.date, m.mode, m.myDeck, m.opponentDeck, m.result, m.turn, m.diff, m.memo].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    const b = new Blob(["\uFEFF" + [h.join(","), ...r].join("\n")], { type: 'text/csv;charset=utf-8;' });
    const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.setAttribute("download", `MD_Matches.csv`); l.click();
  };

  const scopeFilteredRecords = useMemo(() => {
    return getFilteredRecords(records, { mode: filterMode, dateType: filterDateType, startDate, endDate });
  }, [records, filterMode, filterDateType, startDate, endDate]);

  const analyticsFilters = useMemo(() => ({
    mode: filterMode,
    myDecks: filterMyDecks,
    opponentDecks: filterOpponentDecks,
    tags: filterTags,
    dateType: filterDateType,
    startDate,
    endDate,
    chunkSize,
    setRange
  }), [filterMode, filterMyDecks, filterOpponentDecks, filterTags, filterDateType, startDate, endDate, chunkSize, setRange]);

  const { filteredRecords, stats, trendData, tagTrendData, myDeckStats, rankings } = useMatchAnalytics(records, analyticsFilters);

  // 【階層2レコードの定義】
  // 期間・モードで絞り込まれた scopeFilteredRecords から、セット番号(chunkSize, setRange)で切り出したもの
  const l2FilteredRecords = useMemo(() => {
    if (chunkSize === 'ALL') return scopeFilteredRecords;
    // 日付順（新しい順）であることを前提にスライス
    // getFilteredRecords はソートしないため、ここで念のためソートを考慮するか、
    // App側でソート済みであることを期待する（現状、Dashboardの表示は新しい順が基本）
    const size = parseInt(chunkSize, 10);
    const start = (setRange[0] - 1) * size;
    const end = setRange[1] * size;
    return scopeFilteredRecords.slice(start, end);
  }, [scopeFilteredRecords, chunkSize, setRange]);

  const totalSets = useMemo(() => {
    const s = parseInt(chunkSize, 10);
    return chunkSize === 'ALL' ? 1 : Math.max(1, Math.ceil(scopeFilteredRecords.length / s));
  }, [scopeFilteredRecords.length, chunkSize]);

  const availableMyThemes = useMemo(() => {
    const s = new Set();
    scopeFilteredRecords.forEach(r => { 
      if (r._myThemes) r._myThemes.forEach(t => s.add(t));
    });
    return Array.from(s).sort();
  }, [scopeFilteredRecords]);

  const availableOpponentThemes = useMemo(() => {
    const s = new Set();
    scopeFilteredRecords.forEach(r => { 
      if (r._oppThemes) r._oppThemes.forEach(t => s.add(t));
    });
    return Array.from(s).sort();
  }, [scopeFilteredRecords]);

  const nextAvailableMyThemes = useMemo(() => {
    const subset = getFilteredRecords(l2FilteredRecords, { myDecks: filterMyDecks, opponentDecks: filterOpponentDecks, tags: filterTags });
    const s = new Set();
    subset.forEach(r => {
      if (r._myThemes) r._myThemes.forEach(t => s.add(t));
    });
    return Array.from(s).sort();
  }, [l2FilteredRecords, filterMyDecks, filterOpponentDecks, filterTags]);

  const nextAvailableOpponentThemes = useMemo(() => {
    const subset = getFilteredRecords(l2FilteredRecords, { myDecks: filterMyDecks, opponentDecks: filterOpponentDecks, tags: filterTags });
    const s = new Set();
    subset.forEach(r => {
      if (r._oppThemes) r._oppThemes.forEach(t => s.add(t));
    });
    return Array.from(s).sort();
  }, [l2FilteredRecords, filterMyDecks, filterOpponentDecks, filterTags]);

  const nextAvailableTags = useMemo(() => {
    const subset = getFilteredRecords(l2FilteredRecords, { myDecks: filterMyDecks, opponentDecks: filterOpponentDecks, tags: filterTags });
    const s = new Set();
    subset.forEach(r => {
      const val = r.memo || r.Memo;
      if (val) String(val).split(/[,、，]+/).forEach(t => {
        const tag = String(t).trim();
        if (tag) s.add(tag);
      });
    });
    return Array.from(s).sort();
  }, [l2FilteredRecords, filterMyDecks, filterOpponentDecks, filterTags]);

  const opponentDeckData = useMemo(() => {
    const c = {};
    filteredRecords.forEach(r => { 
      if (r.opponentDeck) { 
        const d = normalizeThemeString(r.opponentDeck);
        if (d) c[d] = (c[d] || 0) + 1; 
      } 
    });
    const s = Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a,b) => b.value - a.value);
    if (s.length <= 7) return s; 
    return [...s.slice(0, 6), { name: "その他", value: s.slice(6).reduce((a, x) => a + x.value, 0) }];
  }, [filteredRecords]);

  const myDeckWinRateData = useMemo(() => {
    const s = {};
    filteredRecords.forEach(r => { 
      const mDeck = r.myDeck || r.MyDeck;
      if (mDeck) { 
        const d = normalizeThemeString(mDeck);
        if (!d) return; 
        if (!s[d]) s[d] = { w: 0, t: 0 }; 
        s[d].t++; 
        if (String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN') s[d].w++; 
      } 
    });
    return Object.entries(s).map(([n, v]) => ({ name: n, winRate: parseFloat(((v.w / v.t) * 100).toFixed(1)), total: v.t })).sort((a,b) => b.total - a.total).slice(0, 5);
  }, [filteredRecords]);

  const matchupData = useMemo(() => {
    const v = getRankings(filteredRecords, minMatchLimit);
    if (matchupTab === 'FREQ') return v.sort((a,b) => b.total - a.total);
    if (matchupTab === 'WORST') return v.sort((a,b) => a.winRate - b.winRate);
    return v.sort((a,b) => b.winRate - a.winRate);
  }, [filteredRecords, matchupTab, minMatchLimit]);

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500" /> Match Analytics</h2>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-end">
              <div className="flex items-center gap-2 mr-1">
                <button onClick={exportToCSV} className="px-3 py-1.5 bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
                <button onClick={() => { setEditingDecks(decks); setEditingReasons(reasons); setShowSettingsEditor(true); }} className="px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400/80 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"><Settings className="w-3.5 h-3.5" /> Decks</button>
                {activeProfile?.sheetUrl && (
                  <a 
                    href={activeProfile.sheetUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400/80 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Sheets
                  </a>
                )}
              </div>
              <div className="hidden md:block w-px h-4 bg-zinc-800 mx-1 shrink-0" />
              <select 
                value={filterDateType} 
                onChange={(e) => { 
                  const next = e.target.value;
                  startTransition(() => {
                    setFilterDateType(next); 
                    setSetRange([1, 1]); 
                  });
                }} 
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 h-[42px] min-w-[120px]"
              >
                <option value="ALL">期間: すべて</option>
                <option value="TODAY">期間: 今日</option>
                <option value="7D">期間: 過去7日</option>
                <option value="30D">期間: 過去30日</option>
                <option value="CUSTOM">期間: カスタム</option>
              </select>
              
              {filterDateType === 'CUSTOM' && (
                <button 
                  onClick={() => setIsDateModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase hover:bg-indigo-500/20 transition-all animate-in slide-in-from-right-2 h-[42px]"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {startDate ? `${startDate.split('-').slice(1).join('/')} - ${endDate ? endDate.split('-').slice(1).join('/') : '...'}` : '期間を選択'}
                </button>
              )}

              <select 
                value={filterMode} 
                onChange={(e) => { 
                  const next = e.target.value;
                  startTransition(() => {
                    setFilterMode(next); 
                    setSetRange([1, 1]); 
                  });
                }} 
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 h-[42px] min-w-[120px]"
              >
                <option value="ALL">モード: 全て</option>
                <option value="ランク戦">モード: ランク</option>
                <option value="レート戦">モード: レート</option>
                <option value="DC">モード: DC</option>
              </select>

              <select value={chunkSize} onChange={(e) => { setChunkSize(e.target.value); setSetRange([1, 1]); }} className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 h-[42px] min-w-[120px]">
                <option value="ALL">全ての試合</option>
                <option value="5">5戦単位</option>
                <option value="10">10戦単位</option>
                <option value="20">20戦単位</option>
                <option value="30">30戦単位</option>
                <option value="50">50戦単位</option>
              </select>
            </div>

            <div className="flex items-center gap-3 flex-wrap md:flex-nowrap justify-end max-w-[85%] ml-auto">
              <div className="flex-1 min-w-[200px] max-w-[320px]">
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1 ml-1 text-center border-b border-zinc-800 pb-1">My Themes (実績から提案)</div>
                <DeckSelect 
                  availableDecks={nextAvailableMyThemes} 
                  selectedDecks={filterMyDecks} 
                  onChange={(v) => { 
                    startTransition(() => {
                      setFilterMyDecks(v); 
                    });
                  }} 
                  placeholder="自分のテーマを選択..." 
                />
              </div>

              <div className="flex-1 min-w-[200px] max-w-[320px]">
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1 ml-1 text-center border-b border-zinc-800 pb-1">Opponent Themes (実績から提案)</div>
                <DeckSelect 
                  availableDecks={nextAvailableOpponentThemes} 
                  selectedDecks={filterOpponentDecks} 
                  onChange={(v) => { 
                    startTransition(() => {
                      setFilterOpponentDecks(v); 
                    });
                  }} 
                  placeholder="相手のテーマを選択..." 
                />
              </div>

              <div className="flex-1 min-w-[180px] max-w-[280px]">
                <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1 ml-1 text-center border-b border-zinc-800 pb-1">Factors & Tags (実績から提案)</div>
                <DeckSelect 
                  availableDecks={nextAvailableTags} 
                  selectedDecks={filterTags} 
                  onChange={(v) => { 
                    startTransition(() => {
                      setFilterTags(v); 
                    });
                  }} 
                  placeholder="タグを選択..." 
                />
              </div>
            </div>
          </div>
        </div>
        {chunkSize !== 'ALL' && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Select Set Context</span>
                <span className="text-[11px] text-indigo-400 font-bold truncate sm:text-right">
                  {setRange[0] === setRange[1] ? `Set ${setRange[0]}` : `Sets ${setRange[0]} - ${setRange[1]}`}
                  <span className="text-zinc-600 mx-2">|</span>
                  Recent { (setRange[0]-1) * parseInt(chunkSize, 10) + 1 } - { Math.min(setRange[1] * parseInt(chunkSize, 10), scopeFilteredRecords.length) } Matches
                  <span className="text-[9px] text-zinc-500 font-normal ml-2 tracking-tighter">(Total {scopeFilteredRecords.length})</span>
                </span>
              </div>
              <DualRangeSlider min={1} max={totalSets} value={setRange} onChange={setSetRange} />
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-zinc-900 mb-6 px-1 overflow-x-auto no-scrollbar">
        {['overview', 'insights', 'factors', 'visuals'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            className={`px-10 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'insights' ? 'AI Insights' : tab === 'factors' ? 'Factors' : 'Visuals'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className={`animate-in fade-in duration-500 space-y-6 transition-opacity ${isPending ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Count" value={stats.total} icon={<Swords className="w-5 h-5 text-indigo-500" />} />
            <StatCard title="Win%" value={`${stats.winRate}%`} color="text-emerald-400" />
            <StatCard title="1st Rate" value={`${stats.fRate}%`} color="text-zinc-400" />
            <StatCard title="1st Win%" value={`${stats.fWinRate}%`} color="text-indigo-400" />
            <StatCard title="2nd Win%" value={`${stats.sWinRate}%`} color="text-orange-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl h-[340px] flex flex-col shadow-lg overflow-hidden group">
              <h3 className="text-zinc-400 text-[9px] font-black uppercase mb-4 text-center tracking-widest group-hover:text-white transition-colors">Opponent Deck Meta</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={opponentDeckData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={55} 
                      outerRadius={75} 
                      paddingAngle={2} 
                      dataKey="value" 
                      stroke="none"
                      onClick={(data) => {
                        if (data && data.name && data.name !== 'その他') {
                          const themes = data.name.split(' + ');
                          setFilterOpponentDecks(prev => prev.length === themes.length && prev.every((t, idx) => t === themes[idx]) ? [] : themes);
                        }
                      }}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    >
                      {opponentDeckData.map((e, i) => <Cell key={i} fill={e.name === 'その他' ? '#71717a' : COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #18181b', borderRadius: '12px', fontSize: '11px' }} />
                    <Legend 
                      verticalAlign="bottom" 
                      iconType="circle" 
                      wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} 
                      formatter={(value) => <span className={value === 'その他' ? 'text-zinc-300 font-bold' : 'text-zinc-400'}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl h-[340px] flex flex-col shadow-lg overflow-hidden group">
              <h3 className="text-zinc-400 text-[9px] font-black uppercase mb-6 text-center tracking-widest group-hover:text-white transition-colors">Performance by My Deck</h3>
              <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                {myDeckWinRateData.map((d, i) => (
                  <div 
                    key={i} 
                    className="group/item cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 py-1 rounded-lg transition-all"
                    onClick={() => {
                      const themes = d.name.split(' + ');
                      setFilterMyDecks(prev => prev.length === themes.length && prev.every((t, idx) => t === themes[idx]) ? [] : themes);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-zinc-100 group-hover/item:text-indigo-400 transition-colors uppercase tracking-tight truncate max-w-[140px]" title={d.name}>{d.name}</span>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{d.total} matches</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black tracking-tighter ${d.winRate >= 50 ? 'text-emerald-400' : 'text-zinc-500'}`}>{d.winRate}%</span>
                        <span className="text-[8px] block text-zinc-500 font-black uppercase -mt-1 tracking-widest">WR</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 group-hover/item:border-zinc-700 transition-all">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,0,0,0.5)] 
                          ${d.winRate >= 60 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                            d.winRate >= 50 ? 'bg-gradient-to-r from-indigo-600 to-indigo-400' : 
                            'bg-gradient-to-r from-zinc-700 to-zinc-500'}`}
                        style={{ width: `${d.winRate}%` }}
                      />
                    </div>
                  </div>
                ))}
                {myDeckWinRateData.length === 0 && <div className="h-full flex items-center justify-center text-zinc-700 italic text-xs">No deck data available</div>}
              </div>
            </div>

            <div className="h-[400px]"><MatchList records={filteredRecords} onSelect={setSelectedMatch} /></div>
            <div className="h-[400px]"><MatchupRankings data={matchupData} tab={matchupTab} onTabChange={setMatchupTab} minLimit={minMatchLimit} onLimitChange={setMinMatchLimit} currentDecks={filterOpponentDecks} onDeckClick={(d) => { const themes = d.split(' + '); setFilterOpponentDecks(prev => prev.join(' + ') === d ? [] : themes); }} /></div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl">
          <SmartInsights records={filteredRecords} availableTags={displayReasons || reasons} />
        </div>
      )}

      {activeTab === 'factors' && (
        <FactorAnalysis records={filteredRecords} />
      )}

      {activeTab === 'visuals' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-2">
                <Activity className="w-6 h-6 text-indigo-500" />
                OBS Widget Manager
              </h3>
              <p className="text-zinc-500 text-xs font-bold leading-relaxed">
                配信画面に重ねるウィジェットを選択し、プレビューとURLを取得できます。
                背景は透過されるため、OBSの「ブラウザソース」としてそのまま追加可能です。
              </p>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shadow-inner gap-1">
              {[
                { id: 'rating', label: 'Rating' },
                { id: 'winrate', label: 'Rate' },
                { id: 'recent', label: 'Form' },
                { id: 'cause', label: 'Factors' },
                { id: 'matchup', label: 'Against' },
                { id: 'turn', label: 'Turn' },
                { id: 'streak', label: 'Streak' },
                { id: 'summary', label: 'Summ' },
                { id: 'mydecks', label: 'MyDeck' },
                { id: 'rankings', label: 'Rank' },
                { id: 'full', label: 'Board' }
              ].map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWidget(w.id)}
                  className={`px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center justify-center whitespace-nowrap ${activeWidget === w.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div className="w-full h-[600px] bg-black/40 rounded-[2.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden flex items-center justify-center p-12 group">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-[120px] rounded-full" />
              
              <div ref={widgetRef} className="relative z-10 w-full flex items-center justify-center bg-transparent animate-in zoom-in-95 duration-500">
                {activeWidget === 'full' && (
                  <div className="grid grid-cols-2 gap-4 w-full h-full grayscale opacity-20 pointer-events-none p-12">
                    <div className="bg-zinc-800 h-full rounded-3xl" /><div className="bg-zinc-800 h-full rounded-3xl" />
                    <div className="bg-zinc-800 h-full rounded-3xl" /><div className="bg-zinc-800 h-full rounded-3xl" />
                  </div>
                )}
                {activeWidget === 'rating' && <div className="w-full h-full"><RatingWidget data={trendData} /></div>}
                {activeWidget === 'winrate' && <div className="scale-125"><WinRateWidget stats={stats} /></div>}
                {activeWidget === 'recent' && <div className="scale-150 w-full"><RecentMatchesWidget form={stats.form} /></div>}
                {activeWidget === 'cause' && <div className="w-full h-full"><CauseTrendWidget data={tagTrendData} /></div>}
                {activeWidget === 'matchup' && <div className="w-full h-full"><MatchupWinRateWidget rankings={rankings} /></div>}
                {activeWidget === 'turn' && <div className="w-full h-full"><TurnStatsWidget stats={stats} /></div>}
                {activeWidget === 'streak' && <div className="w-full h-full"><StreakWidget streak={stats.streak} /></div>}
                {activeWidget === 'summary' && <div className="w-full h-full flex items-center"><SummaryBarWidget stats={stats} /></div>}
                {activeWidget === 'mydecks' && <div className="w-full h-full"><MyDeckStatsWidget myDeckStats={myDeckStats} /></div>}
                {activeWidget === 'rankings' && <div className="w-full h-full"><MatchupTableWidget rankings={rankings} /></div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 shadow-xl flex flex-col justify-center">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">
                        {activeWidget === 'full' ? 'Full Visual Board' : 
                         activeWidget === 'rating' ? 'Match Rating History' : 
                         activeWidget === 'winrate' ? 'Win Rate Stats' : 
                         activeWidget === 'recent' ? 'Recent Form' : 
                         activeWidget === 'matchup' ? 'Matchup Performance' : 
                         activeWidget === 'turn' ? 'Turn Specific Stats' : 
                         activeWidget === 'streak' ? 'Current Streak' : 
                         activeWidget === 'summary' ? 'Global Summary Bar' : 
                         activeWidget === 'mydecks' ? 'My Decks Performance' : 
                         activeWidget === 'rankings' ? 'Top Matchup Rankings' : 'Factors Trend'}
                      </h4>
                    </div>
                    <p className="text-zinc-500 text-xs font-bold leading-relaxed mb-4 md:mb-0">
                      {activeWidget === 'full' ? '全ての統計を統合した配信画面全体用のボードです。' : 
                       activeWidget === 'rating' ? '一戦ごとのレート変動をプロットした、以前のトレンドタブに近いグラフです。' : 
                       activeWidget === 'winrate' ? '本日の勝率、勝ち数、負け数を大きく一目でわかるように表示します。' : 
                       activeWidget === 'recent' ? '直近10試合の好不調をドット形式でビジュアル化します。' : 
                       activeWidget === 'matchup' ? 'よく当たるデッキごとの勝率を棒グラフで表示します。' : 
                       activeWidget === 'turn' ? '先攻・後攻それぞれの詳細な戦績を表形式で表示します。' : 
                       activeWidget === 'streak' ? '現在の連勝（連敗）数を大きく強調して表示します。' : 
                       activeWidget === 'summary' ? '主要な統計情報を横長のバーに凝縮。画面の上下に配置するのに最適です。' : 
                       activeWidget === 'mydecks' ? '今日使用した自分のデッキごとの勝率をリスト表示します。' : 
                       activeWidget === 'rankings' ? '対戦相手のデッキ分布と勝率をコンパクトな表で表示します。' : 'デッキの課題や勝因がどのように変化しているか分析します。'}
                    </p>
                  </div>

                  <div className="flex-1 space-y-3">
                    <label className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] ml-2">OBS Source URL & Export</label>
                    <div className="flex flex-col xl:flex-row gap-3">
                      <div className="flex-1 flex gap-2">
                        <input 
                          readOnly 
                          value={`${window.location.origin}${window.location.pathname}?view=obs${activeWidget === 'full' ? '' : `&widget=${activeWidget}`}&gas_url=${encodeURIComponent(activeProfile?.url || "")}&dateType=${filterDateType}&mode=${encodeURIComponent(filterMode)}&myDecks=${encodeURIComponent(filterMyDecks.join(','))}&opponentDecks=${encodeURIComponent(filterOpponentDecks.join(','))}&tags=${encodeURIComponent(filterTags.join(','))}&startDate=${startDate}&endDate=${endDate}&chunkSize=${chunkSize}&setRange=${setRange.join('-')}`}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-[9px] font-mono text-zinc-500 outline-none"
                        />
                        <button 
                          onClick={handleCopyOBSUrl}
                          className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 shrink-0"
                          title="Copy OBS URL"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                      <button
                        onClick={handleSaveImage}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        Save as PNG Image
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-2xl p-8 flex flex-col justify-center">
                <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> OBS Setup Tips
                </h5>
                <ul className="space-y-2 text-[11px] text-zinc-400 font-bold">
                  <li className="flex gap-2">• 背景を透明にするため「ブラウザソース」に追加してください。</li>
                  <li className="flex gap-2">• ソースの「カスタムCSS」は空のままでも動作します。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 animate-in fade-in" onClick={() => { setSelectedMatch(null); setIsEditing(false); }}>
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-8 flex items-center justify-between border-b border-zinc-800 bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl ${String(selectedMatch.result).toUpperCase().includes('VIC') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}><Trophy className="w-6 h-6" /></div>
                <div><h3 className="text-xl font-black uppercase tracking-tight">{isEditing ? "Edit Match" : "Summary"}</h3><p className="text-[10px] text-zinc-500 font-mono mt-0.5">{selectedMatch.date}</p></div>
              </div>
              {!isEditing && <button onClick={startEditing} className="p-3 text-indigo-400 hover:bg-zinc-800 rounded-2xl transition-all"><Pencil className="w-6 h-6" /></button>}
            </div>
            <div className="p-8 space-y-8">
              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <select value={editData.mode} onChange={e => setEditData({...editData, mode: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-indigo-500">
                      <option value="ランク戦">ランク戦</option>
                      <option value="レート戦">レート戦</option>
                      <option value="DC">DC</option>
                    </select>
                    <div className="flex gap-2">
                       <select value={editData.turn} onChange={e => setEditData({...editData, turn: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm outline-none focus:ring-1 focus:ring-indigo-500"><option value="先">先</option><option value="後">後</option></select>
                       <select value={editData.result} onChange={e => setEditData({...editData, result: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm font-black outline-none focus:ring-1 focus:ring-emerald-500"><option value="VICTORY">WIN</option><option value="LOSE">LOSS</option></select>
                    </div>
                  </div>
                  <DeckSelect availableDecks={decks} selectedDecks={editData.myDeck} onChange={v => setEditData({...editData, myDeck: v})} placeholder="My Deck" />
                  <DeckSelect availableDecks={decks} selectedDecks={editData.oppDeck} onChange={v => setEditData({...editData, oppDeck: v})} placeholder="Opponent Deck" />
                  <DeckSelect availableDecks={displayReasons || reasons} selectedDecks={editData.memo} onChange={v => setEditData({...editData, memo: v})} placeholder="Match Deciding Factor (Tags)" />
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center shadow-inner group transition-all hover:border-indigo-500/50"><label className="text-[9px] text-zinc-600 uppercase font-black block mb-2">Points</label><input type="text" value={editData.diff} onChange={e => setEditData({...editData, diff: e.target.value})} className="bg-transparent text-4xl font-black text-indigo-400 outline-none text-center w-full" /></div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex-1 text-center bg-zinc-950 p-6 rounded-3xl border border-zinc-800"><div className="text-[9px] uppercase text-zinc-600 font-bold mb-2">MY DECK</div><div className="text-sm font-black text-zinc-100">{selectedMatch.myDeck || "---"}</div></div>
                    <ArrowLeftRight className="text-zinc-800 shrink-0" />
                    <div className="flex-1 text-center bg-zinc-950 p-6 rounded-3xl border border-zinc-800"><div className="text-[9px] uppercase text-zinc-600 font-bold mb-2">OPPONENT</div><div className="text-sm font-black text-zinc-100">{selectedMatch.opponentDeck || "---"}</div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 text-center"><div className="text-[9px] text-zinc-600 uppercase font-black mb-1">State</div><div className="text-sm font-black">{selectedMatch.turn}攻 / {selectedMatch.result}</div></div>
                    <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 text-center"><div className="text-[9px] text-zinc-600 uppercase font-black mb-1">Delta</div><div className="text-sm font-black text-indigo-400">{selectedMatch.diff || "---"}</div></div>
                  </div>
                  {selectedMatch.memo && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {selectedMatch.memo.split(/[,、，]+/).map((rawTag, idx) => {
                        const tag = rawTag.trim();
                        if (!tag) return null;
                        const isPos = tag.includes('[+]') || tag.includes('［＋］');
                        const isNeg = tag.includes('[-]') || tag.includes('［－］');
                        const colorClass = isPos ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : isNeg ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
                        return (
                          <span key={idx} className={`px-3 py-1 rounded-full border ${colorClass} text-[10px] font-black uppercase tracking-wider`}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-8 bg-black/40 border-t border-zinc-800 flex gap-4">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} disabled={isSaving} className="flex-1 bg-zinc-800 text-zinc-400 py-4 rounded-2xl font-black uppercase text-xs disabled:opacity-50">Cancel</button>
                  <button onClick={handleSaveEdit} disabled={isSaving} className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />} Save Changes</button>
                  <button 
                    onClick={handleDeleteMatch} 
                    disabled={isSaving} 
                    className={`p-4 rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2 font-black text-[10px]
                      ${isConfirmingDelete ? 'bg-rose-600 text-white animate-pulse' : 'bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white'}`}
                  >
                    <Trash2 className="w-5 h-5" />
                    {isConfirmingDelete && "本当に削除？"}
                  </button>
                </>
              ) : <button onClick={() => setSelectedMatch(null)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all">Close Summary</button>}
            </div>
          </div>
        </div>
      )}

      {showSettingsEditor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 transition-all" onClick={() => setShowSettingsEditor(false)}>
          <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-white/[0.01]"><h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter"><Settings className="w-7 h-7 text-indigo-500" /> MASTER DATABASE</h3><button onClick={() => setShowSettingsEditor(false)} className="text-zinc-600 hover:text-white p-2 hover:bg-zinc-800 rounded-full transition-all"><XCircle className="w-8 h-8" /></button></div>
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto custom-scrollbar">
               {[ { label: 'DECK LIST', list: editingDecks, set: setEditingDecks, id: 'new-deck' }, { label: 'CAUSE TAGS', list: editingReasons, set: setEditingReasons, id: 'new-tag' } ].map(group => (
                 <div key={group.label} className="space-y-6">
                   <div className="flex items-center justify-between"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{group.label}</label><span className="text-[10px] text-zinc-600 font-mono">{group.list.length} Items</span></div>
                   {group.label === 'CAUSE TAGS' && (
                     <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-2">
                       <button onClick={() => setNewTagTrait('positive')} className={`flex-1 py-1 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${newTagTrait === 'positive' ? 'bg-emerald-500 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>有利 [+]</button>
                       <button onClick={() => setNewTagTrait('negative')} className={`flex-1 py-1 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${newTagTrait === 'negative' ? 'bg-rose-500 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>不利 [-]</button>
                     </div>
                   )}
                   <div className="flex gap-2">
                     <input id={group.id} type="text" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder={`Add ${group.label.toLowerCase()}...`} onKeyDown={e => { if(e.key==='Enter' && e.target.value){ const val = group.label === 'CAUSE TAGS' ? (newTagTrait === 'positive' ? `[+] ${e.target.value}` : `[-] ${e.target.value}`) : e.target.value; group.set([...group.list, val]); e.target.value=''; } }} />
                     <button onClick={() => { const i=document.getElementById(group.id); if(i.value){ const val = group.label === 'CAUSE TAGS' ? (newTagTrait === 'positive' ? `[+] ${i.value}` : `[-] ${i.value}`) : i.value; group.set([...group.list, val]); i.value=''; } }} className="bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl text-white shadow-lg transition-all active:scale-95"><Plus className="w-5 h-5" /></button>
                   </div>
                   <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-3 max-h-56 overflow-y-auto space-y-2 custom-scrollbar shadow-inner">
                     {group.list.map((item, i) => {
                        const isPositive = group.label === 'CAUSE TAGS' && item.startsWith('[+]');
                        const isNegative = group.label === 'CAUSE TAGS' && (item.startsWith('[-]') || (!item.startsWith('[+]') && !item.startsWith('自：') && !item.startsWith('敵：')));
                        return (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 group hover:border-zinc-700 transition-all ${isPositive ? 'border-emerald-500/20 bg-emerald-500/5' : isNegative ? 'border-rose-500/20 bg-rose-500/5' : ''}`}>
                            <span className={`text-[11px] transition-colors ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{item}</span>
                            <button onClick={() => group.set(group.list.filter((_, idx) => idx !== i))} className="text-zinc-700 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                   </div>
                 </div>
               ))}
            </div>
            <div className="p-8 bg-black/40 border-t border-zinc-800 flex gap-4">
              <button onClick={() => setShowSettingsEditor(false)} className="flex-1 bg-zinc-800 text-zinc-500 font-black py-5 rounded-[1.5rem] uppercase text-xs tracking-widest">Discard</button>
              <button onClick={handleSaveSettings} disabled={isSaving} className="flex-[2] bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 uppercase text-xs tracking-widest transition-all hover:bg-indigo-500">{isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />} Sync Master Sheet</button>
            </div>
          </div>
        </div>
      )}

      <CalendarModal 
        isOpen={isDateModalOpen} 
        onClose={() => setIsDateModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        onApply={(start, end) => {
          const toLocal = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
          setStartDate(toLocal(start));
          setEndDate(toLocal(end));
          setIsDateModalOpen(false);
          setSetRange([1, 1]);
        }}
      />
    </div>
  );
}
