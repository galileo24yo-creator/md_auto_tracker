import { useEffect, useRef, useMemo } from 'react';
import { normalizeTheme } from '../lib/themeUtils';
import { CARD_TO_TAG_BASE, normalizeCardName } from '../lib/recorderUtils';

export function useMatchAutofill({
  detectedCards,
  isMyDeckLocked,
  isOpponentDeckLocked,
  isTagsLocked,
  availableTags,
  availableDecks,
  themePairings,
  myDecks,
  oppDecks,
  setMyDecks,
  setOppDecks,
  setSelectedTags,
  result,
  addLog,
  playNotificationSound,
  matchStartTimeRef,
  detectedCardsRef // Ref for result-time analysis
}) {
  const autoFillRunRef = useRef(false);
  const blacklistedMyThemesRef = useRef(new Set());
  const blacklistedOppThemesRef = useRef(new Set());
  const lastMyDecksRef = useRef([]);
  const lastOppDecksRef = useRef([]);
  const lastStartTimeRef = useRef(null);

  const hasHistory = (targetTheme, activeThemes) => {
    if (!targetTheme || activeThemes.length === 0) return false;
    const pairings = themePairings.get(normalizeTheme(targetTheme));
    if (!pairings) return false;
    return activeThemes.some(at => pairings.has(normalizeTheme(at)));
  };

  const allowedThemesSet = useMemo(() => {
    if (!availableDecks || availableDecks.length === 0) return null;
    return new Set(availableDecks.filter(Boolean).map(t => normalizeTheme(t)));
  }, [availableDecks]);

  const isAllowed = (theme) => {
    if (!allowedThemesSet) return true; // リストが空（または未ロード）の場合は制限しない
    return allowedThemesSet.has(normalizeTheme(theme));
  };

  // --- Real-time continuous autofill ---
  useEffect(() => {
    // 試合が変わったか判定してブラックリストをリセット
    const currentStartTime = matchStartTimeRef.current;
    if (currentStartTime !== lastStartTimeRef.current) {
      blacklistedMyThemesRef.current.clear();
      blacklistedOppThemesRef.current.clear();
      lastMyDecksRef.current = [];
      lastOppDecksRef.current = [];
      lastStartTimeRef.current = currentStartTime;
    }

    // ユーザーによる「手動削除」を検知してブラックリストに追加
    lastMyDecksRef.current.forEach(t => {
      if (myDecks && !myDecks.includes(t)) {
        blacklistedMyThemesRef.current.add(t);
      }
    });
    lastOppDecksRef.current.forEach(t => {
      if (oppDecks && !oppDecks.includes(t)) {
        blacklistedOppThemesRef.current.add(t);
      }
    });

    // 最新の状態を保存
    lastMyDecksRef.current = myDecks || [];
    lastOppDecksRef.current = oppDecks || [];

    if (detectedCards.length === 0) return;

    const elapsedSeconds = matchStartTimeRef.current ? (Date.now() - matchStartTimeRef.current) / 1000 : 0;
    const THRESHOLD_THEME = Math.min(3.0, 2.5 + (elapsedSeconds / 120) * 0.5);
    const THRESHOLD_TAG = 0.8;

    const themeScores = { BLUE: {}, RED: {} };
    const themeUniqueCards = { BLUE: {}, RED: {} };
    const highConfidenceCards = [];

    detectedCards.forEach(card => {
      if (card.archetype) {
        const side = card.side;
        themeScores[side][card.archetype] = (themeScores[side][card.archetype] || 0) + (card.totalWeight || 0);
        if (!themeUniqueCards[side][card.archetype]) themeUniqueCards[side][card.archetype] = new Set();
        themeUniqueCards[side][card.archetype].add(card.name);
      }
      if (card.totalWeight >= THRESHOLD_TAG) {
        highConfidenceCards.push(card);
      }
    });

    if (!isMyDeckLocked) {
      Object.entries(themeScores.BLUE).forEach(([theme, score]) => {
        const isHistoried = hasHistory(theme, myDecks);
        const threshold = isHistoried ? 1.5 : THRESHOLD_THEME;
        const requiredSize = isHistoried ? 1 : 2; // 実績があれば1種類でOK

        if (score >= threshold && themeUniqueCards.BLUE[theme].size >= requiredSize) {
          const normTheme = normalizeTheme(theme);

          // ホワイトリストチェック・ブラックリストチェック
          if (isAllowed(theme) && !blacklistedMyThemesRef.current.has(normTheme)) {
            setMyDecks(prev => prev.includes(normTheme) ? prev : [...prev, normTheme]);
          }
        }
      });
    }

    if (!isOpponentDeckLocked) {
      Object.entries(themeScores.RED).forEach(([theme, score]) => {
        const isHistoried = hasHistory(theme, oppDecks);
        const threshold = isHistoried ? 1.5 : THRESHOLD_THEME;
        const requiredSize = isHistoried ? 1 : 2; // 実績があれば1種類でOK

        if (score >= threshold && themeUniqueCards.RED[theme].size >= requiredSize) {
          const normTheme = normalizeTheme(theme);

          // ホワイトリストチェック・ブラックリストチェック
          if (isAllowed(theme) && !blacklistedOppThemesRef.current.has(normTheme)) {
            setOppDecks(prev => prev.includes(normTheme) ? prev : [...prev, normTheme]);
          }
        }
      });
    }

    // NOTE: Automated high-confidence card tags are now handled manually via the click menu 
    // and automatically logged into the separate "Detected Cards" column during save.
  }, [detectedCards, isMyDeckLocked, isOpponentDeckLocked, isTagsLocked, availableTags, setMyDecks, setOppDecks, setSelectedTags, matchStartTimeRef, myDecks, oppDecks, themePairings]);

  // --- Match-End Detail Autofill ---
  useEffect(() => {
    if (result === 'VICTORY' || result === 'LOSE') {
      if (!autoFillRunRef.current) {
        autoFillRunRef.current = true;
        
        const getValidThemes = (cards) => {
          if (cards.length === 0) return [];
          const themeWeights = {};
          const themeUniqueNames = {};
          let totalSideWeight = 0;

          cards.forEach(c => {
            const theme = normalizeTheme(c.archetype);
            const weight = c.totalWeight || 0;
            themeWeights[theme] = (themeWeights[theme] || 0) + weight;
            if (!themeUniqueNames[theme]) themeUniqueNames[theme] = new Set();
            themeUniqueNames[theme].add(c.name);
            totalSideWeight += weight;
          });

          if (totalSideWeight === 0) return [];
          const sortedThemes = Object.entries(themeWeights).sort((a, b) => b[1] - a[1]);
          const results = [];
          if (sortedThemes.length > 0) {
            const [topTheme, topWeight] = sortedThemes[0];
            const isMainValid = topWeight >= 0.5 && themeUniqueNames[topTheme].size >= 2;
            
            // ホワイトリスト・ブラックリストを考慮してフィルタリング
            const isMySide = cards.some(c => c.side === 'BLUE');
            const blacklist = isMySide ? blacklistedMyThemesRef.current : blacklistedOppThemesRef.current;

            if (isMainValid && isAllowed(topTheme) && !blacklist.has(topTheme)) {
              results.push(topTheme);
              for (let i = 1; i < sortedThemes.length; i++) {
                const [theme, weight] = sortedThemes[i];
                if (blacklist.has(theme)) continue; // ブラックリスト除外
                if (!isAllowed(theme)) continue;    // ホワイトリスト除外

                // 実績のあるサブテーマなら条件を 20% -> 5% に大幅緩和 & 1枚でOK
                const isHistoried = hasHistory(theme, [topTheme]);
                const shareThreshold = isHistoried ? 0.05 : 0.20;
                const requiredSize = isHistoried ? 1 : 2;

                if (weight / totalSideWeight >= shareThreshold && themeUniqueNames[theme].size >= requiredSize) {
                  results.push(theme);
                }
              }
            }
          }
          return results;
        };

        const currentDetected = detectedCardsRef.current || [];
        const myThemes = getValidThemes(currentDetected.filter(c => c.side === 'BLUE' && c.archetype));
        const oppThemes = getValidThemes(currentDetected.filter(c => c.side === 'RED' && c.archetype));

        let msgParts = [];
        if (!isMyDeckLocked && myThemes.length > 0) {
          setMyDecks(prev => [...new Set([...prev, ...myThemes])]);
          msgParts.push(`味方テーマ: ${myThemes.join(', ')}`);
        }
        if (!isOpponentDeckLocked && oppThemes.length > 0) {
          setOppDecks(prev => [...new Set([...prev, ...oppThemes])]);
          msgParts.push(`相手テーマ: ${oppThemes.join(', ')}`);
        }

        // NOTE: Automated match-end card tags are now handled manually 
        // to keep the Factor list clean.

        if (msgParts.length > 0) {
          addLog(`自動入力完了: ${msgParts.join(' / ')}`, 'success');
        }
      }
    } else {
      autoFillRunRef.current = false;
    }
  }, [result, isMyDeckLocked, isOpponentDeckLocked, isTagsLocked, availableTags, setMyDecks, setOppDecks, setSelectedTags, addLog, detectedCardsRef, themePairings, allowedThemesSet]);
}
