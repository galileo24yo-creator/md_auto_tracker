import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Scatter } from 'recharts';
import { Trophy, Swords, XCircle, TrendingUp, Activity, Download, FileText, Calendar, User, Hash, MessageSquare, ArrowLeftRight, Pencil, Save, Undo2, Loader2 } from 'lucide-react';
import { postData } from '../lib/api';
import DeckSelect from './DeckSelect';

const COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#14b8a6'  // teal-500
];

export default function Dashboard({ records, onRefresh, decks, reasons }) {
  const [filterMode, setFilterMode] = useState('ALL');
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

  // 編集モードの開始
  const startEditing = () => {
    setEditData({
      mode: selectedMatch.mode || "ランク",
      turn: selectedMatch.turn || "先",
      result: String(selectedMatch.result).includes('VIC') || selectedMatch.result === 'WIN' ? 'VICTORY' : 'DEFEAT',
      myDeck: selectedMatch.myDeck ? selectedMatch.myDeck.split(', ').filter(Boolean) : [],
      oppDeck: selectedMatch.opponentDeck ? selectedMatch.opponentDeck.split(', ').filter(Boolean) : [],
      diff: selectedMatch.diff || selectedMatch.rating || "",
      memo: selectedMatch.memo ? selectedMatch.memo.split(', ').filter(Boolean) : []
    });
    setIsEditing(true);
  };

  // 編集データの保存
  const handleSaveEdit = async () => {
    setIsSaving(true);
    const payload = {
      id: selectedMatch.date, // GAS側の検索用キー
      mode: editData.mode,
      turn: editData.turn,
      result: editData.result,
      myDeck: editData.myDeck.join(', '),
      opponentDeck: editData.oppDeck.join(', '),
      diff: editData.diff,
      memo: editData.memo.join(', ')
    };

    const res = await postData(payload);
    if (res?.success) {
      if (onRefresh) await onRefresh();
      setSelectedMatch(null); // モーダルを閉じてリフレッシュを反映
      setIsEditing(false);
    } else {
      alert("Error: " + (res?.error || "Failed to save changes."));
    }
    setIsSaving(false);
  };

  // CSVエクスポート機能
  const exportToCSV = () => {
    if (!filteredRecords.length) return;
    
    // ヘッダーとデータの構築
    const headers = ["Date", "Mode", "MyDeck", "OpponentDeck", "Result", "Turn", "Diff", "Memo"];
    const rows = filteredRecords.map(r => [
      r.date, r.mode, r.myDeck, r.opponentDeck, r.result, r.turn, r.diff, r.memo
    ].map(val => `"${String(val || "").replace(/"/g, '""')}"`).join(","));
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `MD_Matches_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 自分の一意な使用デッキリストを抽出
  const availableMyDecks = useMemo(() => {
    const deckSet = new Set();
    records.forEach(r => {
      if (r.myDeck) {
        const combinedDeck = r.myDeck.split(',').map(d => d.trim()).filter(Boolean).sort().join(' + ');
        if (combinedDeck) deckSet.add(combinedDeck);
      }
    });
    return Array.from(deckSet).sort();
  }, [records]);
  
  // 1. モードで使用デッキで絞り込み、新着順（直近）に並び替え
  const baseFilteredRecords = useMemo(() => {
    let res = records;
    if (filterMode !== 'ALL') {
      res = res.filter(r => r.mode === filterMode);
    }
    if (filterMyDeck !== 'ALL') {
      res = res.filter(r => {
        if (!r.myDeck) return false;
        const combinedDeck = r.myDeck.split(',').map(d => d.trim()).filter(Boolean).sort().join(' + ');
        return combinedDeck === filterMyDeck;
      });
    }
    return res.slice().reverse();
  }, [records, filterMode, filterMyDeck]);

  const totalSets = useMemo(() => {
    if (chunkSize === 'ALL') return 1;
    return Math.max(1, Math.ceil(baseFilteredRecords.length / parseInt(chunkSize, 10)));
  }, [baseFilteredRecords.length, chunkSize]);

  // 2. 指定されたチャンクサイズと範囲（セット）で切り出し
  const filteredRecords = useMemo(() => {
    if (chunkSize === 'ALL') return baseFilteredRecords;
    const size = parseInt(chunkSize, 10);
    const minS = Math.min(setRange[0], setRange[1]);
    const maxS = Math.max(setRange[0], setRange[1]);
    
    // Set 1 はインデックス0〜size-1。Set Nはインデックス (N-1)*size 〜 N*size-1
    const start = (Math.max(1, minS) - 1) * size;
    const end = Math.min(totalSets, maxS) * size;
    return baseFilteredRecords.slice(start, end);
  }, [baseFilteredRecords, chunkSize, setRange, totalSets]);

  // 全体勝率の計算
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    let wins = 0;
    let losses = 0;
    let firstTurnWins = 0;
    let firstTurnTotal = 0;
    let secondTurnWins = 0;
    let secondTurnTotal = 0;
    
    filteredRecords.forEach(r => {
      // 厳密な文字判定（OCRの揺れを考慮）
      const isWin = String(r.result).toUpperCase().includes('VIC');
      const isLoss = String(r.result).toUpperCase().includes('LOS') || String(r.result).includes('敗北');
      const isFirst = String(r.turn).includes('先');
      const isSecond = String(r.turn).includes('後');
      
      if (isWin) wins++;
      if (isLoss) losses++;
      if (isFirst) {
        firstTurnTotal++;
        if (isWin) firstTurnWins++;
      }
      if (isSecond) {
        secondTurnTotal++;
        if (isWin) secondTurnWins++;
      }
    });

    return {
      total,
      wins,
      losses,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : 0,
      firstTurnTotal,
      firstTurnRate: total > 0 ? ((firstTurnTotal / total) * 100).toFixed(1) : 0,
      firstTurnWinRate: firstTurnTotal > 0 ? ((firstTurnWins / firstTurnTotal) * 100).toFixed(1) : 0,
      secondTurnWinRate: secondTurnTotal > 0 ? ((secondTurnWins / secondTurnTotal) * 100).toFixed(1) : 0
    };
  }, [filteredRecords]);

  const opponentDeckData = useMemo(() => {
    const counts = {};
    filteredRecords.forEach(r => {
      if (!r.opponentDeck) return;
      const combinedDeck = r.opponentDeck.split(',').map(d => d.trim()).filter(Boolean).sort().join(' + ');
      if (!combinedDeck) return;
      counts[combinedDeck] = (counts[combinedDeck] || 0) + 1;
    });
    
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 7種類以下の場合はそのまま表示、それ以上の場合は「上位6件 + その他」にする
    if (sorted.length <= 7) return sorted;

    const top6 = sorted.slice(0, 6);
    const othersValue = sorted.slice(6).reduce((acc, curr) => acc + curr.value, 0);
    
    return [...top6, { name: "その他", value: othersValue }];
  }, [filteredRecords]);

  // 自分の使用デッキ別の勝率
  const myDeckWinRateData = useMemo(() => {
    const deckStats = {};
    filteredRecords.forEach(r => {
      if (!r.myDeck) return;
      const combinedDeck = r.myDeck.split(',').map(d => d.trim()).filter(Boolean).sort().join(' + ');
      const isWin = String(r.result).toUpperCase().includes('VIC');
      
      if (!combinedDeck) return;
      if (!deckStats[combinedDeck]) deckStats[combinedDeck] = { win: 0, total: 0 };
      deckStats[combinedDeck].total++;
      if (isWin) deckStats[combinedDeck].win++;
    });

    return Object.entries(deckStats)
      .map(([name, stat]) => ({
        name: name || "未設定",
        winRate: parseFloat(((stat.win / stat.total) * 100).toFixed(1)),
        total: stat.total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredRecords]);

  // 相性データの集計
  const matchupData = useMemo(() => {
    const opponentStats = {};
    filteredRecords.forEach(r => {
      if (!r.opponentDeck) return;
      const combinedDeck = r.opponentDeck.split(',').map(d => d.trim()).filter(Boolean).sort().join(' + ');
      if (!combinedDeck) return;
      
      const isWin = String(r.result).toUpperCase().includes('VIC');
      const isFirst = String(r.turn).includes('先');
      const isSecond = String(r.turn).includes('後');
      
      if (!opponentStats[combinedDeck]) {
        opponentStats[combinedDeck] = { 
          total: 0, wins: 0, losses: 0,
          firstTotal: 0, firstWins: 0,
          secondTotal: 0, secondWins: 0 
        };
      }
      
      opponentStats[combinedDeck].total++;
      if (isWin) opponentStats[combinedDeck].wins++;
      else opponentStats[combinedDeck].losses++;

      if (isFirst) {
        opponentStats[combinedDeck].firstTotal++;
        if (isWin) opponentStats[combinedDeck].firstWins++;
      } else if (isSecond) {
        opponentStats[combinedDeck].secondTotal++;
        if (isWin) opponentStats[combinedDeck].secondWins++;
      }
    });

    const validDecks = Object.entries(opponentStats)
      .map(([deck, stats]) => {
        const winRate = (stats.wins / stats.total) * 100;
        const firstRate = (stats.firstTotal / stats.total) * 100;
        const firstWinRate = stats.firstTotal > 0 ? (stats.firstWins / stats.firstTotal) * 100 : 0;
        const secondWinRate = stats.secondTotal > 0 ? (stats.secondWins / stats.secondTotal) * 100 : 0;

        return {
          deck,
          total: stats.total,
          wins: stats.wins,
          losses: stats.losses,
          winRate,
          firstRate,
          firstWinRate,
          secondWinRate
        };
      })
      .filter(d => d.total >= minMatchLimit);

    if (matchupTab === 'FREQ') {
      return validDecks.sort((a, b) => b.total - a.total || b.winRate - a.winRate).slice(0, 15);
    } else if (matchupTab === 'WORST') {
      return validDecks.sort((a, b) => a.winRate - b.winRate || b.total - a.total).slice(0, 15);
    } else {
      return validDecks.sort((a, b) => b.winRate - a.winRate || b.total - a.total).slice(0, 15);
    }
  }, [filteredRecords, matchupTab, minMatchLimit]);
  // トレンドグラフ用データの作成（古い順）
  const { trendData, totalInScope } = useMemo(() => {
    // デッキフィルターは無視するが、モードとセット範囲（期間）は反映させる
    let res = records;
    if (filterMode !== 'ALL' && filterMode) {
      const target = String(filterMode).replace('戦', '');
      res = res.filter(r => {
        const m = String(r.mode || '');
        return m.includes(target) || m === filterMode;
      });
    }

    // Newest first にしてからスライスし、最後にグラフ用に reverse (Oldest first) する
    let baseRes = res.slice().reverse();
    
    if (chunkSize !== 'ALL') {
      const size = parseInt(chunkSize, 10);
      const minS = Math.min(setRange[0], setRange[1]);
      const maxS = Math.max(setRange[0], setRange[1]);
      
      const totalSetsForMode = Math.max(1, Math.ceil(baseRes.length / size));
      const start = (Math.max(1, minS) - 1) * size;
      const end = Math.min(totalSetsForMode, maxS) * size;
      baseRes = baseRes.slice(start, end);
    }

    const totalCount = baseRes.length;
    
    // 最初から古い順にして、元の位置(idx)をインデックスとして保持
    const trendItems = baseRes.reverse()
      .map((r, idx) => {
        const val = parseFloat(String(r.diff).replace(/[^0-9.-]/g, ''));
        if (isNaN(val)) return null;
        return {
          index: idx + 1, // 元の範囲内での順序
          rating: val,
          opponentDeck: r.opponentDeck || "不明",
          result: String(r.result).includes('VIC') ? 'WIN' : 'LOSE',
          date: r.date,
          myDeck: r.myDeck || "不明",
          memo: r.memo || ""
        };
      })
      .filter(item => item !== null);

    return { trendData: trendItems, totalInScope: totalCount };
  }, [records, filterMode, chunkSize, setRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 mb-8 bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              Match Analytics
            </h2>
            <button 
              onClick={exportToCSV}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-2 transition"
              title="CSVをダウンロード"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select 
              value={filterMode} 
              onChange={(e) => { setFilterMode(e.target.value); setSetRange([1, 1]); }}
              className="flex-1 sm:flex-initial bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="ALL">全てのモード</option>
              <option value="ランク">ランク戦</option>
              <option value="DC">デュエリストカップ</option>
              <option value="レート戦">レート戦</option>
            </select>
            <select 
              value={filterMyDeck} 
              onChange={(e) => { setFilterMyDeck(e.target.value); setSetRange([1, 1]); }}
              className="flex-1 sm:flex-initial bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm max-w-[160px] truncate transition-all"
            >
              <option value="ALL">全ての使用デッキ</option>
              {availableMyDecks.map(deck => (
                <option key={deck} value={deck}>{deck}</option>
              ))}
            </select>
            <select 
              value={chunkSize} 
              onChange={(e) => { setChunkSize(e.target.value); setSetRange([1, 1]); }}
              className="flex-1 sm:flex-initial bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
            >
              <option value="ALL">全ての試合</option>
              <option value="10">10戦単位</option>
              <option value="20">20戦単位</option>
              <option value="30">30戦単位</option>
              <option value="50">50戦単位</option>
            </select>
          </div>
        </div>

        {chunkSize !== 'ALL' && (
          <div className="mt-2 pt-4 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Range</span>
              <div className="bg-zinc-800 px-3 py-1 rounded-md border border-zinc-700">
                <span className="text-xs font-mono text-indigo-400 font-bold">{setRange[0]}</span>
                <span className="mx-2 text-zinc-600">〜</span>
                <span className="text-xs font-mono text-indigo-400 font-bold">{setRange[1]}</span>
                <span className="ml-2 text-[10px] text-zinc-500">/ {totalSets} sets</span>
              </div>
            </div>
            <div className="flex-1 w-full px-2">
              <DualRangeSlider 
                min={1} 
                max={totalSets} 
                value={setRange} 
                onChange={(val) => setSetRange(val)} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-800 mb-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('trends')}
          className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'trends' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          Trends
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Total Matches" value={stats.total} icon={<Swords className="w-6 h-6 text-slate-400" />} />
            <StatCard title="Wins" value={stats.wins} icon={<Trophy className="w-6 h-6 text-yellow-500" />} />
            <StatCard title="Win Rate" value={`${stats.winRate}%`} color="text-emerald-400" />
            <StatCard title="First Turn Rate" value={`${stats.firstTurnRate}%`} color="text-indigo-400" />
            <StatCard title="1st Turn Win Rate" value={`${stats.firstTurnWinRate}%`} color="text-blue-400" />
            <StatCard title="2nd Turn Win Rate" value={`${stats.secondTurnWinRate}%`} color="text-orange-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Chart: Opponent Decks */}
            <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
              <h3 className="text-zinc-300 font-medium mb-4 text-center">Opponent Deck Distribution</h3>
              <div className="h-64">
                {opponentDeckData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={opponentDeckData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {opponentDeckData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.name === 'その他' ? '#52525b' : COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                        itemStyle={{ color: '#e4e4e7' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500">データがありません</div>
                )}
              </div>
            </div>

            {/* Chart: My Deck Win Rates */}
            <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50">
              <h3 className="text-zinc-300 font-medium mb-4 text-center">My Deck Win Rates</h3>
              <div className="h-64">
                {myDeckWinRateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={myDeckWinRateData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} width={80} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                        formatter={(value) => [`${value}%`, 'Win Rate']}
                      />
                      <Bar dataKey="winRate" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500">データがありません</div>
                )}
              </div>
            </div>

            {/* Recent Matches List */}
            <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50 overflow-hidden flex flex-col">
              <h3 className="text-zinc-300 font-medium mb-4 flex items-center justify-between">
                Matches in this Set
                <span className="text-xs text-zinc-500 font-normal">Showing {Math.min(filteredRecords.length, 10)} matches</span>
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-64">
                {filteredRecords.slice(0, 15).map((r, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedMatch(r)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm hover:border-indigo-500/50 hover:bg-zinc-800/80 transition group"
                  >
                    <div className="flex flex-col flex-1 mx-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-zinc-200 group-hover:text-indigo-300 transition-colors">{r.opponentDeck || "不明なデッキ"}</span>
                        {r.memo && r.memo.split(',').map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-medium whitespace-nowrap">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500">{r.date.split(' ')[0]} • {r.mode} • {r.turn}</span>
                    </div>
                    <div className={`font-bold px-3 py-1 rounded-full shrink-0 ${String(r.result).includes('VIC') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {String(r.result).includes('VIC') ? 'WIN' : 'LOSE'}
                    </div>
                  </button>
                ))}
                {filteredRecords.length === 0 && (
                  <div className="h-full flex items-center justify-center text-zinc-500">データがありません</div>
                )}
              </div>
            </div>

            {/* Matchup Rankings: Analysis Table */}
            <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700/50 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-zinc-300 font-medium">Matchup Analysis</h3>
                  <div className="flex bg-zinc-900 rounded-lg p-1">
                    <button 
                      onClick={() => setMatchupTab('FREQ')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${matchupTab === 'FREQ' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Freq
                    </button>
                    <button 
                      onClick={() => setMatchupTab('WORST')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${matchupTab === 'WORST' ? 'bg-rose-500/20 text-rose-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Worst
                    </button>
                    <button 
                      onClick={() => setMatchupTab('BEST')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${matchupTab === 'BEST' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Best
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Threshold:</span>
                  <select 
                    value={minMatchLimit} 
                    onChange={(e) => setMinMatchLimit(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={1}>1+</option>
                    <option value={3}>3+</option>
                    <option value={5}>5+</option>
                  </select>
                </div>
              </div>
              
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Rank / Deck</th>
                      <th className="pb-3 px-2 text-center">Total</th>
                      <th className="pb-3 px-2 text-right">Win Rate</th>
                      <th className="pb-3 px-2 text-right">1st Rate</th>
                      <th className="pb-3 px-2 text-right">1st Win</th>
                      <th className="pb-3 pl-2 text-right">2nd Win</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {matchupData.map((d, i) => (
                      <tr key={i} className="group hover:bg-white/5 transition-colors">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-zinc-600 group-hover:text-indigo-400 transition-colors w-4">{i + 1}</span>
                            <span className="font-bold text-zinc-200 truncate max-w-[120px]" title={d.deck}>{d.deck}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center font-mono text-zinc-400 text-xs">{d.total}</td>
                        <td className={`py-4 px-2 text-right font-bold ${d.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {d.winRate.toFixed(1)}%
                        </td>
                        <td className="py-4 px-2 text-right text-zinc-400 text-xs">{d.firstRate.toFixed(1)}%</td>
                        <td className={`py-4 px-2 text-right text-xs ${d.firstWinRate >= 50 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          {d.firstWinRate.toFixed(1)}%
                        </td>
                        <td className={`py-4 pl-2 text-right text-xs ${d.secondWinRate >= 50 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          {d.secondWinRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {matchupData.length === 0 && (
                  <div className="py-20 text-center text-zinc-500 text-sm italic">
                    指定された条件の対戦データがありません
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Trends Tab Content */
        <div className="bg-zinc-800/50 p-8 rounded-xl border border-zinc-700/50 min-h-[600px] flex flex-col">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-2xl font-bold text-zinc-100 italic">RATING TREND</h3>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                Mode: {filterMode === 'ALL' ? 'Overall Tracking' : filterMode}
              </p>
            </div>
            <div className="bg-zinc-900/50 px-4 py-2 rounded-lg border border-zinc-800 text-right">
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Data Coverage</div>
              <div className="text-xl font-mono text-zinc-200 font-bold">
                {trendData.length} <span className="text-xs text-zinc-500 font-normal">/ {totalInScope} matches</span>
              </div>
            </div>
          </div>
          
          <div className="w-full h-[500px] border border-zinc-700/30 rounded-lg p-4 bg-zinc-900/30">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="index" 
                    stroke="#71717a" 
                    fontSize={12} 
                    label={{ value: 'Match Sequence', position: 'insideBottom', offset: -10, fill: '#71717a', fontSize: 10 }} 
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={12} 
                    domain={['auto', 'auto']} 
                    tickFormatter={(v) => Math.floor(v)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                   <Line 
                    type="monotone" 
                    dataKey="rating" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#18181b', cursor: 'pointer' }}
                    activeDot={{ r: 6, fill: '#818cf8', strokeWidth: 0, cursor: 'pointer' }}
                    onClick={(data) => { if (data && data.payload) setSelectedMatch(data.payload); }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                <Activity className="w-12 h-12 opacity-20" />
                <div className="text-center space-y-2">
                  <p>推移を描画するには、レート/ポイントデータを含む試合が少なくとも2件以上必要です</p>
                  <p className="text-xs text-zinc-600">※現在は {trendData.length} 件の有効なポイントデータが検出されています</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Match Detail Modal: Premium Styled */}
      {selectedMatch && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => { setSelectedMatch(null); setIsEditing(false); }}
        >
          <div 
            className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-6 flex items-center justify-between border-b border-zinc-800 ${(String(selectedMatch.result || "").includes('VIC') || selectedMatch.result === 'WIN') ? 'bg-emerald-500/5' : 'bg-rose-500/5'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${(String(selectedMatch.result || "").includes('VIC') || selectedMatch.result === 'WIN') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {(String(selectedMatch.result || "").includes('VIC') || selectedMatch.result === 'WIN') ? <Trophy className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">{isEditing ? "Edit Match Record" : "Match Summary"}</h3>
                  <p className="text-xs text-zinc-500 font-mono italic">{selectedMatch.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    onClick={startEditing}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300"
                    title="編集する"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => { setSelectedMatch(null); setIsEditing(false); }}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {isEditing ? (
                <div className="space-y-6">
                  {/* Edit Mode Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Game Mode</label>
                      <select 
                        value={editData.mode}
                        onChange={(e) => setEditData({...editData, mode: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ランク">ランク戦</option>
                        <option value="DC">デュエリストカップ</option>
                        <option value="レート戦">レート戦</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Turn / Result</label>
                      <div className="flex gap-2">
                        <select 
                          value={editData.turn}
                          onChange={(e) => setEditData({...editData, turn: e.target.value})}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 outline-none"
                        >
                          <option value="先">先攻</option>
                          <option value="後">後攻</option>
                        </select>
                        <select 
                          value={editData.result}
                          onChange={(e) => setEditData({...editData, result: e.target.value})}
                          className={`flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm font-bold ${editData.result === 'VICTORY' ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          <option value="VICTORY">WIN</option>
                          <option value="DEFEAT">LOSS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">My Deck</label>
                      <DeckSelect availableDecks={decks || []} selectedDecks={editData.myDeck} onChange={(val) => setEditData({...editData, myDeck: val})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Opponent Deck</label>
                      <DeckSelect availableDecks={decks || []} selectedDecks={editData.oppDeck} onChange={(val) => setEditData({...editData, oppDeck: val})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Rating / Points</label>
                      <input 
                        type="text"
                        value={editData.diff}
                        onChange={(e) => setEditData({...editData, diff: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-2xl font-black text-indigo-400 text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Tags & Reasons</label>
                      <DeckSelect availableDecks={reasons || []} selectedDecks={editData.memo} onChange={(val) => setEditData({...editData, memo: val})} placeholder="タグの選択" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Decks Section */}
                  <div className="flex items-center justify-between gap-4 grayscale-[0.5]">
                    <div className="flex-1 text-center bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center min-h-[120px]">
                      <User className="w-5 h-5 mb-2 text-indigo-400 opacity-70" />
                      <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">My Deck</div>
                      <div className="text-sm font-bold text-zinc-200 line-clamp-3">{selectedMatch.myDeck || "不明"}</div>
                    </div>
                    <div className="bg-zinc-800 p-2 rounded-full border border-zinc-700 shrink-0">
                      <ArrowLeftRight className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div className="flex-1 text-center bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center min-h-[120px]">
                      <Swords className="w-5 h-5 mb-2 text-rose-400 opacity-70" />
                      <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Opponent</div>
                      <div className="text-sm font-bold text-zinc-200 line-clamp-3">{selectedMatch.opponentDeck || "不明"}</div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 bg-zinc-950/30 p-4 rounded-2xl border border-zinc-800/50">
                      <div className="flex-1">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Turn / Result
                        </div>
                        <div className="text-sm font-bold text-zinc-200">{selectedMatch.turn || "-"} • {(String(selectedMatch.result || "").includes('VIC') || selectedMatch.result === 'WIN') ? 'VICTORY' : 'LOSS'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-950/30 p-4 rounded-2xl border border-zinc-800/50">
                      <div className="flex-1">
                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Score / Mode
                        </div>
                        <div className="text-sm font-bold text-indigo-400">{selectedMatch.diff || selectedMatch.rating || "-"} <span className="text-zinc-500 font-normal uppercase text-[10px]">in {selectedMatch.mode || "不明"}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Memo Section */}
                  {selectedMatch.memo && (
                    <div className="bg-zinc-950/50 p-5 rounded-3xl border border-zinc-800 border-dashed">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3 text-indigo-400" /> Tags & Reasons
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedMatch.memo.split(',').map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 rounded-full font-medium">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-950/40 border-t border-zinc-800 text-center">
              {isEditing ? (
                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Undo2 className="w-4 h-4" /> Cancel
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-2xl transition-all shadow-lg active:scale-[0.98]"
                >
                  Close Summary
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// カスタムツールチップコンポーネント
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl space-y-1 min-w-[150px]">
        <div className="flex justify-between items-center gap-4">
          <div className="text-zinc-500 text-[10px]">{data.date}</div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {data.result}
          </div>
        </div>
        <div className="text-indigo-400 font-bold text-xl">{data.rating} <span className="text-[10px] text-zinc-500 font-normal ml-0.5">pts</span></div>
        <div className="border-t border-zinc-800 mt-2 pt-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
            <span className="text-zinc-400 text-[10px]">Your Deck:</span>
            <span className="text-zinc-200 text-[10px] font-medium truncate max-w-[100px]">{data.myDeck}</span>
          </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
              <span className="text-zinc-400 text-[10px]">Opponent:</span>
              <span className="text-zinc-200 text-[10px] font-medium truncate max-w-[100px]">{data.opponentDeck}</span>
            </div>
            {data.memo && (
              <div className="flex gap-1 flex-wrap mt-1">
                {data.memo.split(',').map((tag, idx) => (
                  <span key={idx} className="px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] border border-indigo-500/30">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
      </div>
    );
  }
  return null;
};

function StatCard({ title, value, icon, color = "text-zinc-100" }) {
  return (
    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center relative overflow-hidden group">
      <div className="text-zinc-400 text-sm mb-1 font-medium z-10">{title}</div>
      <div className={`text-3xl font-bold z-10 ${color}`}>{value}</div>
      {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-30 transition-opacity duration-300 transform group-hover:scale-110">{icon}</div>}
    </div>
  );
}

function DualRangeSlider({ min, max, value, onChange }) {
  const [minVal, maxVal] = value;
  
  const handleMinChange = (e) => {
    const val = Math.min(Number(e.target.value), maxVal);
    onChange([val, maxVal]);
  };
  
  const handleMaxChange = (e) => {
    const val = Math.max(Number(e.target.value), minVal);
    onChange([minVal, val]);
  };

  const range = Math.max(1, max - min);
  const minPercent = ((minVal - min) / range) * 100 || 0;
  const maxPercent = ((maxVal - min) / range) * 100 || 0;

  return (
    <div className="relative w-full h-5 flex items-center group">
      <div className="absolute w-full h-1 bg-zinc-700 rounded-full" />
      <div 
        className="absolute h-1 bg-indigo-500 rounded-full" 
        style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={minVal}
        onChange={handleMinChange}
        className={`absolute w-full appearance-none bg-transparent pointer-events-none 
                   [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none 
                   [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white 
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md 
                   ${minVal === max ? 'z-40' : 'z-20'}`}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={maxVal}
        onChange={handleMaxChange}
        className="absolute w-full appearance-none bg-transparent pointer-events-none z-30
                   [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none 
                   [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white 
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-md"
      />
    </div>
  );
}
