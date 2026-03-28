import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Trophy, Swords, XCircle, TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export default function Dashboard({ records }) {
  const [filterMode, setFilterMode] = useState('ALL');
  
  // フィルタリング処理
  const filteredRecords = useMemo(() => {
    if (filterMode === 'ALL') return records;
    return records.filter(r => r.mode === filterMode);
  }, [records, filterMode]);

  // 全体勝率の計算
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    let wins = 0;
    let losses = 0;
    let firstTurnWins = 0;
    let firstTurnTotal = 0;
    
    filteredRecords.forEach(r => {
      // 厳密な文字判定（OCRの揺れを考慮）
      const isWin = String(r.result).toUpperCase().includes('VIC');
      const isLoss = String(r.result).toUpperCase().includes('LOS') || String(r.result).includes('敗北');
      const isFirst = String(r.turn).includes('先');
      
      if (isWin) wins++;
      if (isLoss) losses++;
      if (isFirst) {
        firstTurnTotal++;
        if (isWin) firstTurnWins++;
      }
    });

    return {
      total,
      wins,
      losses,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : 0,
      firstTurnWinRate: firstTurnTotal > 0 ? ((firstTurnWins / firstTurnTotal) * 100).toFixed(1) : 0
    };
  }, [filteredRecords]);

  // 相手のデッキ分布データ
  const opponentDeckData = useMemo(() => {
    const counts = {};
    filteredRecords.forEach(r => {
      if (!r.opponentDeck) return;
      const decks = r.opponentDeck.split(',').map(d => d.trim());
      decks.forEach(d => {
        counts[d] = (counts[d] || 0) + 1;
      });
    });
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredRecords]);

  // 自分の使用デッキ別の勝率
  const myDeckWinRateData = useMemo(() => {
    const deckStats = {};
    filteredRecords.forEach(r => {
      if (!r.myDeck) return;
      const decks = r.myDeck.split(',').map(d => d.trim());
      const isWin = String(r.result).toUpperCase().includes('VIC');
      
      decks.forEach(d => {
        if (!deckStats[d]) deckStats[d] = { win: 0, total: 0 };
        deckStats[d].total++;
        if (isWin) deckStats[d].win++;
      });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Analytics Dashboard
        </h2>
        
        {/* Filter Controls */}
        <select 
          value={filterMode} 
          onChange={(e) => setFilterMode(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">全てのモード</option>
          <option value="ランク">ランク戦</option>
          <option value="DC">デュエリストカップ</option>
          <option value="レート">レート戦</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Matches" value={stats.total} icon={<Swords className="w-6 h-6 text-slate-400" />} />
        <StatCard title="Wins" value={stats.wins} icon={<Trophy className="w-6 h-6 text-yellow-500" />} />
        <StatCard title="Win Rate" value={`${stats.winRate}%`} color="text-emerald-400" />
        <StatCard title="1st Turn Win Rate" value={`${stats.firstTurnWinRate}%`} color="text-blue-400" />
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            Recent Matches
            <span className="text-xs text-zinc-500 font-normal">Latest {Math.min(filteredRecords.length, 10)}</span>
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-64">
            {filteredRecords.slice().reverse().slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{r.opponentDeck || "不明なデッキ"}</span>
                  <span className="text-xs text-zinc-500">{r.date.split(' ')[0]} • {r.mode} • {r.turn}</span>
                </div>
                <div className={`font-bold px-3 py-1 rounded-full ${String(r.result).includes('VIC') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {String(r.result).includes('VIC') ? 'WIN' : 'LOSE'}
                </div>
              </div>
            ))}
            {filteredRecords.length === 0 && (
              <div className="h-full flex items-center justify-center text-zinc-500">データがありません</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color = "text-zinc-100" }) {
  return (
    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 flex flex-col justify-center relative overflow-hidden group">
      <div className="text-zinc-400 text-sm mb-1 font-medium z-10">{title}</div>
      <div className={`text-3xl font-bold z-10 ${color}`}>{value}</div>
      {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-30 transition-opacity duration-300 transform group-hover:scale-110">{icon}</div>}
    </div>
  );
}
