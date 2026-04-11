import { useMemo } from 'react';

/**
 * カラーパレット定数
 */
export const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', 
  '#6366f1', '#f43f5e', '#06b6d4', '#84cc16', '#f97316', 
  '#a855f7', '#14b8a6'
];

/**
 * 統計情報の計算
 */
export const calculateStats = (records) => {
  const t = records.length;
  let w = 0, ft = 0, fw = 0, st = 0, sw = 0;
  records.forEach(r => {
    const isWin = String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN';
    if (isWin) w++;
    if (String(r.turn).includes('先')) {
      ft++;
      if (isWin) fw++;
    } else {
      st++;
      if (isWin) sw++;
    }
  });

  // 最近の勝敗履歴（最新10件）
  const form = records.slice(0, 10).map(r => 
    String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN' ? 'W' : 'L'
  ).reverse();

  return { 
    total: t, 
    wins: w, 
    winRate: t > 0 ? parseFloat(((w / t) * 100).toFixed(1)) : 0, 
    fRate: t > 0 ? parseFloat(((ft / t) * 100).toFixed(1)) : 0,
    fWinRate: ft > 0 ? parseFloat(((fw / ft) * 100).toFixed(1)) : 0, 
    sWinRate: st > 0 ? parseFloat(((sw / st) * 100).toFixed(1)) : 0,
    form
  };
};

/**
 * 指定されたフィルターに基づいたレコードの抽出
 */
export const getFilteredRecords = (records, filters) => {
  if (!Array.isArray(records)) return [];
  let r = records;
  const { mode, myDecks, opponentDecks, tags, dateType, startDate, endDate, chunkSize, setRange } = filters;

  if (dateType !== 'ALL') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    r = r.filter(v => {
      if (!v.date) return false;
      const d = new Date(String(v.date || "").replace(/\//g, '-'));
      if (dateType === 'TODAY') return d >= new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (dateType === '7D') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dateType === '30D') return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (dateType === 'CUSTOM') {
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

  if (mode && mode !== 'ALL') r = r.filter(v => String(v.mode || "").includes(String(mode).replace('戦', '')));
  if (myDecks && myDecks.length > 0) {
    r = r.filter(v => {
      const themes = String(v.myDeck || "").split(/[,、，]+/).map(x => String(x).trim()).filter(Boolean);
      return myDecks.every(f => themes.includes(f));
    });
  }
  if (opponentDecks && opponentDecks.length > 0) {
    r = r.filter(v => {
      const themes = String(v.opponentDeck || "").split(/[,、，]+/).map(x => String(x).trim()).filter(Boolean);
      return opponentDecks.every(f => themes.includes(f));
    });
  }

  if (tags && tags.length > 0) {
    r = r.filter(v => {
      const memoContent = String(v.memo || "");
      return tags.every(t => memoContent.includes(t));
    });
  }

  // UI表示順（反転：最新が上）
  r = r.slice().reverse();

  // チャンク指定がある場合
  if (chunkSize && chunkSize !== 'ALL' && setRange) {
    const s = parseInt(chunkSize, 10);
    const startSet = Math.min(setRange[0], setRange[1]);
    const endSet = Math.max(setRange[0], setRange[1]);
    const startIdx = (startSet - 1) * s;
    const endIdx = endSet * s;
    r = r.slice(startIdx, endIdx);
  }

  return r;
};

/**
 * 対戦相手デッキの集計
 */
export const getRankings = (records, minLimit) => {
  const s = {};
  records.forEach(r => { 
    const opponentDeckStr = r.opponentDeck || r.OpponentDeck;
    if (!opponentDeckStr) return; 
    const d = String(opponentDeckStr).split(/[,、，]+/).map(x => String(x).trim()).filter(Boolean).sort().join(' + '); 
    if (!d) return; 
    const w = String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN'; 
    if (!s[d]) s[d] = { t: 0, w: 0, ft: 0, fw: 0, st: 0, sw: 0 }; 
    s[d].t++; if (w) s[d].w++; 
    if (String(r.turn).includes('先')) { s[d].ft++; if (w) s[d].fw++; } else { s[d].st++; if (w) s[d].sw++; } 
  });
  return Object.entries(s).map(([n, x]) => ({ 
    name: n, total: x.t, winRate: parseFloat(((x.w / x.t) * 100).toFixed(1)), 
    firstRate: parseFloat(((x.ft / x.t) * 100).toFixed(1)),
    firstWinRate: x.ft > 0 ? parseFloat(((x.fw / x.ft) * 100).toFixed(1)) : 0, 
    secondWinRate: x.st > 0 ? parseFloat(((x.sw / x.st) * 100).toFixed(1)) : 0 
  })).filter(x => x.total >= (minLimit || 1));
};

/**
 * メインの分析フック
 */
export function useMatchAnalytics(records, filters) {
  // 1. レコードのフィルタリング
  const filteredRecords = useMemo(() => {
    return getFilteredRecords(records, filters);
  }, [records, filters]);

  // 2. 基本統計

  // 3. レート推移データ (Trend Data)
  const trendData = useMemo(() => {
    // レートの値が存在しているレコードのみを抽出してグラフ化
    const rMap = [...filteredRecords]
      .reverse()
      .filter(x => {
        const raw = String(x.diff || "").replace(/[^0-9.-]/g, '');
        return raw !== "" && !isNaN(parseFloat(raw));
      })
      .map((x, i) => { 
        const rawVal = String(x.diff).replace(/[^0-9.-]/g, '');
        const delta = parseFloat(rawVal);
        
        return { 
          index: i + 1, 
          rating: delta, 
          opponentDeck: x.opponentDeck || "UNKNOWN", 
          result: String(x.result).toUpperCase().includes('VIC') ? 'WIN' : 'LOSE', 
          date: String(x.date || "").split(' ')[0], 
          myDeck: x.myDeck
        }; 
      });
    
    return rMap;
  }, [filteredRecords]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const wins = filteredRecords.filter(r => String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN').length;
    
    const firstMatches = filteredRecords.filter(r => String(r.turn).includes('先'));
    const secondMatches = filteredRecords.filter(r => !String(r.turn).includes('先'));
    const fWins = firstMatches.filter(r => String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN').length;
    const sWins = secondMatches.filter(r => String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN').length;

    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";
    const fRate = total > 0 ? (firstMatches.length / total * 100).toFixed(1) : "0.0";
    const fWinRate = firstMatches.length > 0 ? (fWins / firstMatches.length * 100).toFixed(1) : "0.0";
    const sWinRate = secondMatches.length > 0 ? (sWins / secondMatches.length * 100).toFixed(1) : "0.0";

    // 5. Streak計算 (最新から遡る)
    let streakCount = 0;
    let streakType = null;
    if (filteredRecords.length > 0) {
      for (const r of filteredRecords) {
        const isWin = String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN';
        if (streakCount === 0) {
          streakType = isWin ? 'WIN' : 'LOSS';
          streakCount = 1;
        } else if ((isWin && streakType === 'WIN') || (!isWin && streakType === 'LOSS')) {
          streakCount++;
        } else {
          break;
        }
      }
    }

    const form = filteredRecords.slice(0, 10).map(r => (String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN') ? 'W' : 'L').reverse();

    return { 
      total, wins, winRate, 
      fRate, fWinRate, fWins, fTotal: firstMatches.length,
      sWinRate, sWins, sTotal: secondMatches.length,
      streak: { type: streakType, count: streakCount },
      form 
    };
  }, [filteredRecords]);
  // 4. タグ発生傾向 (Tag Trend Data)
  const tagTrendData = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return { data: [], tags: [] };
    
    const allTags = {};
    filteredRecords.forEach(r => {
      if (r.memo) String(r.memo).split(/[,、，]+/).forEach(t => {
        const tag = String(t).trim();
        if (tag) allTags[tag] = (allTags[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(allTags).sort((a,b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
    
    const segments = 8;
    const binSize = Math.max(1, Math.ceil(filteredRecords.length / segments));
    const bins = [];
    const chronRecords = [...filteredRecords].reverse();
    
    for (let i = 0; i < chronRecords.length; i += binSize) {
      const chunk = chronRecords.slice(i, i + binSize);
      const dataPoint = { name: `${i + 1}-${Math.min(i + binSize, chronRecords.length)}` };
      topTags.forEach(tag => {
        dataPoint[tag] = chunk.filter(r => String(r.memo).includes(tag)).length;
      });
      bins.push(dataPoint);
    }
    return { data: bins, tags: topTags };
  }, [filteredRecords]);

  // 5. 自分の使用デッキ別統計 (My Deck Stats)
  const myDeckStats = useMemo(() => {
    const s = {};
    filteredRecords.forEach(r => { 
      if (r.myDeck) { 
        const d = String(r.myDeck).split(/[,、，]+/).map(x => String(x).trim()).filter(Boolean).sort().join(' + '); 
        if (!d) return; 
        if (!s[d]) s[d] = { w: 0, t: 0 }; 
        s[d].t++; 
        if (String(r.result).toUpperCase().includes('VIC') || r.result === 'WIN') s[d].w++; 
      } 
    });
    return Object.entries(s).map(([n, v]) => ({ 
      name: n, 
      winRate: parseFloat(((v.w / v.t) * 100).toFixed(1)), 
      wins: v.w, 
      total: v.t 
    })).sort((a,b) => b.total - a.total).slice(0, 6);
  }, [filteredRecords]);

  const rankings = useMemo(() => {
    return getRankings(filteredRecords).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  return {
    filteredRecords,
    stats,
    trendData,
    tagTrendData,
    myDeckStats,
    rankings
  };
}
