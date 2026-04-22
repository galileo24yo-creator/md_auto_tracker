import { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { 
  ROIS, getROIData, STATES, detectCardColor, getGameAreaBox, 
  toGrayscale, calculateSSD, normalizeContent, extractSequenceFeatures, matchSequence, multiThresholdDetectRating,
  detectTurnOwner, calculateWordProfile, compareProfiles, calculateProfileFromBin,
  drawBinarizedToCanvas, detectResultColor, drawComponentsToCanvas, extractComponentFeatures
} from '../lib/visionEngine';
import { fuzzyIncludes } from '../lib/utils';
import { normalizeCardName } from '../lib/recorderUtils';

/**
 * useOcrEngine hook
 * Handles the heavy lifting of OCR and vision detection.
 */
export function useOcrEngine({
  recordingRef,
  stateRef,
  slotsRef,
  statusTemplatesRef,
  addLog,
  playNotificationSound,
  setTurn,
  setResult,
  setDiff,
  setRatingChange,
  setIsTurnLocked,
  setIsResultLocked,
  setIsDiffLocked,
  setTurnScore,
  setResultScore,
  setDetectedCards,
  setCurrentCard,
  resetSlots,
  gotoState,
  onRecorded,
  postData,
  isProcessing,
  setIsProcessing,
  lastSaveTimeRef,
  matchStartTimeRef,
  lastRating,
  setLastRating,
  setShowCelebration,
  selectedTags,
  onRecordedCallback // Original onRecorded prop
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('NORMAL');
  const [isFrozen, setIsFrozen] = useState(false);
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);

  const isBusyRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());
  const isFrozenRef = useRef(false);
  const warningCooldownRef = useRef(0);
  const lastAnalyzeTimeRef = useRef(0);
  const rvfcIdRef = useRef(null);
  const workersRef = useRef({ jpn: null, eng: null });
  const ocrWorkerRef = useRef(null);
  const ocrCanvasRef = useRef(null);
  const isCardOcrBusyRef = useRef(false);
  const fuseRef = useRef(null);
  
  // Detection stability refs
  const cardVotesRef = useRef({});
  const detectionAttemptsRef = useRef(0);
  const prevGrayRef = useRef(null);
  const lastDetectedSideRef = useRef('NONE');
  const sessionHitsRef = useRef(0);
  const lastSessionCardRef = useRef('');
  const stablePointsBufferRef = useRef([]);

  // Initialize Card DB and Fuse
  useEffect(() => {
    import('fuse.js').then(({ default: Fuse }) => {
      fetch('/card_db.json')
        .then(res => res.json())
        .then(data => {
          fuseRef.current = new Fuse(data, {
            keys: ['normalizedName'],
            includeScore: true,
            threshold: 0.25,
            distance: 100,
            ignoreLocation: true
          });
        });
    });
  }, []);

  const initTesseract = async () => {
    if (workersRef.current.jpn) return;
    try {
      addLog('OCRワーカー起動中...', 'info');
      const jpnWorker = await createWorker('jpn');
      const engWorker = await createWorker('eng');
      await jpnWorker.setParameters({ tessedit_pageseg_mode: '7' });
      await engWorker.setParameters({ tessedit_pageseg_mode: '7' });
      workersRef.current = { jpn: jpnWorker, eng: engWorker };
      addLog('Vision Engine (OCR) 準備完了', 'success');
    } catch (e) {
      console.error(e);
      addLog('OCRエラー', 'error');
    }
  };

  const triggerAutoSaveForNextMatch = async (curSlots) => {
    if (isProcessing || (!curSlots.turn && !curSlots.result)) return;
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) return;
    setIsProcessing(true);
    lastSaveTimeRef.current = now;
    try {
      const res = await postData({
        mode: curSlots.mode,
        turn: curSlots.turn,
        result: curSlots.result,
        diff: curSlots.diff,
        myDeck: curSlots.myDecks.join(', '),
        opponentDeck: curSlots.oppDecks.join(', '),
        memo: selectedTags.join(', ')
      });
      if (res?.success) {
        if (curSlots.result === 'VICTORY') {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
        }
        playNotificationSound('double');
        addLog(`Auto-Saved! [${curSlots.result}]`, 'success');
        setLastRating(parseFloat(curSlots.diff) || lastRating);
        onRecordedCallback();
      }
    } catch (e) {
      console.error("Auto-save failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const captureAndAnalyze = useCallback(async (videoRef, canvasRef) => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    setIsScanning(true);
    try {
      const v = videoRef.current, c = canvasRef.current;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const rawVw = v.videoWidth, rawVh = v.videoHeight;
      const { bx, by, bw, bh } = getGameAreaBox(rawVw, rawVh);
      const { isTurnLocked: tLock, isResultLocked: rLock, mode: curMode } = slotsRef.current;

      const PREV_W = 320, PREV_H = 180;
      c.width = PREV_W; c.height = PREV_H;
      ctx.drawImage(v, 0, 0, rawVw, rawVh, 0, 0, PREV_W, PREV_H);
      const { jpn, eng } = workersRef.current;

      const currentState = stateRef.current;

      // 自律的リセット: ターン検出（待機）または次試合待機に戻った際は内部バッファをクリア
      if ((currentState === STATES.DETECTING_TURN || currentState === STATES.NEXT_MATCH_STANDBY) && 
          (stablePointsBufferRef.current.length > 0 || detectionAttemptsRef.current > 0)) {
        stablePointsBufferRef.current = [];
        detectionAttemptsRef.current = 0;
        cardVotesRef.current = {};
        sessionHitsRef.current = 0;
        lastDetectedSideRef.current = 'NONE';
        lastSessionCardRef.current = '';
        isCardOcrBusyRef.current = false;
      }

      // --- 1. Turn Detection ---
      if ((currentState === STATES.DETECTING_TURN && !tLock) || currentState === STATES.NEXT_MATCH_STANDBY) {
        const roi = ROIS.TURN;
        const { bin, width, height } = normalizeContent(v, bx + bw * roi.x, by + bh * roi.y, bw * roi.w, bh * roi.h, 200, 60, 160);
        if (width > 1 && height > 1) {
          if (!ocrCanvasRef.current) ocrCanvasRef.current = document.createElement('canvas');
          const ocrCanvas = ocrCanvasRef.current;
          ocrCanvas.width = width; ocrCanvas.height = height;
          const ocrCtx = ocrCanvas.getContext('2d', { willReadFrequently: true });
          const ocrImgData = ocrCtx.createImageData(width, height);
          for (let i = 0; i < bin.length; i++) {
            const val = bin[i] === 1 ? 0 : 255;
            const idx = i * 4;
            ocrImgData.data[idx] = val; ocrImgData.data[idx + 1] = val; ocrImgData.data[idx + 2] = val; ocrImgData.data[idx + 3] = 255;
          }
          ocrCtx.putImageData(ocrImgData, 0, 0);
          if (jpn) {
            const { data: { text, confidence } } = await jpn.recognize(ocrCanvas);
            const cleanText = text.replace(/\s+/g, '').slice(0, 15);
            setTurnScore(confidence / 100);
            const res_f = { match: fuzzyIncludes(cleanText, 'あなたが先攻です', 2), confidence };
            const res_s = { match: fuzzyIncludes(cleanText, 'あなたが後攻です', 2), confidence };
            if (res_f.match || res_s.match) {
              const hasFirstChar = cleanText.includes('先');
              const hasSecondChar = cleanText.includes('後');
              let foundTurnValue = null;
              if (hasFirstChar && !hasSecondChar) foundTurnValue = '先';
              else if (hasSecondChar && !hasFirstChar) foundTurnValue = '後';
              else foundTurnValue = res_f.match ? '先' : '後';

              if (currentState === STATES.NEXT_MATCH_STANDBY) {
                const cur = slotsRef.current;
                if (cur.turn || cur.result) {
                  triggerAutoSaveForNextMatch(cur).catch(err => console.error("Auto-save error:", err));
                }
                resetSlots();
              }
              setTurn(foundTurnValue); setIsTurnLocked(true); setTurnScore((res_f.match ? res_f.confidence : res_s.confidence) / 100);
              gotoState(STATES.IN_MATCH); // Use gotoState, not direct ref assign
              // Note: currentState in parent will be updated via state update if we expose it
              matchStartTimeRef.current = Date.now();
              addLog(`対戦中... [${foundTurnValue === '先' ? '先攻' : '後攻'}] を検知しました`, 'success');
              playNotificationSound('single');
            }
          }
        }
      }
      // --- 2. In Match: Card Detection ---
      else if (currentState === STATES.IN_MATCH || (currentState === STATES.DETECTING_RESULT && !rLock)) {
        if (currentState === STATES.IN_MATCH) {
          const colorRoi = ROIS.CARD_COLOR_INDICATOR;
          const cw = Math.max(1, Math.floor(bw * colorRoi.w));
          const ch = Math.max(1, Math.floor(bh * colorRoi.h));
          const colorData = getROIData(ctx, v, colorRoi, cw, ch);
          const colorRes = detectCardColor(colorData);

          if (colorRes.side !== lastDetectedSideRef.current) {
            cardVotesRef.current = {}; detectionAttemptsRef.current = 0; lastDetectedSideRef.current = colorRes.side;
          }
          if (colorRes.side !== 'NONE') {
            const nameRoi = ROIS.CARD_NAME;
            const { bin: nBin, width: nw, height: nh } = normalizeContent(v, bx + bw * nameRoi.x, by + bh * nameRoi.y, bw * nameRoi.w, bh * nameRoi.h, 200, 100, 0);
            let whitePixels = 0; for (let i = 0; i < nBin.length; i++) { if (nBin[i] === 1) whitePixels++; }
            const whiteRatio = whitePixels / nBin.length;
            if (whiteRatio < 0.01 || whiteRatio > 0.40) {
              // Skip
            } else {
              const curGray = toGrayscale(getROIData(ctx, v, ROIS.CARD_VISUAL, 100, 100));
              if (prevGrayRef.current && prevGrayRef.current.length === curGray.length) {
                const ssd = calculateSSD(curGray, prevGrayRef.current);
                if (ssd > 600) {
                  cardVotesRef.current = {}; detectionAttemptsRef.current = 0; lastSessionCardRef.current = ''; sessionHitsRef.current = 0;
                  addLog('🔄 カードの切り替わりを検知 (SSD)', 'info');
                }
              }
              prevGrayRef.current = curGray;
              if (nw > 1 && nh > 1 && jpn && !isCardOcrBusyRef.current) {
                isCardOcrBusyRef.current = true;
                if (!ocrCanvasRef.current) ocrCanvasRef.current = document.createElement('canvas');
                const nc = ocrCanvasRef.current;
                nc.width = nw; nc.height = nh;
                const nctx = nc.getContext('2d', { willReadFrequently: true });
                nctx.fillStyle = 'white'; nctx.fillRect(0, 0, nc.width, nc.height);
                const nImg = nctx.createImageData(nw, nh);
                for (let i = 0; i < nBin.length; i++) {
                  const v2 = nBin[i] === 1 ? 0 : 255;
                  const idx = i * 4; nImg.data[idx] = v2; nImg.data[idx + 1] = v2; nImg.data[idx + 2] = v2; nImg.data[idx + 3] = 255;
                }
                nctx.putImageData(nImg, 0, 0);

                jpn.recognize(nc).then(({ data: { text, confidence } }) => {
                  const rawText = text.trim().replace(/\n+/g, '').replace(/\s+/g, '');
                  const cleanText = normalizeCardName(rawText);
                  if (cleanText.length >= 3) {
                    detectionAttemptsRef.current++;
                    if (fuseRef.current) {
                      const results = fuseRef.current.search(cleanText);
                      if (results && results.length > 0) {
                        const bestMatch = results[0].item;
                        const matchScore = results[0].score || 0;
                        if (matchScore < 0.45) {
                          const name = bestMatch.name;
                          const side = colorRes.side;
                          if (lastSessionCardRef.current === name) sessionHitsRef.current++;
                          else { sessionHitsRef.current = 1; lastSessionCardRef.current = name; }
                          
                          let scoreMultiplier = 1.0;
                          if (matchScore >= 0.25) {
                            const normalizedExcess = (matchScore - 0.25) / (0.45 - 0.25);
                            scoreMultiplier = Math.pow(1 - normalizedExcess, 2) * 0.1;
                          }
                          const baseWeight = (1.0 - matchScore) * (confidence / 100);
                          const decayMultiplier = Math.pow(0.5, sessionHitsRef.current - 1);
                          const effectiveWeight = baseWeight * scoreMultiplier * decayMultiplier;

                          setDetectedCards(prev => {
                            const lastCard = prev.length > 0 ? prev[prev.length - 1] : null;
                            const isSameAsLast = lastCard && lastCard.name === name && lastCard.side === side;

                            if (isSameAsLast) {
                              const updated = [...prev];
                              const c = updated[updated.length - 1];
                              updated[updated.length - 1] = { 
                                ...c, 
                                hits: (c.hits || 1) + 1, 
                                totalWeight: (c.totalWeight || 0.5) + effectiveWeight 
                              };
                              return updated;
                            } else {
                              // 手番情報の取得 (石の色判定)
                              const turnRoi = ROIS.TURN_INDICATOR;
                              const turnData = getROIData(ctx, v, turnRoi, 100, 100);
                              const turnOwner = detectTurnOwner(turnData);

                              const isSoftCut = matchScore >= 0.25;
                              addLog(`${isSoftCut ? '[減衰加算]' : 'カード検知'}: ${name} (${side === 'BLUE' ? '味方' : '相手'}) [${turnOwner === 'MY_TURN' ? '自T' : turnOwner === 'OPP_TURN' ? '敵T' : '?'}]`, side === 'BLUE' ? 'info' : 'warning');
                              return [...prev, { 
                                name, 
                                side, 
                                archetype: bestMatch.archetype, 
                                hits: 1, 
                                totalWeight: effectiveWeight, 
                                timestamp: Date.now(),
                                playedOn: turnOwner
                              }];
                            }
                          });
                          setCurrentCard({ name, archetype: bestMatch.archetype, side, confidence, votes: sessionHitsRef.current });
                        }
                      }
                    }
                  }
                }).finally(() => { isCardOcrBusyRef.current = false; });
              }
            }
          }
        }
        // Result Detection
        const roi = ROIS.RESULT;
        const { bin: roiBin, width, height } = normalizeContent(v, bx + bw * roi.x, by + bh * roi.y, bw * roi.w, bh * roi.h, 300, 120, 0, -9.0);
        if (width > 1 && height > 1) {
          if (!ocrCanvasRef.current) ocrCanvasRef.current = document.createElement('canvas');
          const ocrCanvas = ocrCanvasRef.current;
          ocrCanvas.width = width; ocrCanvas.height = height;
          const ocrCtx = ocrCanvas.getContext('2d', { willReadFrequently: true });
          const ocrImgData = ocrCtx.createImageData(width, height);
          for (let i = 0; i < roiBin.length; i++) {
            const val = roiBin[i] === 1 ? 0 : 255;
            const idx = i * 4; ocrImgData.data[idx] = val; ocrImgData.data[idx + 1] = val; ocrImgData.data[idx + 2] = val; ocrImgData.data[idx + 3] = 255;
          }
          ocrCtx.putImageData(ocrImgData, 0, 0); // 復元
          const rawData = ocrCtx.getImageData(0, 0, width, height);
          
          // 色判定用に、二値化前のカラーデータを保持しておく (引数を修正)
          const colorData = getROIData(ctx, v, roi, width, height);

          // 従来のコンポーネント抽出を実行して分離状態を確認
          const { comps, bin: featBin } = extractSequenceFeatures(rawData, 0, 0);

          // 1. Waveform Profile Matching (Fast)
          // 7文字分離に成功した featBin を判定に使用する
          const { profile: liveProfile, count: whitePixels } = calculateProfileFromBin(featBin, width, height, 64);
          const vRes = compareProfiles(liveProfile, statusTemplatesRef.current.victory?.profile);
          const lRes = compareProfiles(liveProfile, statusTemplatesRef.current.lose?.profile);
          const resColor = detectResultColor(colorData); 

          // 1文字ずつの精密マッチング (Template Matching)
          const seqMatchV = matchSequence(comps.map((c, i) => extractComponentFeatures(featBin, width, height, c)), statusTemplatesRef.current.victory?.features || []);
          const seqMatchL = matchSequence(comps.map((c, i) => extractComponentFeatures(featBin, width, height, c)), statusTemplatesRef.current.lose?.features || []);
          
          let detectedResult = null;
          let method = '';

          // 判定A: 1文字ずつの精密マッチングが成功
          if (seqMatchV.match) {
            detectedResult = 'VICTORY';
            method = 'TemplateMatch';
          } else if (seqMatchL.match) {
            detectedResult = 'LOSE';
            method = 'TemplateMatch';
          }
          // 判定B: 波形が55%以上、かつ色が一致 or 圧倒的な確信度差があれば確定
          else {
            const vGap = vRes.confidence - lRes.confidence;
            const lGap = lRes.confidence - vRes.confidence;

            if (vRes.confidence > 55 && (resColor === 'GOLD' || vGap > 25)) {
              detectedResult = 'VICTORY';
              method = 'Waveform+Color';
            } else if (lRes.confidence > 55 && (resColor === 'BLUE' || lGap > 25)) {
              detectedResult = 'LOSE';
              method = 'Waveform+Color';
            }
          }

          // 2. Sequence/OCR Backup (Slow) - If waveform+color failed but looks like a result
          const potentialMatch = vRes.confidence > 40 || lRes.confidence > 40 || resColor !== 'NEUTRAL';
          if (!detectedResult && potentialMatch && eng) {
            console.log("-> Waveform uncertain. Attempting OCR backup...");
            const { data: { text, confidence } } = await eng.recognize(ocrCanvas);
            const cleanText = text.toUpperCase().replace(/\s+/g, '').slice(0, 15);
            setResultScore(confidence / 100);
            
            const { features } = extractSequenceFeatures(rawData, 0, 0);
            const tVictory = matchSequence(features, statusTemplatesRef.current.victory?.features || []);
            const tLose = matchSequence(features, statusTemplatesRef.current.lose?.features || []);
            
            if (tVictory.match || fuzzyIncludes(cleanText, 'VICTORY', 1)) {
              detectedResult = 'VICTORY';
              method = 'OCR';
            } else if (tLose.match || (confidence > 35 && fuzzyIncludes(cleanText, 'LOSE', 1))) {
              detectedResult = 'LOSE';
              method = 'OCR';
            }
          }

          if (detectedResult) {
            addLog(`[${method}判定] 勝敗を検知: ${detectedResult}`, 'success');
            console.log(`[Result Found] ${detectedResult} via ${method}`);
            setResult(detectedResult); setIsResultLocked(true);
            const nextState = (curMode === 'ランク' || slotsRef.current.isDiffLocked) ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING;
            gotoState(nextState);
            playNotificationSound('single');
          }
        }
      }
      else if (currentState === STATES.DETECTING_RATING && !slotsRef.current.isDiffLocked) {
        const ratingRoi = curMode === 'DC' ? ROIS.DC_POINTS : ROIS.RATING;
        const id = getROIData(ctx, v, ratingRoi, 300, 120);
        const multiRes = multiThresholdDetectRating(id);
        const d = multiRes.result;
        if (d && d.length >= 4) {
          const buffer = stablePointsBufferRef.current; buffer.push(d); if (buffer.length > 3) buffer.shift();
          if (buffer.length === 3 && buffer.every(v => v === d)) {
            const f = curMode === 'DC' ? d.replace(/\./g, '') : (parseFloat(d) / 100).toFixed(2);
            setDiff(f); setRatingChange(f); setIsDiffLocked(true);
            gotoState(STATES.NEXT_MATCH_STANDBY); // Use gotoState
            playNotificationSound('single');
          }
        }
      }

      if (showRoiOverlay) {
        ctx.lineWidth = 1; const scaleX = PREV_W / rawVw, scaleY = PREV_H / rawVh;
        Object.entries(ROIS).forEach(([name, roi]) => {
          ctx.strokeStyle = name === 'TURN' ? '#fbbf24' : name === 'RESULT' ? '#a78bfa' : '#3b82f6';
          ctx.strokeRect((bx + bw * roi.x) * scaleX, (by + bh * roi.y) * scaleY, (bw * roi.w) * scaleX, (bh * roi.h) * scaleY);
        });
      }
    } catch (err) { console.error(err); }
    finally { setIsScanning(false); }
  }, [slotsRef, stateRef, addLog, playNotificationSound, setTurn, setResult, setIsTurnLocked, setIsResultLocked, setTurnScore, setResultScore, setDetectedCards, setCurrentCard, setDiff, setRatingChange, setIsDiffLocked, resetSlots, onRecordedCallback, postData, setIsProcessing, isProcessing, matchStartTimeRef, lastSaveTimeRef, lastRating, setLastRating, setShowCelebration, selectedTags, showRoiOverlay]);

  return {
    isBusy,
    isScanning,
    captureStatus,
    isFrozen,
    showRoiOverlay,
    setShowRoiOverlay,
    initTesseract,
    captureAndAnalyze,
    lastUpdateRef,
    isFrozenRef,
    warningCooldownRef,
    lastAnalyzeTimeRef,
    isBusyRef,
    rvfcIdRef,
    ocrWorkerRef,
    ocrCanvasRef
  };
}
