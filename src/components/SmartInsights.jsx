import React, { useMemo } from 'react';
import { TrendingDown, Swords, Zap, Lightbulb, Activity, User, Target, Flame, ShieldCheck, TrendingUp, Info } from 'lucide-react';

export default function SmartInsights({ records, availableTags }) {
  const analysis = useMemo(() => {
    if (!records || records.length < 5) return null;
    const list = [];
    const winRate = (recs) => {
      if (!recs.length) return 0;
      return (recs.filter(r => String(r.result).includes('VIC')).length / recs.length) * 100;
    };

    const globalWinRate = winRate(records);

    // --- 1. 自己責任指数 (Self-Accountability Index) ---
    let selfCount = 0;
    let enemyCount = 0;
    records.forEach(r => {
      if (!r.memo) return;
      const tags = r.memo.split(/[,、，]+/).map(t => t.trim());
      tags.forEach(t => {
        // [+][-] 記法、または従来の 自：/敵： 記法をサポート
        // プレミは暗黙的に自：[-] とみなす
        const isSelf = t.includes('自：') || t.includes('プレミ');
        const isNegative = t.includes('[-] ') || (!t.includes('[+]') && !t.includes('敵：')); // [+] がなければ基本は不利益
        
        if (isSelf && isNegative) selfCount++;
        else if (t.includes('敵：') && isNegative) enemyCount++; // 敵：がついた「不利なこと」
      });
    });
    const totalAccountability = selfCount + enemyCount;
    const selfRatio = totalAccountability > 0 ? (selfCount / totalAccountability) * 100 : 50;

    // --- 2. 潜在勝率 (Potential Win Rate) ---
    // 「自：」系の不利タグ（[+]を含まないもの）が付いている敗北試合を「勝ち」に変換して勝率を再計算
    const wins = records.filter(r => String(r.result).includes('VIC')).length;
    const lossesWithSelfErr = records.filter(r => {
      const isLoss = !String(r.result).includes('VIC');
      if (!isLoss || !r.memo) return false;
      const tags = r.memo.split(/[,、，]+/).map(t => t.trim());
      return tags.some(t => {
        const isSelf = t.includes('自：');
        const isNegative = !t.includes('[+]'); // [+] が含まれていなければ不利要因とみなす
        return isSelf && isNegative;
      });
    }).length;

    const potentialWins = wins + lossesWithSelfErr;
    const potentialWR = (potentialWins / records.length) * 100;
    const wrLift = potentialWR - globalWinRate;

    // --- 3. 既存のインサイト抽出 (Nemesis, Turn Bias, etc.) ---
    
    // Nemesis
    const deckStats = {};
    records.forEach(r => {
      const d = r.opponentDeck || 'Unknown';
      if (!deckStats[d]) deckStats[d] = { count: 0, diffSum: 0 };
      deckStats[d].count++;
      deckStats[d].diffSum += parseFloat(String(r.diff).replace(/[^0-9.-]/g, '')) || 0;
    });
    const nemesis = Object.entries(deckStats)
      .filter(([_, s]) => s.count >= 2)
      .sort((a, b) => a[1].diffSum - b[1].diffSum)[0];

    if (nemesis && nemesis[1].diffSum < -30) {
      list.push({
        id: 'nemesis',
        icon: <TrendingDown className="w-5 h-5 text-rose-500" />,
        title: 'Hidden Nemesis',
        text: `【${nemesis[0]}】との対戦で累計 ${Math.abs(Math.round(nemesis[1].diffSum))} ポイントを失っています。最も警戒すべき相手です。`,
        borderColor: 'border-rose-500/30',
        bgColor: 'bg-rose-500/5',
        accentColor: 'bg-rose-500'
      });
    }

    // Turn Bias
    const firstMatches = records.filter(r => String(r.turn).includes('先'));
    const secondMatches = records.filter(r => String(r.turn).includes('後'));
    if (firstMatches.length >= 3 && secondMatches.length >= 3) {
      const wr1 = winRate(firstMatches);
      const wr2 = winRate(secondMatches);
      const diff = Math.abs(wr1 - wr2);
      if (diff > 20) {
        const better = wr1 > wr2 ? '先攻' : '後攻';
        const worse = wr1 > wr2 ? '後攻' : '先攻';
        list.push({
          id: 'turn-bias',
          icon: <Swords className="w-5 h-5 text-amber-500" />,
          title: 'Turn Priority Bias',
          text: `${better}時の勝率は ${Math.round(wr1 > wr2 ? wr1 : wr2)}% ですが、${worse}時は ${Math.round(wr1 > wr2 ? wr2 : wr1)}% に留まっています。`,
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-500/5',
          accentColor: 'bg-amber-500'
        });
      }
    }

    // Tag Correlation (Critical Factor)
    if (availableTags && availableTags.length > 0) {
      const tagImpacts = availableTags.map(tag => {
        const matchesWithTag = records.filter(r => String(r.memo).includes(tag));
        if (matchesWithTag.length < 2) return null;
        const wrWithTag = winRate(matchesWithTag);
        return { tag, wr: wrWithTag, count: matchesWithTag.length, diff: wrWithTag - globalWinRate };
      }).filter(x => x && x.diff < -15);
      const worstTag = tagImpacts.sort((a, b) => a.diff - b.diff)[0];
      if (worstTag) {
        list.push({
          id: 'tag-impact',
          icon: <Zap className="w-5 h-5 text-indigo-500" />,
          title: 'Critical Factor',
          text: `「${worstTag.tag}」がある試合の勝率は ${Math.round(worstTag.wr)}% です（平均 ${Math.round(globalWinRate)}%）。この状況への対策が重要です。`,
          borderColor: 'border-indigo-500/30',
          bgColor: 'bg-indigo-500/5',
          accentColor: 'bg-indigo-500'
        });
      }
    }

    return {
      insights: list.slice(0, 3),
      selfRatio,
      potentialWR,
      wrLift,
      totalAccountability,
      globalWinRate,
      tagRate: Math.round((records.filter(r => r.memo && r.memo.trim().length > 0).length / records.length) * 100)
    };
  }, [records, availableTags]);

  if (!analysis) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-6 shadow-2xl animate-in fade-in duration-700 max-w-2xl mx-auto my-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
        <div className="w-20 h-20 bg-zinc-950 border border-zinc-800 rounded-3xl flex items-center justify-center mb-2 shadow-inner group">
          <Activity className="w-10 h-10 text-zinc-700 group-hover:text-amber-500 transition-colors animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">分析データ不足</h3>
          <p className="text-sm text-zinc-500 leading-relaxed font-medium mx-auto max-w-sm">
            AIによる詳細な分析を行うには、現在のフィルター条件下で **少なくとも5試合以上の対戦データ** が必要です。
          </p>
        </div>
        <div className="pt-4">
          <div className="px-4 py-2 bg-zinc-800 rounded-xl text-[10px] font-black text-zinc-400 uppercase tracking-widest border border-zinc-700/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500/50" />
            現在の試合数: {records?.length || 0} / 5
          </div>
        </div>
      </div>
    );
  }

  const { selfRatio, potentialWR, wrLift, globalWinRate, insights, tagRate } = analysis;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Visual Header Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* accountability Balance Chart */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:opacity-10 transition-opacity">
            <User className="w-32 h-32 text-white" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> 自己責任指数 (Accountability)
              </span>
              <h4 className="text-white font-bold text-sm">要因の分布比率</h4>
            </div>
            <div className="text-right">
              <span className={`text-xs font-black p-1.5 rounded-lg ${selfRatio > 50 ? 'text-amber-400 bg-amber-500/10' : 'text-indigo-400 bg-indigo-500/10'}`}>
                {selfRatio > 50 ? "スキル課題優勢" : "環境/運起因優勢"}
              </span>
            </div>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="h-6 w-full bg-zinc-950 rounded-xl overflow-hidden flex border border-zinc-900 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-1000 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                style={{ width: `${selfRatio}%` }}
              />
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                style={{ width: `${100 - selfRatio}%` }} 
              />
            </div>
            <div className="flex justify-between items-center px-1">
              <div className="flex flex-col">
                <span className="text-[9px] text-amber-500 font-black uppercase">自（スキル/判断）</span>
                <span className="text-lg font-black text-white">{Math.round(selfRatio)}%</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-indigo-400 font-black uppercase">敵（運/相性/環境）</span>
                <span className="text-lg font-black text-white">{Math.round(100 - selfRatio)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Potential Win Rate Card */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-zinc-900/80 to-emerald-500/5 border border-indigo-500/20 p-5 rounded-2xl shadow-xl flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase mb-1 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 animate-pulse" /> 潜在勝率 (Potential WR)
              </span>
              <h4 className="text-zinc-200 font-bold text-sm">ミスをゼロにした場合の予測</h4>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-black text-emerald-400">+{Math.round(wrLift)}% LIFT</span>
            </div>
          </div>

          <div className="flex items-end gap-6 mt-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold">CURRENT</span>
              <span className="text-2xl font-black text-zinc-500">{Math.round(globalWinRate)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-500 font-black tracking-tighter">IDEAL GOAL</span>
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-emerald-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {Math.round(potentialWR)}%
              </span>
            </div>
            <div className="flex-1 text-right pb-1">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center ml-auto transform group-hover:rotate-12 transition-transform duration-500">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Insights Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-white tracking-widest uppercase italic">Pattern Detection Highlights</h3>
          </div>
          <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900 shadow-inner">
            <Info className="w-3 h-3 text-zinc-500" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase">タグ付け精度 {tagRate}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
          {insights.map(item => (
            <div 
              key={item.id} 
              className={`p-5 rounded-2xl ${item.bgColor} border ${item.borderColor} flex flex-col gap-3 relative overflow-hidden group transition-all shadow-lg hover:bg-zinc-900/80 hover:-translate-y-1`}
            >
              <div className={`absolute top-0 left-0 w-1.5 h-full ${item.accentColor} opacity-50`} />
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                  {item.icon}
                </div>
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{item.title}</h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                {item.text}
              </p>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="col-span-3 p-8 rounded-2xl border border-dashed border-zinc-800 text-center">
              <p className="text-zinc-600 text-xs italic font-medium tracking-wide">さらに特定のパターンを検知するには、より多くの敗因タグが必要です。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

