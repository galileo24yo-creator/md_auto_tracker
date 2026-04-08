import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MonitorUp, Square, Save, Loader2, Trophy, Activity, Lock, LockOpen, Eye, EyeOff, Monitor, RotateCcw, PlayCircle } from 'lucide-react';
import DeckSelect from './DeckSelect';
import { postData } from '../lib/api';
import { fuzzyIncludes } from '../lib/utils';
import { createWorker } from 'tesseract.js';
import { ROIS, getROIData, STATES, detectRating, normalizeContent, drawBinarizedToCanvas, createBinarizedCanvas } from '../lib/visionEngine';

// ==========================================
// Sound Effects (Web Audio API)
// ==========================================
let audioCtx = null;
const playNotificationSound = (type = 'single') => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'double') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(1200, now + 0.12);
      gain.gain.setValueAtTime(0.1, now + 0.12); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'warning') {
      osc.type = 'square'; osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(330, now + 0.12);
      gain.gain.setValueAtTime(0.05, now + 0.12); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'restore') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.frequency.setValueAtTime(1100, now + 0.05);
      osc.start(now); osc.stop(now + 0.15);
    } else {
      osc.type = 'sine'; osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.2);
    }
  } catch (e) { console.warn("Sound play failed:", e); }
};

const OcrStatus = React.memo(({ log }) => (
  <span className="text-xs px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full text-emerald-400 font-mono font-bold">
    {log}
  </span>
));

export default function Recorder({ availableDecks, availableTags, onRecorded }) {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('ランク');
  const [myDecks, setMyDecks] = useState([]);
  const [oppDecks, setOppDecks] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Slot Persistence (Lock)
  const [isMyDeckLocked, setIsMyDeckLocked] = useState(true);
  const [isOpponentDeckLocked, setIsOpponentDeckLocked] = useState(false);
  const [isTagsLocked, setIsTagsLocked] = useState(false);

  // Data Slots
  const [turn, setTurn] = useState('');
  const [result, setResult] = useState('');
  const [diff, setDiff] = useState('');
  const [ratingChange, setRatingChange] = useState('');
  const [turnScore, setTurnScore] = useState(null);
  const [resultScore, setResultScore] = useState(null);

  // Manual Locks (User Input Priority)
  const [isTurnLocked, setIsTurnLocked] = useState(false);
  const [isResultLocked, setIsResultLocked] = useState(false);
  const [isDiffLocked, setIsDiffLocked] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const binCanvasRef = useRef(null); // Full ROI Binarized Preview
  const lastAnalyzeTimeRef = useRef(0);
  const rvfcIdRef = useRef(null);
  const silentOscRef = useRef(null);
  const rawRoiCanvasRef = useRef(null); // Raw Source ROI
  const debugTemplateCanvasRef = useRef(null);
  const debugRoiCanvasRef = useRef(null);
  const detectedBboxRef = useRef(null);
  const intervalRef = useRef(null);
  const isBusyRef = useRef(false);
  const stablePointsBufferRef = useRef([]); 
  const ocrWorkerRef = useRef(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const statusTemplatesRef = useRef({}); 
  const [debugGallery, setDebugGallery] = useState([]); // Visual debugging
  const ocrCanvasRef = useRef(null); // Reusable OCR canvas

  // Focus tracking for performance
  const [isInputActive, setIsInputActive] = useState(false);
  const inputActiveRef = useRef(false);
  useEffect(() => { inputActiveRef.current = isInputActive; }, [isInputActive]);

  // Helper: Extract a component as a DataURL for debugging
  const getCompDataURL = (bin, w, h, comp) => {
    const c = document.createElement('canvas');
    c.width = comp.w; c.height = comp.h;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(comp.w, comp.h);
    for (let y = 0; y < comp.h; y++) {
      for (let x = 0; x < comp.w; x++) {
        const i = (y * comp.w + x) * 4;
        const bi = (comp.y + y) * w + (comp.x + x);
        const val = bin[bi] === 1 ? 0 : 255;
        id.data[i] = val; id.data[i+1] = val; id.data[i+2] = val; id.data[i+3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c.toDataURL();
  };

  const [lastRating, setLastRating] = useState(null);
  const lastSaveTimeRef = useRef(0);
  const [ocrLog, setOcrLog] = useState('待機中');
  const [showCelebration, setShowCelebration] = useState(false);
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);
  const [currentState, setCurrentState] = useState(STATES.IDLE);
  
  // Visibility and Throttling States
  const [isElementVisible, setIsElementVisible] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const isFrozenRef = useRef(false);
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef(null);
  const [captureStatus, setCaptureStatus] = useState('NORMAL'); // NORMAL, HIDDEN, BACKGROUND, FROZEN
  const lastUpdateRef = useRef(Date.now());
  const warningCooldownRef = useRef(0);
  
  const stateRef = useRef(currentState);
  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  const currentAnalyzeRef = useRef(null);
  
  const recordingRef = useRef(isRecording);
  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);

  const slotsRef = useRef({ turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks });
  useEffect(() => { slotsRef.current = { turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks }; }, [turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks]);

  const workersRef = useRef({ jpn: null, eng: null });

  const initTesseract = async () => {
    if (workersRef.current.jpn) return;
    try {
      setOcrLog('OCRワーカー起動中...');
      const jpnWorker = await createWorker('jpn');
      const engWorker = await createWorker('eng');
      await jpnWorker.setParameters({ tessedit_pageseg_mode: '7' });
      await engWorker.setParameters({ tessedit_pageseg_mode: '7' });
      workersRef.current = { jpn: jpnWorker, eng: engWorker };
      setOcrLog('Vision Engine (OCR) 準備完了');
    } catch (e) {
      console.error(e);
      setOcrLog('OCRエラー');
    }
  };

  const loadStatusTemplates = useCallback(async () => {
    const urls = {
      victory: '/templates/victory.png',
      lose: '/templates/lose.png'
    };
    
    const { extractSequenceFeatures } = await import('../lib/visionEngine');
    const templates = {};

    for (const [key, url] of Object.entries(urls)) {
      try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Extract features and components (both Victory/Lose use -9.0 angle)
        const { features, comps, bin, width, height } = extractSequenceFeatures(imageData, 0, -9.0);
        templates[key] = features;
        
        if (key === 'victory') {
          const gallery = comps.map(c => getCompDataURL(bin, width, height, c));
          setDebugGallery(gallery);
          // console.log(`Template loaded: ${key} (${features.length} components) [Padded Width: ${width}]`);
        }
      } catch (err) { console.warn(`Failed to load template: ${key}`, err); }
    }
    statusTemplatesRef.current = templates;
  }, []);

  useEffect(() => {
    loadStatusTemplates();
    
    // Intersection Observer for Video Visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsElementVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    if (videoRef.current) observer.observe(videoRef.current);

    // Page Visibility API (Wait for freeze to trigger naturally)
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    try {
      ocrWorkerRef.current = new Worker(new URL('/ocrWorker.js', import.meta.url));
      ocrWorkerRef.current.onmessage = (e) => {
        if (e.data.type === 'tick' && isBusyRef.current === false && recordingRef.current) {
          // Worker tick helps detect freezes if rvfc stops
          const now = Date.now();
          if (now - lastUpdateRef.current > 6000 && !isFrozenRef.current) {
            setIsFrozen(true);
            isFrozenRef.current = true;
          }
          
          if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) return;
          isBusyRef.current = true;
          if (currentAnalyzeRef.current) {
            currentAnalyzeRef.current().finally(() => { isBusyRef.current = false; });
          }
        }
      };
    } catch (e) { console.error("Worker error:", e); }

    // Robust Scroll Event Listener for Ghost Mode Detection
    let isTicking = false;
    const handleScroll = () => {
      if (!isTicking) {
        window.requestAnimationFrame(() => {
          if (stickyRef.current) {
            const rect = stickyRef.current.getBoundingClientRect();
            // Enter Ghost Mode if sentinel is above top. Exit with 10px buffer.
            const isStuck = rect.top < 0;
            setIsSticky(prev => {
              if (isStuck && !prev) return true;
              if (!isStuck && rect.top > 10 && prev) return false;
              return prev;
            });
          }
          isTicking = false;
        });
        isTicking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (ocrWorkerRef.current) ocrWorkerRef.current.terminate();
      if (workersRef.current.jpn) workersRef.current.jpn.terminate();
      if (workersRef.current.eng) workersRef.current.eng.terminate();
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadStatusTemplates]);

  // Simplified Capture Status Logic: Trigger ONLY on actual freeze
  useEffect(() => {
    if (isFrozen && isRecording) {
      setCaptureStatus('FROZEN');
      const now = Date.now();
      // Use shorter cooldown for testing and responsiveness
      if (now - warningCooldownRef.current > 6000) {
        playNotificationSound('warning');
        warningCooldownRef.current = now;
      }
    } else {
      setCaptureStatus('NORMAL');
    }
  }, [isFrozen, isRecording]);

  useEffect(() => {
    if (isRecording && ocrWorkerRef.current) {
      const curState = stateRef.current;
      let interval = 500;
      if (curState === STATES.IN_MATCH) interval = 800;
      ocrWorkerRef.current.postMessage({ action: 'start', interval });

      // Start Silent Audio Heartbeat to prevent deep sleep
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        g.gain.value = 0.0001; // Near-silent
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start();
        silentOscRef.current = osc;
      } catch(e) {}

      // Start rvfc loop if supported
      if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
        const loop = (now, metadata) => {
          if (!recordingRef.current) return;
          const curTime = Date.now();
          // Jitter/Throttling: Use consistent intervals (OCR fallback logic handles UI lag)
          const targetInterval = stateRef.current === STATES.IN_MATCH ? 800 : 500;
          
          if (curTime - lastAnalyzeTimeRef.current >= targetInterval && isBusyRef.current === false) {
            isBusyRef.current = true;
            lastAnalyzeTimeRef.current = curTime;
            lastUpdateRef.current = curTime;
            if (isFrozenRef.current) {
              setIsFrozen(false);
              isFrozenRef.current = false;
              playNotificationSound('restore'); // Play restoration sound
            }
            if (currentAnalyzeRef.current) {
               currentAnalyzeRef.current().finally(() => { isBusyRef.current = false; });
            }
          }
          rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
        };
        rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
      }
    } else {
      if (ocrWorkerRef.current) ocrWorkerRef.current.postMessage({ action: 'stop' });
      if (silentOscRef.current) { try { silentOscRef.current.stop(); } catch(e){} silentOscRef.current = null; }
      if (videoRef.current && rvfcIdRef.current) {
        videoRef.current.cancelVideoFrameCallback(rvfcIdRef.current);
        rvfcIdRef.current = null;
      }
    }
  }, [isRecording, currentState]);

  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  const resetSlots = useCallback(() => {
    setTurn(''); setIsTurnLocked(false);
    setResult(''); setIsResultLocked(false);
    setDiff(''); setRatingChange(''); setIsDiffLocked(false);
    setTurnScore(null); setResultScore(null);
    if (!isMyDeckLocked) setMyDecks([]);
    if (!isOpponentDeckLocked) setOppDecks([]);
    if (!isTagsLocked) setSelectedTags([]);
    stablePointsBufferRef.current = [];
    setCurrentState(STATES.DETECTING_TURN);
    setOcrLog("スロットリセット → 次の試合待機中");
  }, [isMyDeckLocked, isOpponentDeckLocked, isTagsLocked]);

  const saveMatch = useCallback(async (dataOverride = null) => {
    if (isProcessing) return;
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) return;

    const finalData = dataOverride || {
      mode, turn, result,
      myDeck: myDecks.join(', '),
      opponentDeck: oppDecks.join(', '),
      diff,
      memo: selectedTags.join(', ')
    };
    if (!finalData.turn && !finalData.result) return;

    setIsProcessing(true);
    lastSaveTimeRef.current = now;
    try {
      const res = await postData(finalData);
      if (res?.success) {
        if (finalData.result === 'VICTORY') { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3000); }
        playNotificationSound('double');
        setLastRating(parseFloat(finalData.diff) || lastRating);
        resetSlots();
        onRecorded();
      }
    } catch (err) { console.error("Save failed:", err); } finally { setIsProcessing(false); }
  }, [mode, turn, result, diff, myDecks, oppDecks, selectedTags, lastRating, onRecorded, resetSlots, isProcessing]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    const v = videoRef.current, c = canvasRef.current, ctx = c.getContext('2d');
    const vw = v.videoWidth, vh = v.videoHeight;
    const { isTurnLocked: tLock, isResultLocked: rLock, mode: curMode } = slotsRef.current;

    const triggerAutoSaveForNextMatch = async (curSlots) => {
      if (isProcessing || (!curSlots.turn && !curSlots.result)) return;
      const now = Date.now();
      if (now - lastSaveTimeRef.current < 2000) return;
      setIsProcessing(true);
      lastSaveTimeRef.current = now;
      try {
        const res = await postData({ 
          mode: curSlots.mode, turn: curSlots.turn, result: curSlots.result, diff: curSlots.diff,
          myDeck: curSlots.myDecks.join(', '), opponentDeck: curSlots.oppDecks.join(', '), memo: selectedTags.join(', ')
        });
        if (res?.success) {
          if (curSlots.result === 'VICTORY') { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3000); }
          playNotificationSound('double');
          setLastRating(parseFloat(curSlots.diff) || lastRating);
          onRecorded();
        }
      } catch (e) { console.error("Auto-save failed:", e); } finally { setIsProcessing(false); }
    };

    const PREV_W = 320, PREV_H = 180;
    c.width = PREV_W; c.height = PREV_H;
    ctx.drawImage(v, 0, 0, vw, vh, 0, 0, PREV_W, PREV_H);
    const { jpn, eng } = workersRef.current;

    try {
      if ((currentState === STATES.DETECTING_TURN && !tLock) || currentState === STATES.NEXT_MATCH_STANDBY) {
        setOcrLog(currentState === STATES.NEXT_MATCH_STANDBY ? "終了待機・次試合検知中..." : "ターン検知中...");
        const roi = ROIS.TURN;
        const { bin, width, height, bbox } = normalizeContent(v, vw * roi.x, vh * roi.y, vw * roi.w, vh * roi.h, 200, 60, 160);
        detectedBboxRef.current = { ...bbox, roiName: 'TURN' };
        if (width > 1 && height > 1) {
          if (!ocrCanvasRef.current) ocrCanvasRef.current = document.createElement('canvas');
          const ocrCanvas = ocrCanvasRef.current;
          if (ocrCanvas.width !== width) ocrCanvas.width = width;
          if (ocrCanvas.height !== height) ocrCanvas.height = height;
          
          // Manual binarized draw to avoid createBinarizedCanvas allocation
          const ocrCtx = ocrCanvas.getContext('2d');
          const ocrImgData = ocrCtx.createImageData(width, height);
          for (let i = 0; i < bin.length; i++) {
            const val = bin[i] === 1 ? 0 : 255;
            const idx = i * 4;
            ocrImgData.data[idx] = val; ocrImgData.data[idx+1] = val; ocrImgData.data[idx+2] = val; ocrImgData.data[idx+3] = 255;
          }
          ocrCtx.putImageData(ocrImgData, 0, 0);

          if (jpn) {
            const { data: { text, confidence } } = await jpn.recognize(ocrCanvas);
            const cleanText = text.replace(/\s+/g, '').slice(0, 15);
            setTurnScore(confidence / 100);

            const res_f = { match: fuzzyIncludes(cleanText, 'あなたが先攻です', 2), confidence };
            const res_s = { match: fuzzyIncludes(cleanText, 'あなたが後攻です', 2), confidence };

            if (res_f.match || res_s.match) {
              // Priority: Explicitly look for the character '先' or '後'
              const hasFirstChar = cleanText.includes('先');
              const hasSecondChar = cleanText.includes('後');
              
              let foundTurnValue = null;
              if (hasFirstChar && !hasSecondChar) foundTurnValue = '先';
              else if (hasSecondChar && !hasFirstChar) foundTurnValue = '後';
              else {
                // Fallback to phrase matching if character is not clear
                foundTurnValue = res_f.match ? '先' : '後';
              }
              
              const foundScore = res_f.match ? res_f.confidence : res_s.confidence;
              
              if (currentState === STATES.NEXT_MATCH_STANDBY) {
                const cur = slotsRef.current;
                if (cur.turn || cur.result) {
                  // データ送信（GASへのリクエスト）で数秒かかるため、awaitを外してOCRループのブロッキング（6秒フリーズ判定）を回避する
                  triggerAutoSaveForNextMatch(cur).catch(err => console.error("Auto-save error:", err));
                }
                resetSlots();
              }
              
              setTurn(foundTurnValue); 
              setIsTurnLocked(true);
              setTurnScore(foundScore / 100);
              setCurrentState(STATES.IN_MATCH); 
              stateRef.current = STATES.IN_MATCH;
              setOcrLog(`対戦中... [${foundTurnValue === '先' ? '先攻' : '後攻'}] を検知しました`);
              playNotificationSound('single');
              stablePointsBufferRef.current = [];
            }
          }
        }
      }
      else if (currentState === STATES.IN_MATCH || (currentState === STATES.DETECTING_RESULT && !rLock)) {
        setOcrLog("対戦中... 結果画面（VICTORY/DEFEAT）を待機しています");
        const roi = ROIS.RESULT;
        // Apply deskewing angle (-9.0 degrees) and Auto-Threshold (0) during normalization
        const { bin: roiBin, width, height, bbox } = normalizeContent(v, vw * roi.x, vh * roi.y, vw * roi.w, vh * roi.h, 300, 120, 0, -9.0);
        detectedBboxRef.current = { ...bbox, roiName: 'RESULT' };
        if (width > 1 && height > 1) {
          if (!ocrCanvasRef.current) ocrCanvasRef.current = document.createElement('canvas');
          const ocrCanvas = ocrCanvasRef.current;
          if (ocrCanvas.width !== width) ocrCanvas.width = width;
          if (ocrCanvas.height !== height) ocrCanvas.height = height;
          
          const ocrCtx = ocrCanvas.getContext('2d');
          const ocrImgData = ocrCtx.createImageData(width, height);
          for (let i = 0; i < roiBin.length; i++) {
            const val = roiBin[i] === 1 ? 0 : 255;
            const idx = i * 4;
            ocrImgData.data[idx] = val; ocrImgData.data[idx+1] = val; ocrImgData.data[idx+2] = val; ocrImgData.data[idx+3] = 255;
          }
          ocrCtx.putImageData(ocrImgData, 0, 0);

          if (eng) {
            const { data: { text, confidence } } = await eng.recognize(ocrCanvas);
            const cleanText = text.toUpperCase().replace(/\s+/g, '').slice(0, 15);
            setResultScore(confidence / 100);

            let sequenceResult = null;
            const { extractSequenceFeatures, matchSequence } = await import('../lib/visionEngine');
            const rawData = ocrCanvas.getContext('2d').getImageData(0, 0, width, height);
            const { features, comps, bin } = extractSequenceFeatures(rawData, 0, 0);
            
            const tVictory = matchSequence(features, statusTemplatesRef.current.victory || []);
            const tLose = matchSequence(features, statusTemplatesRef.current.lose || []);
            if (tVictory.match) sequenceResult = 'VICTORY'; else if (tLose.match) sequenceResult = 'DEFEAT';

            const isVictory = fuzzyIncludes(cleanText, 'VICTORY', 2);
            const isDefeat = fuzzyIncludes(cleanText, 'DEFEAT', 2) || fuzzyIncludes(cleanText, 'LOSE', 1);

            if ((sequenceResult || isVictory || isDefeat) && (confidence > 50 || sequenceResult)) {
              const detectedResult = sequenceResult || (isVictory ? 'VICTORY' : 'DEFEAT');
              setResult(detectedResult); setIsResultLocked(true);
              setOcrLog(`勝敗確定: ${detectedResult} ${sequenceResult ? '(Template)' : ''}`);
              
              const gallery = comps.map(c => getCompDataURL(bin, width, height, c));
              setDebugGallery(gallery);
              const nextState = (curMode === 'ランク' || slotsRef.current.isDiffLocked) ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING;
              setCurrentState(nextState); stateRef.current = nextState;
              playNotificationSound('single');
            }
          }
        }
      }
      else if (currentState === STATES.DETECTING_RATING && !slotsRef.current.isDiffLocked) {
        const ratingRoi = curMode === 'DC' ? ROIS.DC_POINTS : ROIS.RATING;
        const id = getROIData(ctx, v, ratingRoi, 300, 120);
        const { multiThresholdDetectRating } = await import('../lib/visionEngine');
        const multiRes = multiThresholdDetectRating(id);
        const detected = multiRes.result;
        if (detected && detected.length >= 4) {
          const buffer = stablePointsBufferRef.current;
          buffer.push(detected); if (buffer.length > 3) buffer.shift();
          if (buffer.length === 3 && buffer.every(v => v === detected)) {
            const isDC = curMode === 'DC';
            const formatted = isDC ? detected.replace(/\./g, '') : (parseFloat(detected) / 100).toFixed(2);
            setDiff(formatted); setRatingChange(formatted); setIsDiffLocked(true);
            setCurrentState(STATES.NEXT_MATCH_STANDBY); stateRef.current = STATES.NEXT_MATCH_STANDBY;
            playNotificationSound('single'); stablePointsBufferRef.current = [];
          }
        } else { stablePointsBufferRef.current = []; }
      }
      
      if (showRoiOverlay) {
        ctx.lineWidth = 1;
        Object.entries(ROIS).forEach(([name, roi]) => {
          ctx.strokeStyle = name === 'TURN' ? '#fbbf24' : name === 'RESULT' ? '#a78bfa' : '#3b82f6';
          ctx.strokeRect(roi.x * PREV_W, roi.y * PREV_H, roi.w * PREV_W, roi.h * PREV_H);
        });
      }
    } catch (err) { console.error(err); }
  }, [currentState, showRoiOverlay, saveMatch]);

  useEffect(() => {
    currentAnalyzeRef.current = captureAndAnalyze;
  }, [captureAndAnalyze]);

  const startCapture = async () => {
    try {
      playNotificationSound();
      await initTesseract();
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "never", frameRate: { ideal: 10, max: 15 }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }, audio: false 
      });
      setStream(mediaStream); setIsRecording(true);
      setCurrentState(STATES.DETECTING_TURN); stateRef.current = STATES.DETECTING_TURN;
      mediaStream.getVideoTracks()[0].onended = () => stopRecording();
      if (ocrWorkerRef.current) ocrWorkerRef.current.postMessage({ action: 'start' });
    } catch (err) { setOcrLog("キャプチャ失敗"); }
  };

  const stopRecording = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsRecording(false);
    if (ocrWorkerRef.current) ocrWorkerRef.current.postMessage({ action: 'stop' });
  };

  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); setIsPipActive(false); }
      else { await videoRef.current.requestPictureInPicture(); setIsPipActive(true); }
    } catch (e) { alert("PiP not supported"); }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const key = e.key.toUpperCase();
      if (key === 'S') { e.preventDefault(); saveMatch(); }
      else if (key === 'R') { e.preventDefault(); resetSlots(); }
      else if (key === 'V') { e.preventDefault(); if (stream) stopRecording(); else startCapture(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stream, saveMatch, resetSlots, startCapture, stopRecording]);

  return (
    <div className="space-y-6">
      {showCelebration && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none drop-shadow-2xl">
          <div className="bg-zinc-900 border-2 border-emerald-500 p-6 rounded-3xl shadow-emerald-500/20 shadow-2xl animate-bounce text-center">
            <span className="text-2xl font-black text-emerald-400 uppercase tracking-widest">Match Saved!</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[{ label: 'TURN', val: turn }, { label: 'RESULT', val: result }, { label: 'POINTS', val: diff }].map((s) => (
          <div key={s.label} className="p-2 rounded border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
            <div className="text-[8px] text-zinc-500 font-black mb-1">{s.label}</div>
            <div className={`w-2 h-2 rounded-full ${s.val ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
          </div>
        ))}
      </div>
      <div ref={stickyRef} className="h-[1px] w-full bg-transparent" /> {/* Physical Sentinel */}
      <div 
        className={`aspect-video rounded-xl overflow-hidden relative transition-all duration-300 ${
          isSticky 
            ? captureStatus === 'FROZEN' 
              ? 'sticky top-4 z-40 bg-black/80 border border-rose-500 shadow-2xl opacity-100 backdrop-blur-md' // Visible if frozen
              : 'sticky top-4 z-0 opacity-0 pointer-events-none border-transparent' // Ghost Mode
            : 'bg-black/80 border border-zinc-700/50 z-10 opacity-100 sticky top-4 shadow-2xl backdrop-blur-md' // Normal Mode
        }`}
      >
        {stream ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-sm">Launch Capture to Start</div>
        )}
        
        {/* Unified Visibility/Freeze Warning Overlay */}
        {isRecording && captureStatus === 'FROZEN' && (
          <div className="absolute inset-0 z-30 bg-rose-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <Activity className="w-12 h-12 text-rose-400 mb-2 animate-pulse" />
            <div className="text-white font-bold text-lg mb-1">
              画像認識が停止しています
            </div>
            <p className="text-rose-100 text-xs">
              画面が隠れているか、タブが非アクティブな可能性があります。<br />
              プレビューが見える位置に戻してください。
            </p>
          </div>
        )}

        {isRecording && <button onClick={togglePip} className="absolute bottom-4 right-4 p-2.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-400 z-40"><Monitor className="w-5 h-5" /></button>}
      </div>
      {stream && (
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-400" /> Slot-Filling Engine</h3>
            <OcrStatus log={ocrLog} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 p-2 rounded border border-zinc-700 shadow-inner flex flex-col items-center relative min-h-[200px]">
              <canvas ref={canvasRef} className="max-w-full h-auto rounded border border-zinc-900" />
              <button onClick={() => setShowRoiOverlay(!showRoiOverlay)} className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 rounded border border-zinc-700 text-zinc-400">{showRoiOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={() => { 
                  setTurn(t => t === '先' ? '後' : '先'); 
                  setIsTurnLocked(true); 
                  if (currentState === STATES.DETECTING_TURN) {
                    setCurrentState(STATES.IN_MATCH);
                    stateRef.current = STATES.IN_MATCH;
                  }
                }}
                className="p-4 rounded-xl border border-zinc-700 bg-zinc-900/50 text-center cursor-pointer hover:border-indigo-500 transition-colors group"
              >
                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-1 group-hover:text-indigo-400">Turn</div>
                <div className="text-xl font-black text-indigo-400">{turn ? (turn + '攻') : '--'}</div>
              </div>
              <div 
                onClick={() => { 
                  setResult(r => r === 'VICTORY' ? 'DEFEAT' : 'VICTORY'); 
                  setIsResultLocked(true); 
                  const nextState = (mode === 'ランク' || isDiffLocked) ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING;
                  setCurrentState(nextState);
                  stateRef.current = nextState;
                }}
                className={`p-4 rounded-xl border border-zinc-700 bg-zinc-900/50 text-center cursor-pointer transition-colors group ${
                  result === 'DEFEAT' ? 'hover:border-rose-500' : 'hover:border-emerald-500'
                }`}
              >
                <div className={`text-[9px] uppercase font-bold mb-1 transition-colors ${
                  result === 'DEFEAT' ? 'text-rose-900/50 group-hover:text-rose-400' : 'text-zinc-500 group-hover:text-emerald-400'
                }`}>Result</div>
                <div className={`text-xl font-black ${
                  result === 'DEFEAT' ? 'text-rose-500' : 'text-emerald-400'
                }`}>{result || '--'}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-inner text-center col-span-2 relative">
                <label className="absolute top-2 left-3 text-[9px] text-zinc-500 uppercase font-bold">Diff / Rating</label>
                <input 
                  type="text" 
                  value={diff} 
                  onChange={e => { 
                    const val = e.target.value;
                    setDiff(val); 
                    setRatingChange(val);
                    const isLocked = val.trim() !== '';
                    setIsDiffLocked(isLocked); 
                    
                    if (isLocked) {
                      if (currentState === STATES.DETECTING_RATING) {
                        setCurrentState(STATES.NEXT_MATCH_STANDBY);
                        stateRef.current = STATES.NEXT_MATCH_STANDBY;
                      }
                    } else {
                      if (currentState === STATES.NEXT_MATCH_STANDBY && result && mode !== 'ランク') {
                        setCurrentState(STATES.DETECTING_RATING);
                        stateRef.current = STATES.DETECTING_RATING;
                      }
                    }
                  }} 
                  className="w-full bg-transparent text-4xl font-black text-indigo-400 outline-none text-center" 
                  placeholder="--" 
                />
              </div>
              <div className="flex flex-col gap-2 col-span-2 mt-2">
                <button onClick={() => saveMatch()} disabled={isProcessing || !turn || !result} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]">
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Submit Record
                </button>
                <button onClick={() => resetSlots()} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                  <RotateCcw className="w-4 h-4" /> Reset Match Slots
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-4">
        {!isRecording ? <button onClick={startCapture} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.98]"><PlayCircle className="w-7 h-7" /> Launch Vision</button> : <button onClick={stopRecording} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.98]"><Square className="w-7 h-7" /> Stop Flow</button>}
      </div>
      <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-lg relative" onFocusCapture={() => setIsInputActive(true)} onBlurCapture={() => setIsInputActive(false)}>
        <div className="max-w-2xl mx-auto space-y-4">
          <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none"><option value="ランク">Normal Ranked</option><option value="レート戦">Rating Match</option><option value="DC">DC / Event</option></select>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableDecks} onChange={setMyDecks} selectedDecks={myDecks} placeholder="Select My Deck" /></div><button onClick={() => setIsMyDeckLocked(!isMyDeckLocked)} className={`p-2 rounded-lg border transition ${isMyDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isMyDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableDecks} onChange={setOppDecks} selectedDecks={oppDecks} placeholder="Select Opponent Deck" /></div><button onClick={() => setIsOpponentDeckLocked(!isOpponentDeckLocked)} className={`p-2 rounded-lg border transition ${isOpponentDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isOpponentDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableTags} onChange={setSelectedTags} selectedDecks={selectedTags} placeholder="Match Deciding Factor" /></div><button onClick={() => setIsTagsLocked(!isTagsLocked)} className={`p-2 rounded-lg border transition ${isTagsLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isTagsLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
        </div>
      </div>
    </div>
  );
}
