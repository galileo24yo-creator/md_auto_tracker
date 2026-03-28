import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MonitorUp, Square, Save, Loader2, Sparkles, ScanText, RotateCcw, ShieldCheck, AlertCircle, PlayCircle, Trophy, Activity, Lock, Eye, EyeOff } from 'lucide-react';
import DeckSelect from './DeckSelect';
import { postData } from '../lib/api';
import { fuzzyIncludes } from '../lib/utils';
import { createWorker } from 'tesseract.js';
import { ROIS, getROIData, STATES, detectRating, normalizeContent, drawBinarizedToCanvas, createBinarizedCanvas } from '../lib/visionEngine';

const TEMPLATES = {
  "0": { h: [32, 21, 18, 18, 18, 18, 23, 32], v: [28, 32, 14, 11, 11, 19, 32, 23] },
  "1": { h: [16, 10, 9, 9, 9, 9, 15, 24], v: [0, 1, 11, 22, 32, 21, 6, 0] },
  "2": { h: [32, 22, 15, 12, 24, 18, 14, 32], v: [17, 30, 22, 19, 20, 22, 29, 16] },
  "3": { h: [32, 17, 11, 22, 14, 14, 23, 31], v: [6, 23, 17, 18, 18, 23, 32, 19] },
  "4": { h: [13, 17, 18, 18, 18, 27, 32, 11], v: [10, 16, 19, 19, 18, 32, 32, 7] },
  "5": { h: [31, 10, 13, 32, 17, 15, 23, 30], v: [12, 32, 23, 19, 19, 22, 29, 12] },
  "6": { h: [32, 21, 12, 31, 30, 19, 21, 32], v: [28, 32, 25, 18, 18, 21, 32, 23] },
  "7": { h: [32, 18, 15, 10, 10, 10, 10, 10], v: [2, 13, 16, 17, 19, 19, 19, 12] },
  "8": { h: [32, 20, 18, 32, 30, 14, 19, 32], v: [28, 32, 18, 18, 18, 23, 32, 28] },
  "9": { h: [32, 17, 15, 32, 29, 18, 20, 32], v: [27, 32, 20, 17, 17, 21, 32, 22] },
};

export default function Recorder({ availableDecks, onRecorded }) {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('ランク');
  const [myDecks, setMyDecks] = useState([]);
  const [oppDecks, setOppDecks] = useState([]);

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

  const [lastRating, setLastRating] = useState(null);
  const [ocrLog, setOcrLog] = useState('待機中');
  const [debugInfo, setDebugInfo] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);
  const [currentState, setCurrentState] = useState(STATES.IDLE);

  // Refs for loop
  const slotsRef = useRef({ turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks });
  useEffect(() => { slotsRef.current = { turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks }; }, [turn, result, diff, mode, isTurnLocked, isResultLocked, myDecks, oppDecks]);

  // OCRワーカーは廃止

  // テンプレート画像をロード＆グレースケールバッファに変換
  const workersRef = useRef({ jpn: null, eng: null });
  useEffect(() => {
    let active = true;
    const initTesseract = async () => {
      try {
        setOcrLog('OCRワーカー起動中...');
        const jpnWorker = await createWorker('jpn');
        const engWorker = await createWorker('eng');
        // PSM 7 = 単一行テキストとして扱う（余計な文章認識を防ぎ、負荷を削減）
        await jpnWorker.setParameters({ tessedit_pageseg_mode: '7' });
        await engWorker.setParameters({ tessedit_pageseg_mode: '7' });
        if (active) {
          workersRef.current = { jpn: jpnWorker, eng: engWorker };
          setOcrLog('Vision Engine (OCR) 準備完了');
        } else {
          await jpnWorker.terminate();
          await engWorker.terminate();
        }
      } catch (e) {
        console.error(e);
        if (active) setOcrLog('OCRエラー');
      }
    };
    initTesseract();
    return () => {
      active = false;
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (workersRef.current.jpn) workersRef.current.jpn.terminate();
      if (workersRef.current.eng) workersRef.current.eng.terminate();
    };
  }, []);



  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  const resetSlots = useCallback(() => {
    setTurn(''); setIsTurnLocked(false);
    setResult(''); setIsResultLocked(false);
    setDiff(''); setRatingChange(''); setIsDiffLocked(false);
    setTurnScore(null); setResultScore(null);
    setCurrentState(STATES.DETECTING_TURN); // 次の試合の検知を自動開始
    setOcrLog("スロットリセット → 次の試合待機中");
  }, []);

  const saveMatch = useCallback(async (dataOverride = null) => {
    if (isProcessing) return;
    const finalData = dataOverride || {
      mode, turn, result,
      myDeck: myDecks.join(', '),
      opponentDeck: oppDecks.join(', '),
      diff
    };

    // Minimum requirement: Turn or Result must exist
    if (!finalData.turn && !finalData.result) return;

    setIsProcessing(true);
    const res = await postData(finalData);
    setIsProcessing(true); // keeps true until onRecorded finished

    if (res?.success) {
      if (finalData.result === 'VICTORY') { setShowCelebration(true); setTimeout(() => setShowCelebration(false), 3000); }
      setLastRating(parseFloat(finalData.diff) || lastRating);
      resetSlots();
      onRecorded();
    }
    setIsProcessing(false);
  }, [mode, turn, result, diff, myDecks, oppDecks, lastRating, onRecorded, resetSlots, isProcessing]);

  // --- 認識ロジック本体（キャプチャ＋OCRを逐次実行） ---
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;

    const v = videoRef.current, c = canvasRef.current, ctx = c.getContext('2d');
    const vw = v.videoWidth, vh = v.videoHeight;
    const { isTurnLocked: tLock, isResultLocked: rLock, mode: curMode } = slotsRef.current;

    const scheduleSaveMatch = (overrides) => {
      setTimeout(() => {
        const cur = slotsRef.current;
        saveMatch({
          mode: cur.mode, turn: cur.turn, result: cur.result, diff: cur.diff,
          myDeck: cur.myDecks.join(', '),
          opponentDeck: cur.oppDecks.join(', '),
          ...overrides
        });
      }, 2000);
    };

    const PREV_W = 320, PREV_H = 180;
    c.width = PREV_W; c.height = PREV_H;
    ctx.drawImage(v, 0, 0, vw, vh, 0, 0, PREV_W, PREV_H);

    const { jpn, eng } = workersRef.current;

    try {
      if (currentState === STATES.DETECTING_TURN && !tLock) {
        setOcrLog("ターン検知中...");
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
              if (cleanText.includes('先') && !cleanText.includes('後')) {
                setTurn('先'); setIsTurnLocked(true);
                setOcrLog(`ターン確定: 先攻`);
                setCurrentState(STATES.IN_MATCH);
              } else if (cleanText.includes('後') && !cleanText.includes('先')) {
                setTurn('後'); setIsTurnLocked(true);
                setOcrLog(`ターン確定: 後攻`);
                setCurrentState(STATES.IN_MATCH);
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
              if (curMode === 'ランク') { setCurrentState(STATES.RECORDING); scheduleSaveMatch({ result: 'VICTORY' }); } else { setCurrentState(STATES.DETECTING_RATING); }
            } else if (isDefeat && confidence > 50) {
              setResult('DEFEAT'); setIsResultLocked(true);
              setOcrLog(`勝敗確定: DEFEAT`);
              if (curMode === 'ランク') { setCurrentState(STATES.RECORDING); scheduleSaveMatch({ result: 'DEFEAT' }); } else { setCurrentState(STATES.DETECTING_RATING); }
            }
          }
        } else {
          setDebugInfo("RESULT: Noise filtered (ignored)");
        }
      }

      // --- RATING デバッグ: 常時スキャン ---
      {
        const ratingRoi = ROIS.RATING;
        const targetW = 300, targetH = 100;
        const id = getROIData(ctx, v, ROIS.RATING, targetW, targetH);

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

        const debugResult = detectRating(id, true);
        
        // デバッグキャンバスにコンポーネントのバウンディングボックスを描画
        if (debugRoiCanvasRef.current && debugResult.comps) {
          const dCtx = debugRoiCanvasRef.current.getContext('2d');
          const ox = debugResult.trimOffset?.x || 0;
          const oy = debugResult.trimOffset?.y || 0;
          const scaleX = targetW / id.width;
          const scaleY = targetH / id.height;
          
          for (const c of debugResult.comps) {
            // トリミングオフセットを加算して元画像座標に戻す
            const rx = (c.x + ox) * scaleX;
            const ry = (c.y + oy) * scaleY;
            const rw = c.w * scaleX;
            const rh = c.h * scaleY;
            
            dCtx.strokeStyle = c.accepted ? '#22c55e' : '#ef4444';
            dCtx.lineWidth = 2;
            dCtx.strokeRect(rx, ry, rw, rh);
            
            // マッチした文字とエラー値を表示
            dCtx.fillStyle = c.accepted ? '#22c55e' : '#ef4444';
            dCtx.font = 'bold 12px monospace';
            dCtx.fillText(`${c.bestMatch}(${c.error})`, rx, ry - 3);
          }
        }

        console.table(debugResult.comps);
        console.log(`[RATING] ${debugResult.debugLog} | 全comp: ${debugResult.allComps}, 有効: ${debugResult.validComps}, 中央値H: ${debugResult.medianH}`);
        
        const compSummary = (debugResult.comps || []).map(c => 
          `${c.bestMatch}(${c.error}${c.accepted ? '✓' : '✗'})`
        ).join(' ');
        setDebugInfo(`RATE: ${debugResult.debugLog} | ${compSummary}`);

        // 実際の確定処理はDETECTING_RATINGステート時のみ
        if (currentState === STATES.DETECTING_RATING && !isDiffLocked) {
          const detected = debugResult.result;
          if (detected && detected.length >= 4) {
            const formatted = (parseFloat(detected) / 100).toFixed(2);
            setDiff(formatted); setRatingChange(formatted); setIsDiffLocked(true);
            setOcrLog(`レート取得: ${formatted}`);
            setCurrentState(STATES.RECORDING);
            scheduleSaveMatch({ diff: formatted });
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

  useEffect(() => {
    if (!isRecording) return;
    let active = true;
    const loop = async () => {
      while (active) {
        if (currentAnalyzeRef.current) await currentAnalyzeRef.current();
        await new Promise(r => setTimeout(r, 50));
      }
    };
    loop();
    return () => { active = false; };
  }, [isRecording]);

  const startCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "never" }, audio: false });
      setStream(mediaStream);
      setIsRecording(true);
      setCurrentState(STATES.DETECTING_TURN); // まずはターン検知から開始
      mediaStream.getVideoTracks()[0].onended = () => stopCapture();
    } catch (err) { setOcrLog("キャプチャ失敗"); }
  };

  const stopCapture = () => {
    if (intervalRef.current) clearTimeout(intervalRef.current);
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null); setIsRecording(false);
    isBusyRef.current = false;
  };

  return (
    <div className="space-y-6">
      {showCelebration && (
        <div className="fixed inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm z-50">
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
      </div>

      {stream && (
        <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2 mb-4">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Slot-Filling Engine
            </h3>
            <div className="flex gap-2">
              <button onClick={resetSlots} className="text-[10px] px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-400 hover:text-white flex items-center gap-1">
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
                className="col-span-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg text-lg"
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />} Submit Record
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {!isRecording ? (
          <button onClick={startCapture} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-xl font-bold transition-all shadow-lg text-xl flex items-center justify-center gap-3">
            <PlayCircle className="w-7 h-7" /> Launch Vision Flow
          </button>
        ) : (
          <button onClick={stopCapture} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-5 rounded-xl font-bold transition-all shadow-lg text-xl flex items-center justify-center gap-3">
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
            <DeckSelect availableDecks={availableDecks} onChange={setMyDecks} selectedDecks={myDecks} placeholder="Select My Deck" />
            <DeckSelect availableDecks={availableDecks} onChange={setOppDecks} selectedDecks={oppDecks} placeholder="Select Opponent Deck" />
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
