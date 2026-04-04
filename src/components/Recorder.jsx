import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MonitorUp, Square, Save, Loader2, Sparkles, ScanText, RotateCcw, ShieldCheck, AlertCircle, PlayCircle, Trophy, Activity, Lock, LockOpen, Eye, EyeOff, Monitor } from 'lucide-react';
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
      osc.start(now); osc.stop(now + 0.3);
    } else {
      osc.type = 'sine'; osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.2);
    }
  } catch (e) { console.warn("Sound play failed:", e); }
};

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
  const debugTemplateCanvasRef = useRef(null);
  const debugRoiCanvasRef = useRef(null);
  const detectedBboxRef = useRef(null);
  const intervalRef = useRef(null);
  const isBusyRef = useRef(false);
  const stablePointsBufferRef = useRef([]); // Buffer for temporal consistency (3 frames)
  const ocrWorkerRef = useRef(null);
  const [isPipActive, setIsPipActive] = useState(false);

  const [lastRating, setLastRating] = useState(null);
  const lastSaveTimeRef = useRef(0);
  const [ocrLog, setOcrLog] = useState('待機中');
  const [debugInfo, setDebugInfo] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);
  const [currentState, setCurrentState] = useState(STATES.IDLE);
  
  // 最新のステートをループ内で参照するための Ref
  const stateRef = useRef(currentState);
  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  const recordingRef = useRef(isRecording);
  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);

  // Refs for loop
  const slotsRef = useRef({ turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks });
  useEffect(() => { slotsRef.current = { turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks }; }, [turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks]);

  // OCRワーカーの参照
  const workersRef = useRef({ jpn: null, eng: null });

  // 初期化を startCapture 時に行うよう変更
  const initTesseract = async () => {
    if (workersRef.current.jpn) return; // 既に起動済みなら何もしない
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

  useEffect(() => {
    // Initialize OCR Worker for stable background timing
    try {
      ocrWorkerRef.current = new Worker(new URL('/ocrWorker.js', import.meta.url));
    } catch (e) {
      console.error("Worker initialization failed, falling back to main-thread timer (less stable in background):", e);
    }
    
    if (ocrWorkerRef.current) {
      ocrWorkerRef.current.onmessage = (e) => {
        if (e.data.type === 'tick' && isBusyRef.current === false && recordingRef.current) {
          isBusyRef.current = true;
          if (currentAnalyzeRef.current) {
            currentAnalyzeRef.current().finally(() => {
              isBusyRef.current = false;
            });
          }
        }
      };
    }

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (ocrWorkerRef.current) ocrWorkerRef.current.terminate();
      if (workersRef.current.jpn) workersRef.current.jpn.terminate();
      if (workersRef.current.eng) workersRef.current.eng.terminate();
    };
  }, []);

  useEffect(() => {
    if (isRecording && ocrWorkerRef.current) {
      // ステートに応じて待機時間を調整（CPU負荷軽減と応答速度のバランス）
      const curState = stateRef.current;
      let interval = 500; // 基本間隔
      if (curState === STATES.IN_MATCH) interval = 800; // 試合中は少し間隔を広げる
      if (curState === STATES.NEXT_MATCH_STANDBY) interval = 500;
      
      ocrWorkerRef.current.postMessage({ action: 'start', interval });
    } else if (ocrWorkerRef.current) {
      ocrWorkerRef.current.postMessage({ action: 'stop' });
    }
  }, [isRecording, currentState]);



  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  const resetSlots = useCallback(() => {
    setTurn(''); setIsTurnLocked(false);
    setResult(''); setIsResultLocked(false);
    setDiff(''); setRatingChange(''); setIsDiffLocked(false);
    setTurnScore(null); setResultScore(null);
    
    // Lockの状態に応じてリセット
    if (!isMyDeckLocked) setMyDecks([]);
    if (!isOpponentDeckLocked) setOppDecks([]);
    if (!isTagsLocked) setSelectedTags([]);
    
    stablePointsBufferRef.current = []; // Clear OCR buffer
    setCurrentState(STATES.DETECTING_TURN); // 次の試合の検知を自動開始
    setOcrLog("スロットリセット → 次の試合待機中");
  }, [isMyDeckLocked, isOpponentDeckLocked, isTagsLocked]);

  const saveMatch = useCallback(async (dataOverride = null) => {
    if (isProcessing) return;
    
    // クールタイム（二重送信防止: 2秒）
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) {
      console.warn("Save blocked by cool-down.");
      return;
    }

    const finalData = dataOverride || {
      mode, turn, result,
      myDeck: myDecks.join(', '),
      opponentDeck: oppDecks.join(', '),
      diff,
      memo: selectedTags.join(', ')
    };

    // Minimum requirement: Turn or Result must exist
    if (!finalData.turn && !finalData.result) return;

    setIsProcessing(true);
    lastSaveTimeRef.current = now;

    try {
      const res = await postData(finalData);
      if (res?.success) {
        if (finalData.result === 'VICTORY') { 
          setShowCelebration(true); 
          setTimeout(() => setShowCelebration(false), 3000); 
        }
        playNotificationSound('double');
        setLastRating(parseFloat(finalData.diff) || lastRating);
        resetSlots();
        onRecorded();
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [mode, turn, result, diff, myDecks, oppDecks, selectedTags, lastRating, onRecorded, resetSlots, isProcessing]);

  // --- 認識ロジック本体（キャプチャ＋OCRを逐次実行） ---
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

    const v = videoRef.current, c = canvasRef.current, ctx = c.getContext('2d');
    const vw = v.videoWidth, vh = v.videoHeight;
    const { isTurnLocked: tLock, isResultLocked: rLock, mode: curMode } = slotsRef.current;

    const triggerAutoSaveForNextMatch = async (curSlots) => {
      if (isProcessing || (!curSlots.turn && !curSlots.result)) return;
      
      const now = Date.now();
      if (now - lastSaveTimeRef.current < 2000) return;

      const finalData = {
        mode: curSlots.mode, turn: curSlots.turn, result: curSlots.result, diff: curSlots.diff,
        myDeck: curSlots.myDecks.join(', '),
        opponentDeck: curSlots.oppDecks.join(', '),
        memo: selectedTags.join(', ')
      };

      setIsProcessing(true);
      lastSaveTimeRef.current = now;
      
      try {
        const res = await postData(finalData);
        if (res?.success) {
          if (finalData.result === 'VICTORY') { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3000); }
          playNotificationSound('double');
          setLastRating(parseFloat(finalData.diff) || lastRating);
          resetSlots(); // 確実にリセットを呼ぶ
          onRecorded();
        }
      } catch (e) {
        console.error("Auto-save failed:", e);
      } finally {
        setIsProcessing(false);
      }
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
          const ocrCanvas = createBinarizedCanvas(bin, width, height, true);
          if (debugRoiCanvasRef.current && debugTemplateCanvasRef.current) {
            debugRoiCanvasRef.current.width = width;
            debugRoiCanvasRef.current.height = height;
            drawBinarizedToCanvas(bin, debugRoiCanvasRef.current.getContext('2d'), width, height);
            debugTemplateCanvasRef.current.width = width;
            debugTemplateCanvasRef.current.height = height;
            drawBinarizedToCanvas(bin, debugTemplateCanvasRef.current.getContext('2d'), width, height);
          }
          if (jpn) {
            const { data: { text, confidence } } = await jpn.recognize(ocrCanvas);
            const cleanText = text.replace(/\s+/g, '').slice(0, 15);
            setTurnScore(confidence / 100);
            setDebugInfo(`OCR(JPN): "${cleanText}" (Conf: ${confidence.toFixed(1)}%)`);

            const matchesTurnPhrase = fuzzyIncludes(cleanText, 'あなたが先攻です', 2) || fuzzyIncludes(cleanText, 'あなたが後攻です', 2);
            if (matchesTurnPhrase && confidence > 40) {
              let detectedTurn = null;
              if (cleanText.includes('先') && !cleanText.includes('後')) detectedTurn = '先';
              else if (cleanText.includes('後') && !cleanText.includes('先')) detectedTurn = '後';

              if (detectedTurn) {
                if (currentState === STATES.NEXT_MATCH_STANDBY) {
                  const cur = slotsRef.current;
                  if (cur.turn || cur.result) await triggerAutoSaveForNextMatch(cur);
                  
                  setResult(''); setIsResultLocked(false);
                  setDiff(''); setRatingChange(''); setIsDiffLocked(false);
                  setResultScore(null); setTurnScore(null);
                  setOcrLog(`自動保存＆ターン確定: ${detectedTurn}攻`);
                } else {
                  setOcrLog(`ターン確定: ${detectedTurn}攻`);
                }
                
                setTurn(detectedTurn); setIsTurnLocked(true);
                const nextState = STATES.IN_MATCH;
                setCurrentState(nextState);
                stateRef.current = nextState;
                playNotificationSound('single');
              }
            }
          }
        } else {
          setDebugInfo("TURN: Noise filtered (ignored)");
        }
      }
      else if (currentState === STATES.IN_MATCH || (currentState === STATES.DETECTING_RESULT && !rLock)) {
        setOcrLog("終了待機中...");
        const roi = ROIS.RESULT;
        const { bin, width, height, bbox } = normalizeContent(v, vw * roi.x, vh * roi.y, vw * roi.w, vh * roi.h, 300, 100, 180);
        detectedBboxRef.current = { ...bbox, roiName: 'RESULT' };

        if (width > 1 && height > 1) {
          const ocrCanvas = createBinarizedCanvas(bin, width, height, true);
          if (debugRoiCanvasRef.current && debugTemplateCanvasRef.current) {
            debugRoiCanvasRef.current.width = width;
            debugRoiCanvasRef.current.height = height;
            drawBinarizedToCanvas(bin, debugRoiCanvasRef.current.getContext('2d'), width, height);
            debugTemplateCanvasRef.current.width = width;
            debugTemplateCanvasRef.current.height = height;
            drawBinarizedToCanvas(bin, debugTemplateCanvasRef.current.getContext('2d'), width, height);
          }
          if (eng) {
            const { data: { text, confidence } } = await eng.recognize(ocrCanvas);
            const cleanText = text.toUpperCase().replace(/\s+/g, '').slice(0, 15);
            setResultScore(confidence / 100);
            setDebugInfo(`OCR(ENG): "${cleanText}" (Conf: ${confidence.toFixed(1)}%)`);

            const isVictory = fuzzyIncludes(cleanText, 'VICTORY', 2);
            const isDefeat = fuzzyIncludes(cleanText, 'DEFEAT', 2) || fuzzyIncludes(cleanText, 'LOSE', 1);
            if (isVictory && confidence > 50) {
              setResult('VICTORY'); setIsResultLocked(true);
              setOcrLog(`勝敗確定: VICTORY`);
              const nextState = curMode === 'ランク' ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING;
              setCurrentState(nextState);
              stateRef.current = nextState;
              playNotificationSound('single');
            } else if (isDefeat && confidence > 50) {
              setResult('DEFEAT'); setIsResultLocked(true);
              setOcrLog(`勝敗確定: DEFEAT`);
              const nextState = curMode === 'ランク' ? STATES.NEXT_MATCH_STANDBY : STATES.DETECTING_RATING;
              setCurrentState(nextState);
              stateRef.current = nextState;
              playNotificationSound('single');
            }
          }
        } else {
          setDebugInfo("RESULT: Noise filtered (ignored)");
        }
      }

      // --- RATING / DC デバッグ: 常時スキャン (オフ) ---
      if (currentState === STATES.DETECTING_RATING) {
        const ratingRoi = curMode === 'DC' ? ROIS.DC_POINTS : ROIS.RATING;
        const targetW = 300, targetH = 100;
        const id = getROIData(ctx, v, ratingRoi, targetW, targetH);

        if (debugRoiCanvasRef.current && debugTemplateCanvasRef.current) {
          debugRoiCanvasRef.current.width = targetW;
          debugRoiCanvasRef.current.height = targetH;
          const roiCtx = debugRoiCanvasRef.current.getContext('2d');
          roiCtx.putImageData(id, 0, 0);

          const { binarizeROI } = await import('../lib/visionEngine');
          const bin = binarizeROI(id, 200);
          debugTemplateCanvasRef.current.width = targetW;
          debugTemplateCanvasRef.current.height = targetH;
          drawBinarizedToCanvas(bin, debugTemplateCanvasRef.current.getContext('2d'), targetW, targetH);
        }

        // 実際の確定処理
        if (currentState === STATES.DETECTING_RATING && !isDiffLocked) {
          const { multiThresholdDetectRating } = await import('../lib/visionEngine');
          const multiRes = multiThresholdDetectRating(id);
          const detected = multiRes.result;

          if (detected && detected.length >= 4) {
            // Adding to buffer for 3-frame consistency
            const buffer = stablePointsBufferRef.current;
            buffer.push(detected);
            if (buffer.length > 3) buffer.shift();

            const isStable = buffer.length === 3 && buffer.every(v => v === detected);
            const statusMsg = `安定化中... (${buffer.length}/3)`;
            setOcrLog(isStable ? `ポイント確定!` : statusMsg);
            setDebugInfo(`OCR Consensus: "${detected}" | Votes: ${multiRes.votes} | Buffer: ${buffer.length}/3`);

            if (isStable) {
              const isDC = curMode === 'DC';
              const formatted = isDC ? detected.replace(/\./g, '') : (parseFloat(detected) / 100).toFixed(2);
              setDiff(formatted); setRatingChange(formatted); setIsDiffLocked(true);
              setOcrLog(`ポイント取得 (${isDC ? 'DC' : 'Rate'}): ${formatted}`);
              const nextState = STATES.NEXT_MATCH_STANDBY;
              setCurrentState(nextState);
              stateRef.current = nextState;
              playNotificationSound('single');
              stablePointsBufferRef.current = []; // Clear after success
            }
          } else {
            // Content not found or unreliable - clear buffer to be safe
            stablePointsBufferRef.current = [];
            setDebugInfo(`RATE: ${multiRes.debugLog || "Wait for stable image..."}`);
          }
        }
      }

      if (showRoiOverlay) {
        ctx.lineWidth = 1;
        Object.entries(ROIS).forEach(([name, roi]) => {
          ctx.strokeStyle = name === 'TURN' ? '#fbbf24' : name === 'RESULT' ? '#a78bfa' : '#3b82f6';
          ctx.strokeRect(roi.x * PREV_W, roi.y * PREV_H, roi.w * PREV_W, roi.h * PREV_H);
        });

        const dbbox = detectedBboxRef.current;
        if (dbbox) {
          const roi = ROIS[dbbox.roiName];
          const scaleX = PREV_W / vw;
          const scaleY = PREV_H / vh;
          const gx = (vw * roi.x + dbbox.x) * scaleX;
          const gy = (vh * roi.y + dbbox.y) * scaleY;
          const gw = dbbox.w * scaleX;
          const gh = dbbox.h * scaleY;

          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.strokeRect(gx, gy, gw, gh);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
          ctx.fillRect(gx, gy, gw, gh);
        }
      }
    } catch (err) { console.error(err); }
  }, [currentState, showRoiOverlay, saveMatch]);

  const currentAnalyzeRef = useRef(null);
  currentAnalyzeRef.current = captureAndAnalyze;

  const startCapture = async () => {
    try {
      playNotificationSound(); // 音声ロック解除用
      await initTesseract(); // 開始時に初期化
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: "never",
          frameRate: { ideal: 10, max: 15 },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }, 
        audio: false 
      });
      setStream(mediaStream);
      setIsRecording(true);
      const nextState = STATES.DETECTING_TURN;
      setCurrentState(nextState);
      stateRef.current = nextState;
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
      const video = videoRef.current;
      if (!video) return;

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        await video.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch (err) {
      console.error("PiP error:", err);
      alert("このブラウザはPiP（小窓表示）をサポートしていないか、現在利用できません。");
    }
  };

  // キーボードショートカットの実装 (関数の初期化後に配置)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toUpperCase();
      if (key === 'S') { e.preventDefault(); saveMatch(); }
      else if (key === 'R') { e.preventDefault(); resetSlots(); }
      else if (key === 'V') { e.preventDefault(); if (stream) stopRecording(); else startCapture(); }
      else if (key === 'M') { e.preventDefault(); setIsMyDeckLocked(prev => !prev); }
      else if (key === 'K') { e.preventDefault(); setIsOpponentDeckLocked(prev => !prev); }
      else if (key === 'T') { e.preventDefault(); setIsTagsLocked(prev => !prev); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stream, saveMatch, resetSlots, startCapture, stopRecording]);

  return (
    <div className="space-y-6">
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center bg-emerald-500/10 z-50">
          <div className="bg-zinc-900 border-2 border-emerald-500 p-10 rounded-3xl shadow-2xl animate-bounce text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mb-4 mx-auto" />
            <h2 className="text-3xl font-black text-emerald-400">Match Saved!</h2>
          </div>
        </div>
      )}

      {/* スロットステータス */}
      <div className="grid grid-cols-3 gap-2">
        {[{ label: 'TURN', val: turn, count: 1 }, { label: 'RESULT', val: result, count: 2 }, { label: 'POINTS', val: diff, count: 3 }].map((s) => (
          <div key={s.label} className={`p-2 rounded border bg-zinc-900/50 flex flex-col items-center justify-center transition-all ${s.val ? 'border-indigo-500/50' : 'border-zinc-800'}`}>
            <div className="text-[8px] text-zinc-500 font-black mb-1">{s.label}</div>
            <div className={`w-2 h-2 rounded-full ${s.val ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`} />
          </div>
        ))}
      </div>

      <div className="aspect-video bg-black border border-zinc-800 rounded-xl overflow-hidden relative shadow-inner">
        {stream ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" /> : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
            <MonitorUp className="w-10 h-10 mb-4 opacity-30" />
            <p className="text-sm font-medium">Capture Master Duel Window</p>
          </div>
        )}
        
        {/* Picture-in-Picture Button */}
        {isRecording && (
          <button 
            onClick={togglePip}
            className={`absolute bottom-4 right-4 z-30 p-2.5 rounded-full backdrop-blur-md border transition-all shadow-xl
              ${isPipActive ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-zinc-950/60 border-zinc-700 text-zinc-400 hover:text-white hover:border-indigo-500/50'}`}
            title="Picture in Picture (小窓表示)"
          >
            <Monitor className="w-5 h-5" />
          </button>
        )}
      </div>

      {stream && (
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2 mb-4">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Slot-Filling Engine
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={resetSlots} 
                className="text-[10px] px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                title="スロットをリセット [R]"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              <span className="text-xs px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full text-emerald-400 font-mono font-bold">{ocrLog}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-950 p-2 rounded border border-zinc-700 shadow-inner flex flex-col items-center justify-center min-h-[200px] relative">
              <canvas ref={canvasRef} className="max-w-full h-auto rounded border border-zinc-900" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => setShowRoiOverlay(!showRoiOverlay)} className="p-1.5 bg-zinc-900/80 rounded border border-zinc-700 text-zinc-400 hover:text-white transition">
                  {showRoiOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[8px] text-zinc-600 mt-2 uppercase font-mono tracking-tighter opacity-70">Vision Engine (State: {currentState})</p>
              {debugInfo && (
                <div className="mt-1 text-[9px] font-mono text-indigo-400 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 break-all leading-snug">
                  Info: <span className="text-zinc-300">{debugInfo}</span>
                </div>
              )}
              <div className="flex gap-4 mt-2 justify-center w-full">
                <div className="text-center w-1/2">
                  <div className="text-[9px] text-zinc-500 mb-0.5">Tesseract Canvas X</div>
                  <canvas ref={debugTemplateCanvasRef} width={200} height={60} className="w-full h-8 bg-black border border-emerald-500/30 rounded object-contain" />
                </div>
                <div className="text-center w-1/2">
                  <div className="text-[9px] text-zinc-500 mb-0.5">Captured ROI</div>
                  <canvas ref={debugRoiCanvasRef} width={200} height={60} className="w-full h-8 bg-black border border-rose-500/30 rounded object-contain" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setTurn(turn === '先' ? '後' : '先'); setIsTurnLocked(true); }}
                className={`p-4 rounded-xl border transition-all text-center relative group ${isTurnLocked ? 'bg-indigo-500/10 border-indigo-500' : 'bg-zinc-900/50 border-zinc-700'}`}
              >
                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Turn Slot</div>
                <div className={`text-xl font-black ${turn === '先' ? 'text-blue-400' : 'text-zinc-400'} flex items-center justify-center gap-2`}>
                  {turn || '--'} {isTurnLocked && <Lock className="w-4 h-4 text-indigo-400" />}
                </div>
                <div className={`mt-1 text-[8px] font-mono px-1.5 py-0.5 rounded ${turnScore !== null && turnScore > 0.5 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                  Conf: {turnScore !== null ? `${(turnScore * 100).toFixed(1)}%` : '--%'}
                </div>
              </button>
              <button
                onClick={() => { setResult(result === 'VICTORY' ? 'DEFEAT' : 'VICTORY'); setIsResultLocked(true); }}
                className={`p-4 rounded-xl border transition-all text-center relative group ${isResultLocked ? 'bg-emerald-500/10 border-emerald-500' : 'bg-zinc-900/50 border-zinc-700'}`}
              >
                <div className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Result Slot</div>
                <div className={`text-xl font-black ${result === 'VICTORY' ? 'text-emerald-400' : 'text-rose-400'} flex items-center justify-center gap-2`}>
                  {result || '--'} {isResultLocked && <Lock className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className={`mt-1 text-[8px] font-mono px-1.5 py-0.5 rounded ${resultScore !== null && resultScore > 0.5 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                  Conf: {resultScore !== null ? `${(resultScore * 100).toFixed(1)}%` : '--%'}
                </div>
              </button>
              <div className="bg-zinc-900/80 p-5 rounded-xl border border-zinc-700 text-center col-span-2 shadow-2xl relative overflow-hidden group">
                <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Points Slot</div>
                <div className="text-4xl font-black mt-2 text-indigo-400">{ratingChange || '--'}</div>
                {isDiffLocked && <Lock className="absolute top-2 right-2 w-4 h-4 text-zinc-600" />}
              </div>
              <button
                onClick={() => saveMatch()}
                disabled={isProcessing || !turn || !result}
                className="col-span-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg text-lg active:scale-[0.98]"
                title="記録を保存してリセット [S]"
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Submit Record
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {!isRecording ? (
          <button onClick={startCapture} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-xl font-bold transition-all shadow-lg text-xl flex items-center justify-center gap-3 active:scale-[0.98]" title="キャプチャを開始 [V]">
            <PlayCircle className="w-7 h-7" /> Launch Vision Flow
          </button>
        ) : (
          <button onClick={stopRecording} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-5 rounded-xl font-bold transition-all shadow-lg text-xl flex items-center justify-center gap-3 active:scale-[0.98]" title="キャプチャを停止 [V]">
            <Square className="w-7 h-7" /> Stop Flow
          </button>
        )}
      </div>

      <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-lg relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="ランク">Normal Ranked (No Points)</option>
              <option value="レート戦">Rating Match (Points Scan)</option>
              <option value="DC">DC / Event (Points Scan)</option>
            </select>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DeckSelect availableDecks={availableDecks} onChange={setMyDecks} selectedDecks={myDecks} placeholder="Select My Deck" />
              </div>
              <button 
                onClick={() => setIsMyDeckLocked(!isMyDeckLocked)}
                className={`p-2 rounded-lg border transition ${isMyDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700 hover:text-zinc-400"}`}
                title="自分のデッキを保持する [M]"
              >
                {isMyDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DeckSelect availableDecks={availableDecks} onChange={setOppDecks} selectedDecks={oppDecks} placeholder="Select Opponent Deck" />
              </div>
              <button 
                onClick={() => setIsOpponentDeckLocked(!isOpponentDeckLocked)}
                className={`p-2 rounded-lg border transition ${isOpponentDeckLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700 hover:text-zinc-400"}`}
                title="対戦相手のデッキを保持する [K]"
              >
                {isOpponentDeckLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DeckSelect availableDecks={availableTags} onChange={setSelectedTags} selectedDecks={selectedTags} placeholder="記録する要因 (プレミ, 事故等)" />
              </div>
              <button 
                onClick={() => setIsTagsLocked(!isTagsLocked)}
                className={`p-2 rounded-lg border transition ${isTagsLocked ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800 text-zinc-600 border-zinc-700 hover:text-zinc-400"}`}
                title="記載した要因を保持する [T]"
              >
                {isTagsLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-inner text-center">
              <label className="text-[10px] text-zinc-500 uppercase block mb-1">Manual Override Diff</label>
              <input type="text" value={diff} onChange={e => { setDiff(e.target.value); setIsDiffLocked(true); }} className="w-full bg-transparent text-3xl font-black text-zinc-100 outline-none text-center" placeholder="0.00" />
            </div>
            <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg flex items-center gap-3">
              <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
              <p className="text-[10px] text-zinc-500 leading-tight">
                AI fills slots automatically. Detection for next match will auto-save current data if slots are filled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
