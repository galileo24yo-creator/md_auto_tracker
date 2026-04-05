import React, { useMemo, useState, useEffect, memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Trophy, Swords, XCircle, TrendingUp, Activity, Download, ArrowLeftRight, Pencil, Save, Loader2, Trash2, Settings, Plus, ExternalLink, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { postData } from '../lib/api';
import DeckSelect from './DeckSelect';
import FilterSelect from './FilterSelect';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#f43f5e', '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6'];

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
    <div className="relative w-full h-8 flex items-center">
      <div className="absolute w-full h-1 bg-zinc-800 rounded-full" />
      <div className="absolute h-1 bg-indigo-600 rounded-full" style={{ left: `${((minVal - min) / (max - min)) * 100}%`, right: `${100 - ((maxVal - min) / (max - min)) * 100}%` }} />
      <input type="range" min={min} max={max} value={minVal} onChange={handleMinChange} className={`absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md ${minVal >= max / 2 ? 'z-30' : 'z-20'}`} />
      <input type="range" min={min} max={max} value={maxVal} onChange={handleMaxChange} className={`absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md ${maxVal <= max / 2 ? 'z-30' : 'z-20'}`} />
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
          <span className="text-xs font-bold text-zinc-200">{data.opponentDeck}</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${data.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{data.result}</span>
        </div>
        <div className="text-lg font-black text-indigo-400">Rate: {data.rating}</div>
      </div>
    );
  }
  return null;
};

const MatchList = memo(({ records, onSelect }) => (
  <div className="bg-zinc-800/80 p-5 rounded-xl border border-zinc-700/50 flex flex-col h-full shadow-lg">
    <h3 className="text-zinc-300 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center justify-between">
      Matches In Set
      <span className="text-zinc-500 font-normal">{Math.min(records.length, 15)} matches</span>
    </h3>
    <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-72 custom-scrollbar">
      {records.slice(0, 15).map((r, i) => (
        <button key={i} onClick={() => onSelect(r)} className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-800 text-sm hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all group">
          <div className="flex flex-col flex-1 mx-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-xs">{r.opponentDeck || "UNKNOWN"}</span>
              {r.memo && r.memo.split(',').map((tag, idx) => <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-500/5 border border-indigo-500/10 text-[9px] text-indigo-400 font-bold whitespace-nowrap">{tag.trim()}</span>)}
            </div>
            <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mt-0.5">{r.date.split(' ')[0]} • {r.mode} • {r.turn}</span>
          </div>
          <div className={`font-black px-3 py-1 rounded-full text-[10px] ${String(r.result).includes('VIC') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{String(r.result).includes('VIC') ? 'WIN' : 'LOSE'}</div>
        </button>
      ))}
      {records.length === 0 && <div className="h-full flex items-center justify-center text-zinc-600 italic text-xs">NO DATA</div>}
    </div>
  </div>
));

const MatchupRankings = memo(({ data, tab, onTabChange, minLimit, onLimitChange }) => (
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
          {data.map((d, i) => (
            <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
              <td className="py-2.5 pr-4"><span className="font-bold text-zinc-200 text-xs truncate max-w-[90px] block" title={d.deck}>{d.deck}</span></td>
              <td className="py-2.5 px-2 text-center font-mono text-zinc-400 text-[10px]">{d.total}</td>
              <td className={`py-2.5 px-2 text-right font-black text-xs ${d.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.winRate.toFixed(0)}%</td>
              <td className="py-2.5 px-2 text-right text-zinc-400 text-[10px]">{d.firstRate.toFixed(0)}%</td>
              <td className={`py-2.5 px-2 text-right text-[10px] ${d.firstWinRate >= 50 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{d.firstWinRate.toFixed(0)}%</td>
              <td className={`py-2.5 pl-2 text-right text-[10px] ${d.secondWinRate >= 50 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{d.secondWinRate.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));

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

export default function Dashboard({ records, onRefresh, decks, reasons, activeProfile }) {
  const [filterMode, setFilterMode] = useState('ALL');
  const [filterDateType, setFilterDateType] = useState('30D');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [chunkSize, setChunkSize] = useState('ALL');
  const [setRange, setSetRange] = useState([1, 1]);
  const [filterMyDeck, setFilterMyDeck] = useState('ALL');
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // モーダルが閉じられたら状態をリセット
  useEffect(() => {
    if (!selectedMatch) {
      setIsEditing(false);
      setIsConfirmingDelete(false);
    }
  }, [selectedMatch]);

  const startEditing = () => {
    setEditData({
      mode: selectedMatch.mode || "ランク",
      turn: selectedMatch.turn || "先",
      result: String(selectedMatch.result).toUpperCase().includes('VIC') || selectedMatch.result === 'WIN' ? 'VICTORY' : 'DEFEAT',
      myDeck: selectedMatch.myDeck ? selectedMatch.myDeck.split(', ').filter(Boolean) : [],
      oppDeck: selectedMatch.opponentDeck ? selectedMatch.opponentDeck.split(', ').filter(Boolean) : [],
      diff: selectedMatch.diff || selectedMatch.rating || "",
      memo: selectedMatch.memo ? selectedMatch.memo.split(', ').filter(Boolean) : []
    }); setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    console.log("[Dashboard] handleSaveEdit entry");
    try {
      if (!selectedMatch) {
         console.error("[Dashboard] No match selected for editing.");
         return;
      }
      
      console.log("[Dashboard] Saving changes for match:", selectedMatch.date);
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
      
      console.log("[Dashboard] API Request Payload:", payload);
      const res = await postData(payload);
      console.log("[Dashboard] API Response:", res);
      
      if (res?.success) {
        if (onRefresh) await onRefresh();
        setSelectedMatch(null);
        setIsEditing(false);
      } else {
        alert("保存エラー: " + (res?.error || "不明なエラー"));
      }
    } catch (e) {
      console.error("[Dashboard] FATAL ERROR in handleSaveEdit:", e);
      alert("致命的なエラーが発生しました: " + e.message);
    } finally {
      setIsSaving(false);
      console.log("[Dashboard] handleSaveEdit exit");
    }
  };

  const handleDeleteMatch = async () => {
    console.log("[Dashboard] handleDeleteMatch entry");
    
    // UI上での確認がまだなら、確認モードに入るだけ
    if (!isConfirmingDelete) {
      console.log("[Dashboard] Entering delete confirmation mode");
      setIsConfirmingDelete(true);
      return;
    }

    try {
      if (!selectedMatch) {
        console.error("[Dashboard] No match selected for deletion.");
        return;
      }
      
      const targetId = selectedMatch.date || "ID不明";
      console.log("[Dashboard] EXECUTE deletion for ID:", targetId);
      
      setIsSaving(true);
      const res = await postData({ 
        action: 'DELETE_RECORD', 
        id: targetId 
      });
      console.log("[Dashboard] API response for deletion:", res);
      
      if (res?.success) {
        if (onRefresh) await onRefresh();
        setSelectedMatch(null);
        setIsConfirmingDelete(false);
      } else {
        alert("削除エラー: " + (res?.error || "データが見つかりません。GASを再デプロイしたか確認してください。"));
        setIsConfirmingDelete(false);
      }
    } catch (e) {
      console.error("[Dashboard] FATAL ERROR in handleDeleteMatch:", e);
      alert("致命的なエラーが発生しました: " + e.message);
    } finally {
      setIsSaving(false);
      console.log("[Dashboard] handleDeleteMatch exit");
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

  const availableMyDecks = useMemo(() => {
    const s = new Set();
    records.forEach(r => { if (r.myDeck) { const d = r.myDeck.split(',').map(v => v.trim()).filter(Boolean).sort().join(' + '); if (d) s.add(d); } });
    return Array.from(s).sort();
  }, [records]);
  
  const baseFilteredRecords = useMemo(() => {
    let r = records;
    
    // 1. Date Range Filtering
    if (filterDateType !== 'ALL') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      r = r.filter(v => {
        if (!v.date) return false;
        const d = new Date(v.date.replace(/\//g, '-')); // standard format for reliably parsing
        
        if (filterDateType === 'TODAY') return d >= today;
        if (filterDateType === '7D') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (filterDateType === '30D') return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (filterDateType === 'CUSTOM') {
          const s = startDate ? new Date(startDate) : null;
          const e = endDate ? new Date(endDate) : null;
          if (e) e.setHours(23, 59, 59, 999); // Include the end date fully
          
          if (s && e) return d >= s && d <= e;
          if (s) return d >= s;
          if (e) return d <= e;
        }
        return true;
      });
    }

    // 2. Mode and MyDeck Filtering
    if (filterMode !== 'ALL') r = r.filter(v => String(v.mode || "").includes(String(filterMode).replace('戦','')));
    if (filterMyDeck !== 'ALL') r = r.filter(v => v.myDeck?.split(',').map(x => x.trim()).sort().join(' + ') === filterMyDeck);
    
    return r.slice().reverse();
  }, [records, filterMode, filterMyDeck, filterDateType, startDate, endDate]);

  const totalSets = useMemo(() => chunkSize === 'ALL' ? 1 : Math.max(1, Math.ceil(baseFilteredRecords.length / parseInt(chunkSize, 10))), [baseFilteredRecords.length, chunkSize]);

  const filteredRecords = useMemo(() => {
    if (chunkSize === 'ALL') return baseFilteredRecords;
    const s = parseInt(chunkSize, 10);
    return baseFilteredRecords.slice((Math.max(1, Math.min(setRange[0], setRange[1])) - 1) * s, Math.min(totalSets, Math.max(setRange[0], setRange[1])) * s);
  }, [baseFilteredRecords, chunkSize, setRange, totalSets]);

  const stats = useMemo(() => {
    const t = filteredRecords.length; let w = 0, ft = 0, fw = 0, st = 0, sw = 0;
    filteredRecords.forEach(r => {
      const isWin = String(r.result).toUpperCase().includes('VIC');
      if (isWin) w++;
      if (String(r.turn).includes('先')) { ft++; if (isWin) fw++; } else { st++; if (isWin) sw++; }
    });
    return { 
      total: t, 
      wins: w, 
      winRate: t > 0 ? ((w/t)*100).toFixed(1) : 0, 
      fRate: t > 0 ? ((ft/t)*100).toFixed(1) : 0,
      fWinRate: ft > 0 ? ((fw/ft)*100).toFixed(1) : 0, 
      sWinRate: st > 0 ? ((sw/st)*100).toFixed(1) : 0 
    };
  }, [filteredRecords]);

  const opponentDeckData = useMemo(() => {
    const c = {};
    filteredRecords.forEach(r => { if (r.opponentDeck) { const d = r.opponentDeck.split(',').map(x => x.trim()).sort().join(' + '); if (d) c[d] = (c[d] || 0) + 1; } });
    const s = Object.entries(c).map(([n, v]) => ({ name: n, value: v })).sort((a,b) => b.value - a.value);
    if (s.length <= 7) return s; return [...s.slice(0, 6), { name: "その他", value: s.slice(6).reduce((a, x) => a + x.value, 0) }];
  }, [filteredRecords]);

  const myDeckWinRateData = useMemo(() => {
    const s = {};
    filteredRecords.forEach(r => { if (r.myDeck) { const d = r.myDeck.split(',').map(x => x.trim()).sort().join(' + '); if (!d) return; if (!s[d]) s[d] = { w: 0, t: 0 }; s[d].t++; if (String(r.result).toUpperCase().includes('VIC')) s[d].w++; } });
    return Object.entries(s).map(([n, v]) => ({ name: n, winRate: parseFloat(((v.w / v.t) * 100).toFixed(1)), total: v.t })).sort((a,b) => b.total - a.total).slice(0, 5);
  }, [filteredRecords]);

  const matchupData = useMemo(() => {
    const s = {};
    filteredRecords.forEach(r => { if (!r.opponentDeck) return; const d = r.opponentDeck.split(',').map(x => x.trim()).sort().join(' + '); if (!d) return; const w = String(r.result).toUpperCase().includes('VIC'); if (!s[d]) s[d] = { t: 0, w: 0, ft: 0, fw: 0, st: 0, sw: 0 }; s[d].t++; if (w) s[d].w++; if (String(r.turn).includes('先')) { s[d].ft++; if (w) s[d].fw++; } else { s[d].st++; if (w) s[d].sw++; } });
    const v = Object.entries(s).map(([n, x]) => ({ 
      deck: n, 
      total: x.t, 
      firstRate: (x.ft/x.t)*100,
      winRate: (x.w/x.t)*100, 
      firstWinRate: x.ft > 0 ? (x.fw/x.ft)*100 : 0, 
      secondWinRate: x.st > 0 ? (x.sw/x.st)*100 : 0 
    })).filter(x => x.total >= minMatchLimit);
    if (matchupTab === 'FREQ') return v.sort((a,b) => b.total - a.total).slice(0, 15);
    if (matchupTab === 'WORST') return v.sort((a,b) => a.winRate - b.winRate).slice(0, 15);
    return v.sort((a,b) => b.winRate - a.winRate).slice(0, 15);
  }, [filteredRecords, matchupTab, minMatchLimit]);

  const trendData = useMemo(() => {
    // グラフ用には使用デッキフィルターを無視する
    let r = records;
    
    // 1. 日付フィルターの適用
    if (filterDateType !== 'ALL') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      r = r.filter(v => {
        if (!v.date) return false;
        const d = new Date(v.date.replace(/\//g, '-'));
        if (filterDateType === 'TODAY') return d >= today;
        if (filterDateType === '7D') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (filterDateType === '30D') return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (filterDateType === 'CUSTOM') {
          const s = startDate ? new Date(startDate) : null;
          const e = endDate ? new Date(endDate) : null;
          if (e) e.setHours(23, 59, 59, 999);
          if (s && e) return d >= s && d <= e;
          if (s) return d >= s;
          if (e) return d <= e;
        }
        return true;
      });
    }

    // 2. モードフィルターの適用
    if (filterMode !== 'ALL') r = r.filter(v => String(v.mode || "").includes(String(filterMode).replace('戦','')));
    
    // 3. セット範囲（Chunk）の適用
    r = r.slice().reverse(); // baseFilteredRecordsと同様に新しい順にするための準備
    if (chunkSize !== 'ALL') {
      const s = parseInt(chunkSize, 10);
      r = r.slice((Math.max(1, Math.min(setRange[0], setRange[1])) - 1) * s, Math.min(totalSets, Math.max(setRange[0], setRange[1])) * s);
    }

    // グラフ表示用に古い順に戻してマッピング
    return r.reverse().map((x, i) => { 
      const v = parseFloat(String(x.diff).replace(/[^0-9.-]/g, '')); 
      if (isNaN(v)) return null; 
      return { 
        index: i + 1, 
        rating: v, 
        opponentDeck: x.opponentDeck, 
        result: String(x.result).includes('VIC') ? 'WIN' : 'LOSE', 
        date: x.date, 
        myDeck: x.myDeck 
      }; 
    }).filter(v => v !== null);
  }, [records, filterMode, filterDateType, startDate, endDate, chunkSize, setRange, totalSets]);

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-zinc-100 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500" /> Match Analytics</h2>
            <button onClick={exportToCSV} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-zinc-700 transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
            <button onClick={() => { setEditingDecks(decks); setEditingReasons(reasons); setShowSettingsEditor(true); }} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-500/20 transition-colors"><Settings className="w-3.5 h-3.5" /> Decks</button>
            {activeProfile?.sheetUrl && (
              <a 
                href={activeProfile.sheetUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Sheets
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-end">
            <select value={filterDateType} onChange={(e) => { setFilterDateType(e.target.value); setSetRange([1, 1]); }} className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 shrink-0">
              <option value="ALL">期間: すべて</option>
              <option value="TODAY">期間: 今日</option>
              <option value="7D">期間: 過去7日</option>
              <option value="30D">期間: 過去30日</option>
              <option value="CUSTOM">期間: カスタム</option>
            </select>
            
            {filterDateType === 'CUSTOM' && (
              <button 
                onClick={() => setIsDateModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase hover:bg-indigo-500/20 transition-all animate-in slide-in-from-right-2"
              >
                <Calendar className="w-3.5 h-3.5" />
                {startDate ? `${startDate.split('-').slice(1).join('/')} - ${endDate ? endDate.split('-').slice(1).join('/') : '...'}` : '期間を選択'}
              </button>
            )}

            <select value={filterMode} onChange={(e) => { setFilterMode(e.target.value); setSetRange([1, 1]); }} className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 shrink-0">
              <option value="ALL">モード: 全て</option>
              <option value="ランク戦">モード: ランク</option>
              <option value="レート戦">モード: レート</option>
              <option value="DC">モード: DC</option>
            </select>
            
            <FilterSelect 
              options={availableMyDecks} 
              value={filterMyDeck} 
              onChange={(v) => { setFilterMyDeck(v); setSetRange([1, 1]); }} 
              placeholder="マイデッキ" 
            />

            <select value={chunkSize} onChange={(e) => { setChunkSize(e.target.value); setSetRange([1, 1]); }} className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg px-2 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 shrink-0">
              <option value="ALL">全ての試合</option>
              <option value="5">5戦単位</option>
              <option value="10">10戦単位</option>
              <option value="20">20戦単位</option>
              <option value="30">30戦単位</option>
              <option value="50">50戦単位</option>
            </select>
          </div>
        </div>
        {chunkSize !== 'ALL' && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-4">
              <span className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">Select Set: {setRange[0]} - {setRange[1]}</span>
              <DualRangeSlider min={1} max={totalSets} value={setRange} onChange={setSetRange} />
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-zinc-900 mb-6">
        {['overview', 'trends'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-10 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Count" value={stats.total} icon={<Swords className="w-5 h-5 text-indigo-500" />} />
            <StatCard title="Win%" value={`${stats.winRate}%`} color="text-emerald-400" />
            <StatCard title="1st Rate" value={`${stats.fRate}%`} color="text-zinc-400" />
            <StatCard title="1st Win%" value={`${stats.fWinRate}%`} color="text-indigo-400" />
            <StatCard title="2nd Win%" value={`${stats.sWinRate}%`} color="text-orange-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl h-[340px] flex flex-col shadow-lg">
              <h3 className="text-zinc-400 text-[9px] font-black uppercase mb-4 text-center tracking-widest">Opponent Deck Meta</h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={opponentDeckData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
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
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl h-[340px] flex flex-col shadow-lg overflow-hidden">
              <h3 className="text-zinc-400 text-[9px] font-black uppercase mb-6 text-center tracking-widest">Performance by My Deck</h3>
              <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                {myDeckWinRateData.map((d, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-zinc-100 group-hover:text-indigo-400 transition-colors uppercase tracking-tight truncate max-w-[140px]" title={d.name}>{d.name}</span>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{d.total} matches</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black tracking-tighter ${d.winRate >= 50 ? 'text-emerald-400' : 'text-zinc-500'}`}>{d.winRate}%</span>
                        <span className="text-[8px] block text-zinc-500 font-black uppercase -mt-1 tracking-widest">WR</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
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
                {myDeckWinRateData.length === 0 && <div className="h-full flex items-center justify-center text-zinc-700 italic text-xs">No deck rankings</div>}
              </div>
            </div>
            <div className="h-[340px]"><MatchList records={filteredRecords} onSelect={setSelectedMatch} /></div>
            <div className="h-[340px]"><MatchupRankings data={matchupData} tab={matchupTab} onTabChange={setMatchupTab} minLimit={minMatchLimit} onLimitChange={setMinMatchLimit} /></div>
          </div>
        </>
      ) : (
        <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl h-[550px] shadow-2xl relative overflow-hidden">
          {trendData.length > 1 ? (
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#09090b" vertical={false} />
                 <XAxis dataKey="index" stroke="#a1a1aa" fontSize={10} axisLine={false} tickLine={false} />
                 <YAxis stroke="#a1a1aa" fontSize={10} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                 <Tooltip content={<CustomTooltip />} />
                 <Line type="monotone" dataKey="rating" stroke="#6366f1" strokeWidth={4} dot={{ r: 5, fill: '#6366f1', stroke: '#09090b', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} onClick={(d) => d?.payload && setSelectedMatch(d.payload)} animationDuration={1000} />
               </LineChart>
             </ResponsiveContainer>
          ) : <div className="h-full flex flex-col items-center justify-center text-zinc-700 italic text-sm gap-2"><Activity className="w-8 h-8 opacity-20" /> No Rating Trend Data</div>}
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
                       <select value={editData.result} onChange={e => setEditData({...editData, result: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm font-black outline-none focus:ring-1 focus:ring-emerald-500"><option value="VICTORY">WIN</option><option value="DEFEAT">LOSS</option></select>
                    </div>
                  </div>
                  <DeckSelect availableDecks={decks} selectedDecks={editData.myDeck} onChange={v => setEditData({...editData, myDeck: v})} placeholder="My Deck" />
                  <DeckSelect availableDecks={decks} selectedDecks={editData.oppDeck} onChange={v => setEditData({...editData, oppDeck: v})} placeholder="Opponent Deck" />
                  <DeckSelect availableDecks={reasons} selectedDecks={editData.memo} onChange={v => setEditData({...editData, memo: v})} placeholder="Match Deciding Factor (Tags)" />
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center shadow-inner group"><label className="text-[9px] text-zinc-600 uppercase font-black block mb-2">Points</label><input type="text" value={editData.diff} onChange={e => setEditData({...editData, diff: e.target.value})} className="bg-transparent text-4xl font-black text-indigo-400 outline-none text-center w-full" /></div>
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
                      {selectedMatch.memo.split(',').map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-black uppercase tracking-wider">{tag.trim()}</span>
                      ))}
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
                   <div className="flex gap-2">
                     <input id={group.id} type="text" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder={`Add ${group.label.toLowerCase()}...`} onKeyDown={e => { if(e.key==='Enter' && e.target.value){ group.set([...group.list, e.target.value]); e.target.value=''; } }} />
                     <button onClick={() => { const i=document.getElementById(group.id); if(i.value){ group.set([...group.list, i.value]); i.value=''; } }} className="bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl text-white shadow-lg transition-all active:scale-95"><Plus className="w-5 h-5" /></button>
                   </div>
                   <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-3 max-h-56 overflow-y-auto space-y-2 custom-scrollbar shadow-inner">
                     {group.list.map((item, i) => (
                       <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 group hover:border-zinc-700 transition-all"><span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors">{item}</span><button onClick={() => group.set(group.list.filter((_, idx) => idx !== i))} className="text-zinc-700 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-500/10 transition-all"><Trash2 className="w-4 h-4" /></button></div>
                     ))}
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
