import React, { useMemo } from 'react';
import { Target, Flame, Activity, TrendingUp, TrendingDown, Shield } from 'lucide-react';

export default function FactorAnalysis({ records }) {
  // 1. レジリエンス分析（各種タグがついた「逆境」における自デッキごとの勝率）
  const resilienceData = useMemo(() => {
    if (!records || records.length === 0) return [];
    const deckStats = {};

    records.forEach(r => {
      // タグ（メモ）が無い試合はスキップ
      if (!r.memo || !r.memo.trim()) return;

      const tags = r.memo.split(/[,、，]+/).map(t => t.trim()).filter(Boolean);
      // タグの中に [+] （自分にとっての有利）以外の要素（不利または中立）が１つでも含まれている場合は、その試合を「逆境」とみなす
      const isAdversity = tags.some(t => !t.includes('[+]'));
      if (!isAdversity) return;

      const myDecks = String(r.myDeck || '').split(/[,、，]+/).map(t => t.trim()).filter(Boolean);
      if (myDecks.length === 0) return;

      // 最初のデッキだけを代表として扱う
      const d = myDecks[0];
      if (!deckStats[d]) deckStats[d] = { total: 0, wins: 0, tags: new Set() };
      
      deckStats[d].total += 1;
      if (String(r.result).toUpperCase().includes('VIC') || String(r.result).toUpperCase() === 'WIN') {
        deckStats[d].wins += 1;
      }

      // どんな困難があったか記録
      tags.forEach(tag => {
        deckStats[d].tags.add(tag);
      });
    });

    // 集計結果の整形（最低2試合以上の「逆境」を経験しているデッキのみ）
    return Object.entries(deckStats)
      .filter(([_, stats]) => stats.total >= 2)
      .map(([deck, stats]) => {
        const winRate = (stats.wins / stats.total) * 100;
        return {
          deck,
          ...stats,
          winRate,
          score: winRate * Math.log10(stats.total + 1) // 試合数も加味した総合レジリエンススコア
        };
      })
      .sort((a, b) => b.score - a.score); // スコア順（底力が高い順）
  }, [records]);

  // 2. 対面×要因 ヒートマップ (Matchup Issue Matrix)
  const { topOppDecks, topTags, heatmap } = useMemo(() => {
    if (!records || records.length === 0) return { topOppDecks: [], topTags: [], heatmap: {} };

    const tagCounts = {};
    const oppCounts = {};
    const matrix = {}; // matrix[oppDeck][tag] = count

    records.forEach(r => {
      if (!r.memo || !r.memo.trim()) return;
      const oppDecks = String(r.opponentDeck || '').split(/[,、，]+/).map(t => t.trim()).filter(Boolean);
      const tags = String(r.memo).split(/[,、，]+/).map(t => t.trim()).filter(Boolean);

      if (oppDecks.length === 0 || tags.length === 0) return;

      const mainOpp = oppDecks[0]; // 対面代表テーマ
      
      if (!matrix[mainOpp]) matrix[mainOpp] = {};
      
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        oppCounts[mainOpp] = (oppCounts[mainOpp] || 0) + 1;
        matrix[mainOpp][tag] = (matrix[mainOpp][tag] || 0) + 1;
      });
    });

    // スケールを制限するために上位の項目だけ抽出（相手デッキトップ8、タグトップ8）
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    const topOppDecks = Object.entries(oppCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);

    return { topOppDecks, topTags, heatmap: matrix };
  }, [records]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl">
      
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* レジリエンス（底力）分析 */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Deck Resilience Ranking</h3>
                <p className="text-[10px] text-zinc-500 font-bold mt-1">
                  要因タグが付いた（事故やミス等があった）不利な試合での勝率による底力評価
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {resilienceData.length > 0 ? resilienceData.map((d, i) => (
              <div key={i} className="flex items-center gap-4 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-zinc-200">{d.deck}</span>
                    <div className="flex flex-col items-end">
                      <span className={`text-lg font-black ${d.winRate >= 50 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {Math.round(d.winRate)}%
                      </span>
                      <span className="text-[8px] text-zinc-500 uppercase font-black uppercase tracking-widest">
                        {d.wins} W / {d.total} Matches
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${d.winRate >= 50 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-zinc-600 to-zinc-500'}`}
                      style={{ width: `${d.winRate}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {Array.from(d.tags).slice(0, 5).map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-zinc-800/50 text-[9px] text-zinc-400 rounded-md border border-zinc-700">
                        {tag}
                      </span>
                    ))}
                    {d.tags.size > 5 && (
                      <span className="px-2 py-0.5 text-[9px] text-zinc-500 rounded-md">+{d.tags.size - 5}</span>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                  逆境（要因タグ付き）のデータが不足しています
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* 対面×要因 ヒートマップ */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Matchup Issue Matrix</h3>
                <p className="text-[10px] text-zinc-500 font-bold mt-1">
                  どの相手デッキの時に、どの要因タグが多く発生しているか（ヒートマップ）
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar pb-4">
            {topOppDecks.length > 0 && topTags.length > 0 ? (
              <div className="min-w-max">
                <div className="flex">
                  <div className="w-32 shrink-0"></div>
                  {topTags.map(tag => (
                    <div key={tag} className="w-24 shrink-0 text-center pb-2 px-1 flex items-end justify-center">
                      <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest break-words line-clamp-2" title={tag}>
                        {tag}
                      </div>
                    </div>
                  ))}
                </div>
                
                {topOppDecks.map((oppDeck, i) => (
                  <div key={oppDeck} className="flex items-center mt-2 group border-b border-zinc-800/30 pb-2">
                    <div className="w-32 shrink-0 text-right pr-4">
                      <span className="text-[10px] font-black text-zinc-300 truncate block group-hover:text-amber-400 transition-colors" title={oppDeck}>
                        {oppDeck}
                      </span>
                    </div>
                    {topTags.map(tag => {
                      const count = heatmap[oppDeck]?.[tag] || 0;
                      // スケール計算（最大値に対する割合で濃さを決定）
                      let maxCount = 1;
                      topOppDecks.forEach(o => {
                        topTags.forEach(t => {
                          if (heatmap[o]?.[t] > maxCount) maxCount = heatmap[o][t];
                        });
                      });
                      const intensity = Math.min(100, Math.max(0, (count / maxCount) * 100));
                      
                      return (
                        <div key={tag} className="w-24 shrink-0 px-1 py-1 flex items-center justify-center">
                          {count > 0 ? (
                            <div 
                              className="w-full h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-inner transform transition-transform hover:scale-110 cursor-default"
                              style={{ 
                                backgroundColor: `rgba(245, 158, 11, ${Math.max(0.1, intensity / 100)})`, // Amber-500 base
                                border: `1px solid rgba(245, 158, 11, ${Math.max(0.2, (intensity / 100) + 0.2)})`
                              }}
                              title={`${oppDeck} に対して ${tag} が ${count} 回発生`}
                            >
                              {count}
                            </div>
                          ) : (
                            <div className="w-full h-8 rounded-lg bg-zinc-950 border border-zinc-900/50"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                  分析のためのタグデータが不足しています
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
