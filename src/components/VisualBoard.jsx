import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { Trophy, TrendingUp, Activity, Target, BarChart2 } from 'lucide-react';
import { useMatchAnalytics, COLORS } from '../hooks/useMatchAnalytics';

/**
 * 共通ウィジェットカード（透過・発光デザイン）
 */
export const WidgetCard = ({ children, title, className = "" }) => {
  const isObs = new URLSearchParams(window.location.search).get('view') === 'obs';
  return (
    <div className={`relative ${isObs ? 'bg-zinc-950/90' : 'bg-zinc-950/20 backdrop-blur-sm'} border border-white/10 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden group hover:border-indigo-500/30 transition-all duration-500 ${className}`}>
      {title && (
        <div className="absolute top-4 left-6 flex items-center gap-2 z-10">
          <div className="w-1 h-3 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          <span className="text-[12px] font-black text-zinc-300 uppercase tracking-[0.2em]">{title}</span>
        </div>
      )}
      <div className="h-full pt-6">
        {children}
      </div>
    </div>
  );
};

/**
 * カスタムツールチップ（情報の厚みを出す）
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isWin = data.result === 'WIN';
    return (
      <div className="bg-zinc-950/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-2">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">#{data.index} • {data.date}</span>
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {data.result}
          </span>
        </div>
        <div className="text-xs font-bold text-zinc-100 mb-1">{data.opponentDeck || 'UNKNOWN'}</div>
        <div className="text-xl font-black text-indigo-400">Rate: {Math.round(data.rating)}</div>
      </div>
    );
  }
  return null;
};

/**
 * 1. Rating Trend Widget
 */
export const RatingWidget = ({ data }) => (
  <WidgetCard title="Rating Trajectory" className="h-[400px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
        <XAxis 
          dataKey="index" 
          stroke="#a1a1aa" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false}
          minTickGap={30}
          tickFormatter={(idx) => {
            const item = data.find(d => d.index === idx);
            if (!item) return '';
            const shortDate = item.date.split('/')[1] ? item.date.split('/').slice(1).join('/') : item.date;
            return `${idx} (${shortDate})`;
          }}
        />
        <YAxis 
          domain={['auto', 'auto']} 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 'bold' }}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />
        <Line 
          type="monotone" 
          dataKey="rating" 
          stroke="#6366f1" 
          strokeWidth={3} 
          dot={{ r: 3, fill: '#6366f1', strokeWidth: 2, stroke: '#18181b' }}
          activeDot={{ r: 6, fill: '#818cf8', strokeWidth: 0 }}
          animationDuration={2000}
          isAnimationActive={true}
          filter="url(#glow)"
        />
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
      </LineChart>
    </ResponsiveContainer>
  </WidgetCard>
);

/**
 * 2. Win Rate & Stats Widget
 */
export const WinRateWidget = ({ stats }) => (
  <WidgetCard title="Performance" className="aspect-square flex flex-col items-center justify-center text-center">
    <div className="relative flex flex-col items-center justify-center py-4">
      {/* 巨大なパーセンテージ表示 */}
      <div className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
        {Math.round(stats.winRate)}<span className="text-2xl text-indigo-400 ml-1">%</span>
      </div>
      <div className="text-[14px] font-black text-zinc-400 uppercase tracking-widest mt-2">Win Rate</div>
      
      {/* シンプルな戦績表示 */}
      <div className="mt-8 flex gap-8">
        <div className="text-center">
          <div className="text-2xl font-black text-emerald-400 leading-none">{stats.wins}</div>
          <div className="text-[11px] font-black text-zinc-400 uppercase mt-1">Wins</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-rose-500 leading-none">{stats.total - stats.wins}</div>
          <div className="text-[11px] font-black text-zinc-400 uppercase mt-1">Loss</div>
        </div>
      </div>
    </div>
  </WidgetCard>
);

/**
 * 3. Recent Matches (History Dots) Widget
 */
export const RecentMatchesWidget = ({ form }) => (
  <WidgetCard title="Recent Form" className="py-8">
    <div className="flex items-center justify-center gap-3 px-2">
      {form.map((res, i) => (
        <div 
          key={i} 
          className={`w-4 h-10 rounded-full transition-all duration-1000 transform animate-in zoom-in slide-in-from-left-2 ${
            res === 'W' 
            ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
            : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
          }`}
          style={{ 
            opacity: 0.2 + (i / form.length) * 0.8,
            animationDelay: `${i * 100}ms`
          }}
        />
      ))}
    </div>
    <div className="flex justify-between mt-4 text-[11px] font-black text-zinc-400 uppercase tracking-widest px-4">
      <span>Older</span>
      <span>Latest</span>
    </div>
  </WidgetCard>
);

/**
 * 4.5. Matchup Win Rate Widget (BarChart)
 */
export const MatchupWinRateWidget = ({ rankings }) => {
  const displayData = useMemo(() => (rankings || []).slice(0, 6), [rankings]);
  
  return (
    <WidgetCard title="Matchup Performance" className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#a1a1aa" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
            interval={0}
            angle={-15}
            textAnchor="end"
          />
          <YAxis 
            domain={[0, 100]} 
            hide 
          />
          <Tooltip 
            cursor={{ fill: 'white', opacity: 0.05 }}
            contentStyle={{ backgroundColor: '#09090b', border: '1px solid #18181b', borderRadius: '12px', fontSize: '10px', color: '#fff' }} 
            formatter={(value) => [`${value.toFixed(1)}%`, 'Win Rate']}
          />
          <Bar dataKey="winRate" radius={[6, 6, 0, 0]} barSize={24}>
            {displayData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.winRate >= 50 ? '#10b981' : '#f43f5e'} 
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
};

/**
 * 4. Factor Breakdown Trend Widget (AreaChart)
 */
export const CauseTrendWidget = ({ data }) => (
  <WidgetCard title="Factor Breakdown Trend" className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.data} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
        <XAxis dataKey="name" hide />
        <YAxis hide />
        <Tooltip 
          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #18181b', borderRadius: '12px', fontSize: '10px', color: '#fff' }} 
        />
        {data.tags.map((tag, idx) => (
          <Area 
            key={tag} 
            type="monotone" 
            dataKey={tag} 
            stackId="1" 
            stroke={COLORS[idx % COLORS.length]} 
            fill={COLORS[idx % COLORS.length]} 
            fillOpacity={0.6} 
            animationDuration={1500}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  </WidgetCard>
);

/**
 * 5. Turn-Specific Detailed Stats Widget (Table)
 */
export const TurnStatsWidget = ({ stats }) => (
  <WidgetCard title="Turn Specific Stats">
    <div className="grid grid-cols-2 gap-4 mt-2">
      <div className="col-span-2 bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/5">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Coin Toss Luck</span>
          <span className="text-xl font-black text-indigo-400">{stats.fRate}% <span className="text-[10px] text-zinc-500 font-bold uppercase ml-1">First</span></span>
        </div>
        <Target className="w-6 h-6 text-zinc-700 opacity-40" />
      </div>
      
      <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
        <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">First Turn</div>
        <div className="text-xl font-black text-zinc-100">{stats.fWinRate}%</div>
        <div className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{stats.fWins} / {stats.fTotal} Wins</div>
      </div>

      <div className="bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/10">
        <div className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest mb-1">Second Turn</div>
        <div className="text-xl font-black text-zinc-100">{stats.sWinRate}%</div>
        <div className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{stats.sWins} / {stats.sTotal} Wins</div>
      </div>
    </div>
  </WidgetCard>
);

/**
 * 6. Current Win/Loss Streak Widget
 */
export const StreakWidget = ({ streak }) => {
  const isWin = streak.type === 'WIN';
  const colorClass = isWin ? 'text-emerald-400' : 'text-rose-400';
  const glowClass = isWin ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/20' : 'shadow-[0_0_20px_rgba(244,63,94,0.3)] border-rose-500/20';
  
  return (
    <WidgetCard title="Current Streak">
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className={`px-8 py-4 rounded-3xl bg-white/5 border ${glowClass} transition-all duration-1000 transform scale-110`}>
          <div className={`text-6xl font-black tracking-tighter ${colorClass} drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
            {streak.count}
          </div>
          <div className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] mt-2 italic">
            Matches {isWin ? 'Running' : 'Losing'}
          </div>
        </div>
        <div className={`mt-6 text-lg font-black uppercase tracking-widest flex items-center gap-2 ${colorClass}`}>
          {isWin ? (
            <><Trophy className="w-5 h-5 shadow-sm" /> Winning Streak</>
          ) : (
            <><Activity className="w-5 h-5 opacity-60" /> Losing Streak</>
          )}
        </div>
      </div>
    </WidgetCard>
  );
};

/**
 * 7. Summary Bar Widget (Horizontal Banner)
 */
export const SummaryBarWidget = ({ stats }) => (
  <div className="bg-zinc-950/40 backdrop-blur-md border-y border-white/10 w-full py-4 flex items-center justify-around px-10 shadow-2xl">
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Matches</span>
      <span className="text-xl font-black text-zinc-100">{stats.total}</span>
    </div>
    <div className="w-px h-8 bg-white/5" />
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Win Rate</span>
      <span className="text-xl font-black text-emerald-400">{stats.winRate}%</span>
    </div>
    <div className="w-px h-8 bg-white/5" />
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Coin Toss</span>
      <span className="text-xl font-black text-indigo-400">{stats.fRate}% <span className="text-[10px] text-zinc-500 ml-1">1st</span></span>
    </div>
    <div className="w-px h-8 bg-white/5" />
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Streak</span>
      <span className={`text-xl font-black ${stats.streak.type === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>
        {stats.streak.count} {stats.streak.type === 'WIN' ? 'W' : 'L'}
      </span>
    </div>
  </div>
);

/**
 * 8. My Decks Stats Widget (List)
 */
export const MyDeckStatsWidget = ({ myDeckStats }) => (
  <WidgetCard title="My Decks Performance">
    <div className="space-y-3 mt-2">
      {myDeckStats.map((d, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-zinc-200 uppercase tracking-tight truncate max-w-[140px]">{d.name}</span>
              <span className="text-[9px] text-zinc-500 font-bold uppercase">{d.total} matches</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-black tracking-tighter ${d.winRate >= 50 ? 'text-emerald-400' : 'text-zinc-500'}`}>{d.winRate}%</span>
              <span className="text-[8px] block text-zinc-500 font-black uppercase -mt-1">Win Rate</span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5 mb-1">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out 
                ${d.winRate >= 60 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                  d.winRate >= 50 ? 'bg-gradient-to-r from-indigo-600 to-indigo-400' : 
                  'bg-gradient-to-r from-zinc-700 to-zinc-500'}`}
              style={{ width: `${d.winRate}%` }}
            />
          </div>
        </div>
      ))}
      {myDeckStats.length === 0 && <div className="py-10 text-center text-zinc-700 italic text-xs">No data available</div>}
    </div>
  </WidgetCard>
);

/**
 * 9. Matchup Table Widget (Top Opponents)
 */
export const MatchupTableWidget = ({ rankings = [] }) => {
  const topRankings = useMemo(() => (rankings || []).slice(0, 5), [rankings]);
  return (
    <WidgetCard title="Top Matchup Rankings">
      <div className="space-y-2 mt-2">
        {topRankings.map((r, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-zinc-600 w-4">#{i+1}</span>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-zinc-200 uppercase tracking-tight truncate max-w-[160px]">{r.name}</span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase">{r.total} matches</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <span className={`text-sm font-black ${r.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.winRate}%</span>
                  <span className="text-[8px] block text-zinc-500 font-black uppercase -mt-1">WR</span>
                </div>
              </div>
            </div>
            <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out 
                  ${r.winRate >= 60 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                    r.winRate >= 50 ? 'bg-gradient-to-r from-indigo-600 to-indigo-400' : 
                    'bg-gradient-to-r from-zinc-700 to-zinc-500'}`}
                style={{ width: `${r.winRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};


/**
 * メインボード
 */
export default function VisualBoard({ records, lastUpdated }) {
  // OBSモードでは基本的に全てのフィルタリングをオフ（全期間）にするか、
  // URLパラメータでフィルターも制御できるようにすると便利
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const widgetType = query.get('widget') || 'all';

  // 分析データの取得
  const filters = useMemo(() => {
    const dType = query.get('dateType') || 'ALL';
    const mode = query.get('mode') || 'ALL';
    const myDecks = query.get('myDecks') ? query.get('myDecks').split(',').filter(Boolean) : [];
    const opponentDecks = query.get('opponentDecks') ? query.get('opponentDecks').split(',').filter(Boolean) : [];
    const tags = query.get('tags') ? query.get('tags').split(',').filter(Boolean) : [];
    const sDate = query.get('startDate') || "";
    const eDate = query.get('endDate') || "";
    const cSize = query.get('chunkSize') || 'ALL';
    const sRangeRaw = query.get('setRange') || '1-1';
    const sRange = sRangeRaw.split('-').map(n => parseInt(n, 10) || 1);

    return {
      dateType: dType,
      mode: mode,
      myDecks: myDecks,
      opponentDecks: opponentDecks,
      tags: tags,
      startDate: sDate,
      endDate: eDate,
      chunkSize: cSize,
      setRange: sRange
    };
  }, [query]);

  const { stats, trendData, tagTrendData, rankings } = useMatchAnalytics(records, filters);

  // ウィジェット単体表示モードの判定
  if (widgetType === 'rating') return <div className="p-4 w-[600px] bg-transparent"><RatingWidget data={trendData} /></div>;
  if (widgetType === 'winrate') return <div className="p-4 w-[300px] bg-transparent"><WinRateWidget stats={stats} /></div>;
  if (widgetType === 'recent') return <div className="p-4 w-[400px] bg-transparent"><RecentMatchesWidget form={stats.form} /></div>;
  if (widgetType === 'cause') return <div className="p-4 w-[600px] bg-transparent"><CauseTrendWidget data={tagTrendData} /></div>;
  if (widgetType === 'matchup') return <div className="p-4 w-[600px] bg-transparent"><MatchupWinRateWidget rankings={rankings} /></div>;
  if (widgetType === 'turn') return <div className="p-4 w-[400px] bg-transparent"><TurnStatsWidget stats={stats} /></div>;
  if (widgetType === 'streak') return <div className="p-4 w-[400px] bg-transparent"><StreakWidget streak={stats.streak} /></div>;
  if (widgetType === 'summary') return <SummaryBarWidget stats={stats} />;
  if (widgetType === 'mydecks') return <div className="p-4 w-[400px] bg-transparent"><MyDeckStatsWidget myDeckStats={myDeckStats} /></div>;
  if (widgetType === 'rankings') return <div className="p-4 w-[500px] bg-transparent"><MatchupTableWidget rankings={rankings} /></div>;

  // デフォルト（全表示）
  return (
    <div className="p-10 max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 bg-transparent pb-32">
      <div className="md:col-span-2 space-y-8">
        <RatingWidget data={trendData} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CauseTrendWidget data={tagTrendData} />
          <MatchupWinRateWidget rankings={rankings} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TurnStatsWidget stats={stats} />
          <StreakWidget streak={stats.streak} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <MyDeckStatsWidget myDeckStats={myDeckStats} />
          <MatchupTableWidget rankings={rankings} />
        </div>
        <SummaryBarWidget stats={stats} />
      </div>
      <div className="md:col-span-1 space-y-8">
        <WinRateWidget stats={stats} />
        <RecentMatchesWidget form={stats.form} />
      </div>
      
      {/* 配信向けのインフォメーション */}
      <div className="md:col-span-3 text-center pt-8">
        <div className="inline-flex items-center gap-4 px-6 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          <Activity className="w-3 h-3 text-indigo-500" />
          Live Analytics Engine Active
          {lastUpdated && (
            <span className="text-zinc-600 border-l border-white/10 pl-4 ml-2">
              Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />
        </div>
      </div>
    </div>
  );
}
