import React, { useState, useRef, useEffect, useCallback } from 'react';
import { normalizeTheme, normalizeThemeString } from '../lib/themeUtils';
import { MonitorUp, Square, Save, Loader2, Trophy, Activity, Lock, LockOpen, Eye, EyeOff, Monitor, RotateCcw, PlayCircle, HelpCircle } from 'lucide-react';
import DeckSelect from './DeckSelect';
import { postData } from '../lib/api';
import { fuzzyIncludes } from '../lib/utils';
import Fuse from 'fuse.js';
import { createWorker } from 'tesseract.js';
import { 
  ROIS, getROIData, STATES, detectRating, normalizeContent, 
  drawBinarizedToCanvas, createBinarizedCanvas, 
  extractSequenceFeatures, matchSequence, multiThresholdDetectRating,
  detectCardColor, getGameAreaBox, toGrayscale, calculateSSD
} from '../lib/visionEngine';

// ==========================================
// Text Normalization (Zen-Han conversion)
// ==========================================
function normalizeCardName(text) {
  if (!text) return '';
  return text
    .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数記号 -> 半角
    .replace(/－/g, '-') // 全角ハイフン -> 半角
    .replace(/　/g, ' ') // 全角スペース -> 半角
    .replace(/\s+/g, '') // 全てのスペースを除去（検索用）
    .trim();
}

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

// OcrStatus removed in favor of ActivityLog

export default function Recorder({ availableDecks, availableTags, onRecorded, onOpenManual }) {
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
  const jpnWorkerRef = useRef(null);
  const isCardOcrBusyRef = useRef(false);
  const lastAnalyzeTimeRef = useRef(0);
  const rvfcIdRef = useRef(null);
  const silentOscRef = useRef(null);
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

  const [lastRating, setLastRating] = useState(null);
  const lastSaveTimeRef = useRef(0);
  const [ocrLogs, setOcrLogs] = useState([{ time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg: '待機中', type: 'info' }]);
  
  const addLog = useCallback((msg, type = 'info') => {
    setOcrLogs(prev => {
      if (prev.length > 0 && prev[0].msg === msg) return prev;
      const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newLogs = [{ time, msg, type }, ...prev];
      if (newLogs.length > 50) newLogs.pop(); // Keep last 50
      return newLogs;
    });
  }, []);

  const [showCelebration, setShowCelebration] = useState(false);
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);
  const [currentState, setCurrentState] = useState(STATES.IDLE);
  const [detectedCards, setDetectedCards] = useState([]);
  const detectedCardsRef = useRef([]);

  useEffect(() => {
    let msg = '';
    if (currentState === STATES.DETECTING_TURN) msg = "ターン検知中...";
    else if (currentState === STATES.NEXT_MATCH_STANDBY) msg = "終了待機・次試合検知中...";
    else if (currentState === STATES.DETECTING_RESULT) msg = "対戦終了の検知中...";
    
    if (msg) addLog(msg, 'info');
  }, [currentState, addLog]);

  // Card Database & Fuse.js
  const fuseRef = useRef(null);
  const cardVotesRef = useRef({}); 
  const detectionAttemptsRef = useRef(0); 
  const prevGrayRef = useRef(null); 
  const lastDetectedSideRef = useRef('NONE');
  const lastFrameCardNameRef = useRef(''); 
  const detectionWindowRef = useRef([]); 
  const [currentCard, setCurrentCard] = useState({ name: '', archetype: '', confidence: 0, votes: 0 }); 

  const themeMapRef = useRef({});

  useEffect(() => {
    fetch('/card_db.json')
      .then(res => res.json())
      .then(data => {
        fuseRef.current = new Fuse(data, {
          keys: ['normalizedName'], 
          includeScore: true,
          threshold: 0.2, 
          distance: 100,
          ignoreLocation: true
        });
        console.log(`[Card DB] Ready with ${data.length} records.`);
      })
      .catch(e => console.error("Card DB load failed:", e));

    fetch('/theme_map.json')
      .then(res => res.json())
      .then(data => {
        themeMapRef.current = data;
        console.log(`[Theme Map] Ready with ${Object.keys(data).length} mappings.`);
      })
      .catch(e => console.error("Theme map load failed:", e));
  }, []);

  const [isFrozen, setIsFrozen] = useState(false);
  const isFrozenRef = useRef(false);
  const stickyRef = useRef(null);
  const [isSticky, setIsSticky] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('NORMAL'); 
  const lastUpdateRef = useRef(Date.now());
  const warningCooldownRef = useRef(0);

  const stateRef = useRef(currentState);
  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  const currentAnalyzeRef = useRef(null);

  const recordingRef = useRef(isRecording);
  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);

  const slotsRef = useRef({ turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked });
  useEffect(() => { slotsRef.current = { turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked }; }, [turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked]);

  const workersRef = useRef({ jpn: null, eng: null });

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

  const loadStatusTemplates = useCallback(async () => {
    const urls = {
      victory: '/templates/victory.png',
      lose: '/templates/lose.png'
    };
    const templates = {};
    for (const [key, url] of Object.entries(urls)) {
      try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const { features } = extractSequenceFeatures(imageData, 0, -9.0);
        templates[key] = features;
      } catch (err) { console.warn(`Failed to load template: ${key}`, err); }
    }
    statusTemplatesRef.current = templates;
  }, []);

  useEffect(() => {
    loadStatusTemplates();
    const observer = new IntersectionObserver(([entry]) => { setIsElementVisible(entry.isIntersecting); }, { threshold: 0.1 });
    if (videoRef.current) observer.observe(videoRef.current);
    const handleVisibilityChange = () => { setIsTabVisible(document.visibilityState === 'visible'); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    try {
      ocrWorkerRef.current = new Worker(new URL('/ocrWorker.js', import.meta.url));
      ocrWorkerRef.current.onmessage = (e) => {
        if (e.data.type === 'tick' && isBusyRef.current === false && recordingRef.current) {
          const now = Date.now();
          if (now - lastUpdateRef.current > 6000 && !isFrozenRef.current) {
            setIsFrozen(true);
            isFrozenRef.current = true;
          }
          if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) return;
          isBusyRef.current = true;
          if (currentAnalyzeRef.current) { currentAnalyzeRef.current().finally(() => { isBusyRef.current = false; }); }
        }
      };
    } catch (e) { console.error("Worker error:", e); }

    const handleScroll = () => {
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
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (ocrWorkerRef.current) ocrWorkerRef.current.terminate();
      if (workersRef.current.jpn) { workersRef.current.jpn.terminate(); workersRef.current.jpn = null; }
      if (workersRef.current.eng) { workersRef.current.eng.terminate(); workersRef.current.eng = null; }
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadStatusTemplates]);

  const [isElementVisible, setIsElementVisible] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    if (isFrozen && isRecording) {
      setCaptureStatus('FROZEN');
      const now = Date.now();
      if (now - warningCooldownRef.current > 6000) { playNotificationSound('warning'); warningCooldownRef.current = now; }
    } else { setCaptureStatus('NORMAL'); }
  }, [isFrozen, isRecording]);

  useEffect(() => {
    if (isRecording && ocrWorkerRef.current) {
      const curState = stateRef.current;
      let interval = 500;
      if (curState === STATES.IN_MATCH) interval = 800;
      ocrWorkerRef.current.postMessage({ action: 'start', interval });
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain(); g.gain.value = 0.0001;
        osc.connect(g); g.connect(audioCtx.destination); osc.start();
        silentOscRef.current = osc;
      } catch (e) { }
      if (videoRef.current && 'requestVideoFrameCallback' in videoRef.current) {
        const loop = (now, metadata) => {
          if (!recordingRef.current) return;
          const curTime = Date.now();
          const targetInterval = stateRef.current === STATES.IN_MATCH ? 800 : 500;
          if (curTime - lastAnalyzeTimeRef.current >= targetInterval && isBusyRef.current === false) {
            // タブが隠れているか、要素が見えていない場合は、さらに認識頻度を落とす
            if (!isTabVisible || !isElementVisible) {
               if (curTime - lastAnalyzeTimeRef.current < 2000) {
                 rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
                 return;
               }
            }

            isBusyRef.current = true;
            lastAnalyzeTimeRef.current = curTime;
            lastUpdateRef.current = curTime;
            if (isFrozenRef.current) { setIsFrozen(false); isFrozenRef.current = false; playNotificationSound('restore'); }
            if (currentAnalyzeRef.current) { currentAnalyzeRef.current().finally(() => { isBusyRef.current = false; }); }
          }
          rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
        };
        rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
      }
    } else {
      if (ocrWorkerRef.current) ocrWorkerRef.current.postMessage({ action: 'stop' });
      if (silentOscRef.current) { try { silentOscRef.current.stop(); } catch (e) { } silentOscRef.current = null; }
      if (videoRef.current && rvfcIdRef.current) { videoRef.current.cancelVideoFrameCallback(rvfcIdRef.current); rvfcIdRef.current = null; }
    }
  }, [isRecording, currentState]);

  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  // Auto-fill themes and tags on Match End
  const autoFillRunRef = useRef(false);
  useEffect(() => {
    if (result === 'VICTORY' || result === 'LOSE') {
      if (!autoFillRunRef.current) {
        autoFillRunRef.current = true;
        const translateTheme = (t) => themeMapRef.current[t] || t;
        
        // --- 1. Themes (Decks) ---
        const getValidThemes = (cards) => {
          const stats = {}; // themeName -> Set of unique card names
          cards.forEach(c => {
            const theme = normalizeTheme(translateTheme(c.archetype));
            if (!stats[theme]) stats[theme] = new Set();
            stats[theme].add(c.name);
          });
          return Object.entries(stats)
            .filter(([_, names]) => names.size >= 3)
            .map(([theme]) => theme);
        };

        const myThemes = getValidThemes(detectedCardsRef.current.filter(c => c.side === 'BLUE' && c.archetype));
        const oppThemes = getValidThemes(detectedCardsRef.current.filter(c => c.side === 'RED' && c.archetype));

        let msgParts = [];
        if (!isMyDeckLocked && myThemes.length > 0) {
          setMyDecks(prev => [...new Set([...prev, ...myThemes])]);
          msgParts.push(`味方テーマ: ${myThemes.join(', ')}`);
        }
        if (!isOpponentDeckLocked && oppThemes.length > 0) {
          setOppDecks(prev => [...new Set([...prev, ...oppThemes])]);
          msgParts.push(`相手テーマ: ${oppThemes.join(', ')}`);
        }

        // --- 2. Tags (based on Card Names with Side awareness) ---
        if (!isTagsLocked && availableTags && availableTags.length > 0) {
          const myCardNames = new Set(detectedCardsRef.current.filter(c => c.side === 'BLUE').map(c => c.name));
          const oppCardNames = new Set(detectedCardsRef.current.filter(c => c.side === 'RED').map(c => c.name));
          
          const matchedTags = availableTags.filter(tag => {
            // Check for Self [+] 自：
            if (tag.includes('自：')) {
              return Array.from(myCardNames).some(name => tag.endsWith(name));
            }
            // Check for Opponent [-] 敵： or [‐] 敵：
            if (tag.includes('敵：')) {
              return Array.from(oppCardNames).some(name => tag.endsWith(name));
            }
            return false;
          });
          
          if (matchedTags.length > 0) {
            setSelectedTags(prev => [...new Set([...prev, ...matchedTags])]);
            msgParts.push(`タグ追加: ${matchedTags.length}件`);
          }
        }

        if (msgParts.length > 0) {
          addLog(`自動入力完了: ${msgParts.join(' / ')}`, 'success');
        }
      }
    } else {
      autoFillRunRef.current = false;
    }
  }, [result, isMyDeckLocked, isOpponentDeckLocked, isTagsLocked, availableTags, addLog]);

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
    setDetectedCards([]);
    detectedCardsRef.current = [];
    cardVotesRef.current = {};
    detectionWindowRef.current = [];
    detectionAttemptsRef.current = 0;
    addLog("スロットリセット → 次の試合待機中", 'info');
  }, [isMyDeckLocked, isOpponentDeckLocked, isTagsLocked, addLog]);

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
        addLog(`Match Saved! [${finalData.result}]`, 'success');
        setLastRating(parseFloat(finalData.diff) || lastRating);
        resetSlots();
        onRecorded();
      }
    } catch (err) { console.error("Save failed:", err); } finally { setIsProcessing(false); }
  }, [mode, turn, result, diff, myDecks, oppDecks, selectedTags, lastRating, onRecorded, resetSlots, isProcessing, addLog]);

  const handleCardClick = useCallback((card) => {
    if (!card.archetype) return;
    
    // Normalize and translate archetype
    const translateTheme = (t) => themeMapRef.current[t] || t;
    const theme = normalizeTheme(translateTheme(card.archetype));
    
    if (card.side === 'BLUE') {
      if (!isMyDeckLocked) {
        setMyDecks(prev => prev.includes(theme) ? prev : [...prev, theme]);
        addLog(`テーマ追加: ${theme} (味方)`, 'success');
        playNotificationSound('restore');
      }
    } else {
      if (!isOpponentDeckLocked) {
        setOppDecks(prev => prev.includes(theme) ? prev : [...prev, theme]);
        addLog(`テーマ追加: ${theme} (相手)`, 'success');
        playNotificationSound('restore');
      }
    }
  }, [isMyDeckLocked, isOpponentDeckLocked, addLog]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    const v = videoRef.current, c = canvasRef.current, ctx = c.getContext('2d', { willReadFrequently: true });
    const rawVw = v.videoWidth, rawVh = v.videoHeight;
    const { bx, by, bw, bh } = getGameAreaBox(rawVw, rawVh);
    const { isTurnLocked: tLock, isResultLocked: rLock, mode: curMode } = slotsRef.current;

    const triggerAutoSaveForNextMatch = async (curSlots) => {
      if (isProcessing || (!curSlots.turn && !curSlots.result)) return;
      const now = Date.now();
      if (now - lastSaveTimeRef.current < 2000) return;
      setIsProcessing(true); lastSaveTimeRef.current = now;
      try {
        const res = await postData({
          mode: curSlots.mode, turn: curSlots.turn, result: curSlots.result, diff: curSlots.diff,
          myDeck: curSlots.myDecks.join(', '), opponentDeck: curSlots.oppDecks.join(', '), memo: selectedTags.join(', ')
        });
        if (res?.success) {
          if (curSlots.result === 'VICTORY') { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3000); }
          playNotificationSound('double');
          addLog(`Auto-Saved! [${curSlots.result}]`, 'success');
          setLastRating(parseFloat(curSlots.diff) || lastRating);
          onRecorded();
        }
      } catch (e) { console.error("Auto-save failed:", e); } finally { setIsProcessing(false); }
    };

    const PREV_W = 320, PREV_H = 180;
    c.width = PREV_W; c.height = PREV_H;
    ctx.drawImage(v, 0, 0, rawVw, rawVh, 0, 0, PREV_W, PREV_H);
    const { jpn, eng } = workersRef.current;

    try {
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
                if (cur.turn || cur.result) { triggerAutoSaveForNextMatch(cur).catch(err => console.error("Auto-save error:", err)); }
                resetSlots();
              }
              setTurn(foundTurnValue); setIsTurnLocked(true); setTurnScore((res_f.match ? res_f.confidence : res_s.confidence) / 100);
              setCurrentState(STATES.IN_MATCH); stateRef.current = STATES.IN_MATCH;
              addLog(`対戦中... [${foundTurnValue === '先' ? '先攻' : '後攻'}] を検知しました`, 'success');
              playNotificationSound('single');
            }
          }
        }
      }
      else if (currentState === STATES.IN_MATCH || (currentState === STATES.DETECTING_RESULT && !rLock)) {
        if (currentState === STATES.IN_MATCH) {
          const colorRoi = ROIS.CARD_COLOR_INDICATOR;
          const cw = Math.max(1, Math.floor(bw * colorRoi.w));
          const ch = Math.max(1, Math.floor(bh * colorRoi.h));
          const colorData = getROIData(ctx, v, colorRoi, cw, ch);
          const colorRes = detectCardColor(colorData);

          if (colorRes.side !== lastDetectedSideRef.current) {
             cardVotesRef.current = {}; detectionAttemptsRef.current = 0; detectionWindowRef.current = []; lastDetectedSideRef.current = colorRes.side;
          }
          if (colorRes.side !== 'NONE') {
            const nameRoi = ROIS.CARD_NAME;
            const { bin: nBin, width: nw, height: nh } = normalizeContent(v, bx + bw * nameRoi.x, by + bh * nameRoi.y, bw * nameRoi.w, bh * nameRoi.h, 200, 100, 0);
            let whitePixels = 0; for (let i = 0; i < nBin.length; i++) { if (nBin[i] === 1) whitePixels++; }
            const whiteRatio = whitePixels / nBin.length;
            if (whiteRatio < 0.01 || whiteRatio > 0.40) {
              // console.log(`[Card Detect] 文字密度エラー (${(whiteRatio * 100).toFixed(1)}%)`);
            } else {
              const curGray = toGrayscale(getROIData(ctx, v, ROIS.CARD_VISUAL, 100, 100));
              if (prevGrayRef.current && prevGrayRef.current.length === curGray.length) {
                const ssd = calculateSSD(curGray, prevGrayRef.current);
                if (ssd > 600) {
                  cardVotesRef.current = {}; detectionAttemptsRef.current = 0; detectionWindowRef.current = []; lastFrameCardNameRef.current = '';
                  addLog('🔄 表示カードの切り替わりを検知', 'info');
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
                   const idx = i * 4; nImg.data[idx] = v2; nImg.data[idx+1] = v2; nImg.data[idx+2] = v2; nImg.data[idx+3] = 255;
                }
                nctx.putImageData(nImg, 0, 0);

                jpn.recognize(nc).then(({ data: { text } }) => {
                  const rawText = text.trim().replace(/\n+/g, '').replace(/\s+/g, '');
                  const cleanText = normalizeCardName(rawText);
                  
                  if (cleanText.length < 3) {
                    // console.log(`[OCR Ignore] Too short: "${cleanText}"`);
                    return;
                  }

                  if (cleanText.length >= 2) {
                    detectionAttemptsRef.current++;
                    if (fuseRef.current) {
                      const results = fuseRef.current.search(cleanText);
                      if (results && results.length > 0) {
                        const bestMatch = results[0].item;
                        const matchScore = results[0].score || 0;
                        if (matchScore < 0.2) {
                            const name = bestMatch.name;
                            const vMap = cardVotesRef.current;
                            let currentWinner = '';
                            let maxVotesSoFar = 0;
                            Object.entries(vMap).forEach(([k, v]) => { if (v.count > maxVotesSoFar) { maxVotesSoFar = v.count; currentWinner = k; } });
                            if (currentWinner && currentWinner !== name && matchScore < 0.2) {
                              cardVotesRef.current = { [name]: { count: 1, archetype: bestMatch.archetype } };
                              detectionAttemptsRef.current = 1; detectionWindowRef.current = []; lastFrameCardNameRef.current = name;
                            } else {
                              if (!vMap[name]) vMap[name] = { count: 0, archetype: bestMatch.archetype };
                              vMap[name].count++; lastFrameCardNameRef.current = name;
                            }

                            const window = detectionWindowRef.current;
                            window.push({ name, archetype: bestMatch.archetype, side: colorRes.side });
                            if (window.length > 5) window.shift();
                            
                            const counts = {}; window.forEach(item => { counts[item.name] = (counts[item.name] || 0) + 1; });
                            let topWindowCard = name; let maxWinVotes = 0;
                            Object.entries(counts).forEach(([k, v]) => { if (v > maxWinVotes) { maxWinVotes = v; topWindowCard = k; } });
                            
                            const winnerData = window.find(item => item.name === topWindowCard);
                            const reliability = (maxWinVotes / window.length * 100).toFixed(0);
                            
                            setCurrentCard({
                              name: topWindowCard, archetype: winnerData.archetype, side: winnerData.side,
                              confidence: reliability,
                              votes: maxWinVotes
                            });
                            
                            console.log(`[Stable Monitor] Window winner: ${topWindowCard} (${maxWinVotes}/${window.length}) | Side: ${winnerData.side}`);

                            if (maxWinVotes >= 2) {
                               const isAlreadyDetected = detectedCardsRef.current.some(c => c.name === topWindowCard && c.side === winnerData.side);
                               if (!isAlreadyDetected) {
                                 const newCard = { name: topWindowCard, archetype: winnerData.archetype, side: winnerData.side, timestamp: Date.now() };
                                 detectedCardsRef.current.push(newCard); // Refを同期
                                 setDetectedCards([...detectedCardsRef.current]); // Stateを同期
                                 
                                 // 副作用（ログ出力）をここで確実に実行
                                 addLog(`カード検知: ${topWindowCard} (${winnerData.side === 'BLUE' ? '味方' : '相手'})`, winnerData.side === 'BLUE' ? 'info' : 'warning');
                                 console.log(`[Log Add] Adding card to history: ${topWindowCard} (${winnerData.side})`);
                               }
                            }
                        } else {
                          // console.log(`[Fuse Low Score] ${cleanText} (Score: ${matchScore.toFixed(3)})`);
                        }
                      }
                    }
                  }
                }).catch(e => console.error("Card OCR Failed:", e)).finally(() => { 
                  isCardOcrBusyRef.current = false; 
                });
              }
            }
          }
        }
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
          ocrCtx.putImageData(ocrImgData, 0, 0);
          if (eng) {
            const { data: { text, confidence } } = await eng.recognize(ocrCanvas);
            const cleanText = text.toUpperCase().replace(/\s+/g, '').slice(0, 15);
            setResultScore(confidence / 100);
            const rawData = ocrCtx.getImageData(0, 0, width, height);
            const { features } = extractSequenceFeatures(rawData, 0, 0);
            const tVictory = matchSequence(features, statusTemplatesRef.current.victory || []);
            const tLose = matchSequence(features, statusTemplatesRef.current.lose || []);
            let sequenceResult = tVictory.match ? 'VICTORY' : (tLose.match ? 'LOSE' : null);
            const isVictory = fuzzyIncludes(cleanText, 'VICTORY', 2);
            const isLose = confidence > 75 && fuzzyIncludes(cleanText, 'LOSE', 1);
            if (sequenceResult || isVictory || isLose) {
              const detectedResult = sequenceResult || (isVictory ? 'VICTORY' : 'LOSE');
              setResult(detectedResult); setIsResultLocked(true);
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
        const multiRes = multiThresholdDetectRating(id);
        const d = multiRes.result;
        if (d && d.length >= 4) {
          const buffer = stablePointsBufferRef.current; buffer.push(d); if (buffer.length > 3) buffer.shift();
          if (buffer.length === 3 && buffer.every(v => v === d)) {
            const f = curMode === 'DC' ? d.replace(/\./g, '') : (parseFloat(d) / 100).toFixed(2);
            setDiff(f); setRatingChange(f); setIsDiffLocked(true);
            setCurrentState(STATES.NEXT_MATCH_STANDBY); stateRef.current = STATES.NEXT_MATCH_STANDBY;
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
  }, [currentState, showRoiOverlay, saveMatch, addLog]);

  useEffect(() => { currentAnalyzeRef.current = captureAndAnalyze; }, [captureAndAnalyze]);

  const stopRecording = useCallback(() => { if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); } setIsRecording(false); }, [stream]);

  const startCapture = useCallback(async () => {
    try {
      playNotificationSound(); await initTesseract();
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "never", frameRate: { ideal: 10, max: 15 }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }, audio: false });
      lastUpdateRef.current = Date.now(); setIsFrozen(false); isFrozenRef.current = false;
      setStream(mediaStream); setIsRecording(true);
      setCurrentState(STATES.DETECTING_TURN); stateRef.current = STATES.DETECTING_TURN;
      mediaStream.getVideoTracks()[0].onended = () => stopRecording();
    } catch (err) { console.error(err); addLog("キャプチャ失敗", 'error'); }
  }, [stopRecording, addLog]);

  const togglePip = async () => {
    try { if (document.pictureInPictureElement) { await document.exitPictureInPicture(); setIsPipActive(false); } else { await videoRef.current.requestPictureInPicture(); setIsPipActive(true); } } catch (e) { }
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
      <div ref={stickyRef} className="h-[1px] w-full bg-transparent" />
      <div
        className={`aspect-video rounded-xl overflow-hidden relative transition-all duration-300 ${isSticky
            ? captureStatus === 'FROZEN'
              ? 'sticky top-4 z-40 bg-black/80 border border-rose-500 shadow-2xl opacity-100 backdrop-blur-md' // Visible if frozen
              : 'sticky top-4 z-0 opacity-0 pointer-events-none border-transparent' // Ghost Mode
            : 'bg-black/80 border border-zinc-700/50 z-10 opacity-100 sticky top-4 shadow-2xl backdrop-blur-md' // Normal Mode
          }`}
      >
        {stream ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-sm">Launch Capture to Start</div>
        )}
        {isRecording && captureStatus === 'FROZEN' && (
          <div className="absolute inset-0 z-30 bg-rose-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <Activity className="w-12 h-12 text-rose-400 mb-2 animate-pulse" />
            <div className="text-white font-bold text-lg mb-1">画像認識停止中</div>
          </div>
        )}
        {isRecording && <button onClick={togglePip} className="absolute bottom-4 right-4 p-2.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-400 z-40"><Monitor className="w-5 h-5" /></button>}
      </div>
      {stream && (
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-4"><h3 className="text-zinc-100 font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-400" /> Slot-Filling Engine</h3></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 p-2 rounded border border-zinc-700 shadow-inner flex flex-col items-center relative min-h-[200px]">
              <canvas ref={canvasRef} className="max-w-full h-auto rounded border border-zinc-900" />
              <button onClick={() => setShowRoiOverlay(!showRoiOverlay)} className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 rounded border border-zinc-700 text-zinc-400 z-10">{showRoiOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
              {currentCard.name && (
                <div className={`absolute bottom-2 left-2 right-2 p-2 rounded-lg border-2 shadow-2xl backdrop-blur-md ${currentCard.side === 'BLUE' ? 'bg-indigo-600/90 border-indigo-400 text-white' : 'bg-rose-600/90 border-rose-400 text-white'}`}>
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0"><span className="bg-black/30 px-1.5 py-0.5 rounded text-[7px] uppercase font-black shrink-0">Live</span><span className="font-black text-xs truncate uppercase tracking-tight">{currentCard.name}</span></div>
                    <div className="shrink-0 flex items-center gap-1.5"><div className="text-[8px] font-bold opacity-80 uppercase">{currentCard.confidence}%</div><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /></div>
                  </div>
                  <div className="mt-1 flex items-center gap-2"><div className="flex-1 h-1 bg-black/20 rounded-full overflow-hidden"><div className="h-full bg-white/60 transition-all duration-500" style={{ width: `${Math.min(100, (currentCard.votes / 5) * 100)}%` }} /></div><span className="text-[7px] font-bold opacity-60 italic">{currentCard.votes} hits</span></div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div onClick={() => { 
                 const nextTurn = turn === '先' ? '後' : '先';
                 setTurn(nextTurn); setIsTurnLocked(true); 
                 if (currentState === STATES.DETECTING_TURN) { 
                   setCurrentState(STATES.IN_MATCH); stateRef.current = STATES.IN_MATCH; 
                   addLog(`手動操作: 対戦中... [${nextTurn}攻]`, 'success');
                 } 
               }} className="p-4 rounded-xl border border-zinc-700 bg-zinc-900/50 text-center cursor-pointer hover:border-indigo-500 group"><div className="text-[9px] text-zinc-500 uppercase font-bold mb-1 group-hover:text-indigo-400">Turn</div><div className="text-xl font-black text-indigo-400">{turn ? (turn + '攻') : '--'}</div></div>
              <div onClick={() => { 
                const nextResult = result === 'VICTORY' ? 'LOSE' : 'VICTORY';
                setResult(nextResult); setIsResultLocked(true); 
                const n = (mode === 'ランク' || slotsRef.current.isDiffLocked) ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING; 
                if (currentState !== n) {
                  setCurrentState(n); stateRef.current = n; 
                  addLog(`手動操作: 結果入力を受け付けました [${nextResult}]`, 'info');
                }
              }} className={`p-4 rounded-xl border border-zinc-700 bg-zinc-900/50 text-center cursor-pointer group ${result === 'LOSE' ? 'hover:border-rose-500' : 'hover:border-emerald-500'}`}><div className={`text-[9px] uppercase font-bold mb-1 ${result === 'LOSE' ? 'text-rose-900/50 group-hover:text-rose-400' : 'text-zinc-500 group-hover:text-emerald-400'}`}>Result</div><div className={`text-xl font-black ${result === 'LOSE' ? 'text-rose-500' : 'text-emerald-400'}`}>{result || '--'}</div></div>
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-center col-span-2 relative"><label className="absolute top-2 left-3 text-[9px] text-zinc-500 uppercase font-bold">Diff / Rating</label><input type="text" value={diff} onChange={e => { const v = e.target.value; setDiff(v); setRatingChange(v); const l = v.trim() !== ''; setIsDiffLocked(l); if (l && currentState === STATES.DETECTING_RATING) { setCurrentState(STATES.NEXT_MATCH_STANDBY); stateRef.current = STATES.NEXT_MATCH_STANDBY; addLog(`手動操作: レート増減を入力`, 'info'); } }} className="w-full bg-transparent text-4xl font-black text-indigo-400 outline-none text-center" placeholder="--" /></div>
              <div className="flex flex-col gap-2 col-span-2 mt-2"><button onClick={() => saveMatch()} disabled={isProcessing || !turn || !result} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3">{isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Submit Record</button><button onClick={() => resetSlots()} className="w-full bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reset Match Slots</button></div>
            </div>
          </div>
          {/* Terminal Log Area */}
          <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] custom-scrollbar">
            <h4 className="text-zinc-500 mb-2 uppercase font-black text-[9px] flex items-center gap-2"><Activity className="w-3 h-3" /> Activity Log</h4>
            <div className="space-y-1">
              {ocrLogs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-amber-400' : 'text-zinc-300'}`}>
                  <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-4">{!isRecording ? <button onClick={startCapture} className="flex-1 bg-indigo-600 text-white py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3"><PlayCircle className="w-7 h-7" /> Launch Vision</button> : <button onClick={stopRecording} className="flex-1 bg-rose-600 text-white py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3"><Square className="w-7 h-7" /> Stop Flow</button>}</div>
      <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-lg relative" onFocusCapture={() => setIsInputActive(true)} onBlurCapture={() => setIsInputActive(false)}>
        <div className="max-w-2xl mx-auto space-y-4">
          <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none"><option value="ランク">Normal Ranked</option><option value="レート戦">Rating Match</option><option value="DC">DC / Event</option></select>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableDecks} onChange={setMyDecks} selectedDecks={myDecks} placeholder="Select My Deck" /></div><button onClick={() => setIsMyDeckLocked(!isMyDeckLocked)} className={`p-2 rounded-lg border transition ${isMyDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isMyDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableDecks} onChange={setOppDecks} selectedDecks={oppDecks} placeholder="Select Opponent Deck" /></div><button onClick={() => setIsOpponentDeckLocked(!isOpponentDeckLocked)} className={`p-2 rounded-lg border transition ${isOpponentDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isOpponentDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
          <div className="flex items-center gap-2"><div className="flex-1"><DeckSelect availableDecks={availableTags} onChange={setSelectedTags} selectedDecks={selectedTags} placeholder="Match Deciding Factor" /></div><button onClick={() => setIsTagsLocked(!isTagsLocked)} className={`p-2 rounded-lg border transition ${isTagsLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>{isTagsLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}</button></div>
        </div>
      </div>
      {detectedCards.length > 0 && (
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-lg mt-4">
          <h3 className="text-zinc-100 font-semibold mb-4 flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-400" /> 検知カードログ</h3>
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-black text-indigo-400 mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> Your Cards</div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {detectedCards.filter(c => c.side === 'BLUE').map((c, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleCardClick(c)}
                    className={`bg-indigo-900/10 border border-indigo-500/20 p-2.5 rounded-lg flex flex-col gap-0.5 transition-all duration-200 ${c.archetype ? 'cursor-pointer hover:bg-indigo-900/40 active:scale-95' : ''}`}
                  >
                    <span className="text-zinc-100 text-[11px] font-bold truncate">{c.name}</span>
                    {c.archetype && <span className="text-indigo-400/60 text-[8px] font-bold uppercase tracking-tighter">{c.archetype}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-black text-rose-400 mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" /> Opponent's Cards</div>
              <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                {detectedCards.filter(c => c.side === 'RED').map((c, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleCardClick(c)}
                    className={`bg-rose-900/10 border border-rose-500/20 p-2.5 rounded-lg flex flex-col gap-0.5 text-right transition-all duration-200 ${c.archetype ? 'cursor-pointer hover:bg-rose-900/40 active:scale-95' : ''}`}
                  >
                    <span className="text-zinc-100 text-[11px] font-bold truncate">{c.name}</span>
                    {c.archetype && <span className="text-rose-400/60 text-[8px] font-bold uppercase tracking-tighter">{c.archetype}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
