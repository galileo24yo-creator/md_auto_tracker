import { useMemo } from 'react';
import { normalizeTheme, normalizeThemeString } from '../lib/themeUtils';

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
      // 事前正規化データがあればそれを使用（超高速）、なければ従来通り
      const themes = v._myThemes || String(v.myDeck || "").split(/[,、，\+]+/).map(x => normalizeTheme(x)).filter(Boolean);
      return myDecks.every(f => themes.includes(normalizeTheme(f)));
    });
  }
  if (opponentDecks && opponentDecks.length > 0) {
    r = r.filter(v => {
      // 事前正規化データがあればそれを使用（超高速）、なければ従来通り
      const themes = v._oppThemes || String(v.opponentDeck || "").split(/[,、，\+]+/).map(x => normalizeTheme(x)).filter(Boolean);
      return opponentDecks.every(f => themes.includes(normalizeTheme(f)));
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
    const d = normalizeThemeString(opponentDeckStr);
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
    // 【最適化】5000件全部描画すると重いため、直近500件に制限
    const rMap = [...filteredRecords]
      .reverse()
      .filter(x => {
        const raw = String(x.diff || "").replace(/[^0-9.-]/g, '');
        return raw !== "" && !isNaN(parseFloat(raw));
      })
      .slice(-500) // 最新500件のみ描画
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
    let w = 0, ft = 0, fw = 0, st = 0, sw = 0;
    const total = filteredRecords.length;
    
    // 1-パスで統計項目をすべて集計 (事前計算フラグを活用)
    filteredRecords.forEach(r => {
      if (r._isWin) w++;
      if (r._isFirst) {
        ft++;
        if (r._isWin) fw++;
      } else {
        st++;
        if (r._isWin) sw++;
      }
    });

    const winRate = total > 0 ? (w / total * 100).toFixed(1) : "0.0";
    const fRate = total > 0 ? (ft / total * 100).toFixed(1) : "0.0";
    const fWinRate = ft > 0 ? (fw / ft * 100).toFixed(1) : "0.0";
    const sWinRate = st > 0 ? (sw / st * 100).toFixed(1) : "0.0";

    // 5. Streak計算 (最新から遡る)
    let streakCount = 0;
    let streakType = null;
    if (total > 0) {
      for (const r of filteredRecords) {
        const isWin = r._isWin;
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

    const form = filteredRecords.slice(0, 10).map(r => r._isWin ? 'W' : 'L').reverse();

    return { 
      total, wins: w, winRate, 
      fRate, fWinRate, fWins: fw, fTotal: ft,
      sWinRate, sWins: sw, sTotal: st,
      streak: { type: streakType, count: streakCount },
      form 
    };
  }, [filteredRecords]);
  // 4. タグ発生傾向 (Tag Trend Data)
  const tagTrendData = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return { data: [], tags: [] };
    
    // 1. トップタグの抽出 (事前パースデータを利用)
    const allTags = {};
    filteredRecords.forEach(r => {
      if (r._tags) r._tags.forEach(tag => {
        allTags[tag] = (allTags[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(allTags).sort((a,b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
    
    // 2. セグメントごとの一括集計 (1-パスで全セグメントを数える)
    const segments = 8;
    const chronRecords = [...filteredRecords].reverse();
    const binSize = Math.max(1, Math.ceil(chronRecords.length / segments));
    const bins = [];
    
    // 枠組みを先に作る
    for (let i = 0; i < chronRecords.length; i += binSize) {
      const dataPoint = { 
        name: `${i + 1}-${Math.min(i + binSize, chronRecords.length)}`,
      };
      topTags.forEach(t => dataPoint[t] = 0);
      bins.push({ dataPoint, start: i, end: Math.min(i + binSize, chronRecords.length) });
    }

    // 各レコードがいずれのセグメントに属するか判定しながら一度にカウント
    chronRecords.forEach((r, idx) => {
      if (!r._tags) return;
      // どのビンに属するか計算
      const binIdx = Math.floor(idx / binSize);
      if (bins[binIdx]) {
        r._tags.forEach(tag => {
          if (topTags.includes(tag)) {
            bins[binIdx].dataPoint[tag]++;
          }
        });
      }
    });

    return { 
      data: bins.map(b => b.dataPoint), 
      tags: topTags 
    };
  }, [filteredRecords]);

  // 5. 自分の使用デッキ別統計 (My Deck Stats)
  const myDeckStats = useMemo(() => {
    const s = {};
    filteredRecords.forEach(r => { 
      if (r.myDeck) { 
        const d = normalizeThemeString(r.myDeck);
        if (!d) return; 
        if (!s[d]) s[d] = { w: 0, t: 0 }; 
        s[d].t++; 
        if (r._isWin) s[d].w++; 
      } 
    });
    return Object.entries(s).map(([n, v]) => ({ 
      name: n, 
      winRate: parseFloat(((v.w / v.t) * 100).toFixed(1)), 
      wins: v.w, 
      total: v.t 
    })).sort((a,b) => b.total - a.total).slice(0, 6);
  }, [filteredRecords]);

  // 6. カード別統計 (Card Insights)
  const cardInsights = useMemo(() => {
    const pDict = {}; // Partners (自)
    const nDict = {}; // Nemeses (敵)

    filteredRecords.forEach(r => {
      const cardsStr = r.detectedCards || r['Detected Cards'] || "";
      if (!cardsStr) return;

      const isWin = r._isWin;
      const seenCards = new Set(); // 1試合内で同じカードは複数回カウントしない

      String(cardsStr).split(/[,、，]+/).forEach(raw => {
        const tag = raw.trim();
        if (!tag) return;
        
        const side = tag.startsWith('自') ? 'self' : (tag.startsWith('敵') ? 'opp' : null);
        const name = tag.split(/[：:]/)[1]?.trim();
        if (!side || !name) return;

        const key = `${side}-${name}`;
        if (seenCards.has(key)) return;
        seenCards.add(key);

        const dict = side === 'self' ? pDict : nDict;
        if (!dict[name]) dict[name] = { t: 0, w: 0 };
        dict[name].t++;
        if (isWin) dict[name].w++;
      });
    });

    const minAppearances = 3; // 統計のしきい値

    const partners = Object.entries(pDict)
      .map(([name, data]) => ({ name, total: data.t, winRate: parseFloat(((data.w / data.t) * 100).toFixed(1)) }))
      .filter(x => x.total >= minAppearances)
      .sort((a, b) => b.winRate - a.winRate || b.total - a.total);

    const nemeses = Object.entries(nDict)
      .map(([name, data]) => ({ name, total: data.t, winRate: parseFloat(((data.w / data.t) * 100).toFixed(1)) }))
      .filter(x => x.total >= minAppearances)
      .sort((a, b) => a.winRate - b.winRate || b.total - a.total);

    return { partners, nemeses };
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
    rankings,
    cardInsights
  };
}
