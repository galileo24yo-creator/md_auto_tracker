import React, { useRef, useEffect, useCallback } from 'react';
import { MonitorUp, Square, Loader2, Activity, RotateCcw } from 'lucide-react';
import { STATES } from '../lib/visionEngine';
import { postData } from '../lib/api';
import { playNotificationSound } from '../lib/recorderUtils';
import { normalizeTheme } from '../lib/themeUtils';

// Sub-components
import VisionFeed from './recorder/VisionFeed';
import AnalysisMonitor from './recorder/AnalysisMonitor';
import ActionSlots from './recorder/ActionSlots';
import MatchSettings from './recorder/MatchSettings';
import DetectionLogs from './recorder/DetectionLogs';
import CardDatabase from './recorder/CardDatabase';

// Hooks
import { useRecorderState } from '../hooks/useRecorderState';
import { useOcrEngine } from '../hooks/useOcrEngine';
import { useMatchAutofill } from '../hooks/useMatchAutofill';

export default function Recorder({ themePairings, availableDecks, availableTags, onRecorded, onOpenManual }) {
  // 1. Centralized State
  const {
    mode, setMode,
    myDecks, setMyDecks,
    oppDecks, setOppDecks,
    selectedTags, setSelectedTags,
    isMyDeckLocked, setIsMyDeckLocked,
    isOpponentDeckLocked, setIsOpponentDeckLocked,
    isTagsLocked, setIsTagsLocked,
    turn, setTurn,
    result, setResult,
    diff, setDiff,
    ratingChange, setRatingChange,
    turnScore, setTurnScore,
    resultScore, setResultScore,
    isTurnLocked, setIsTurnLocked,
    isResultLocked, setIsResultLocked,
    isDiffLocked, setIsDiffLocked,
    currentState, setCurrentState,
    gotoState,
    detectedCards, setDetectedCards,
    currentCard, setCurrentCard,
    stateRef,
    slotsRef
  } = useRecorderState();

  const [stream, setStream] = React.useState(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [ocrLogs, setOcrLogs] = React.useState([{ 
    time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
    msg: '待機中', 
    type: 'info' 
  }]);

  const addLog = useCallback((msg, type = 'info') => {
    setOcrLogs(prev => {
      if (prev.length > 0 && prev[0].msg === msg) return prev;
      const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newLogs = [{ time, msg, type }, ...prev];
      if (newLogs.length > 50) newLogs.pop();
      return newLogs;
    });
  }, []);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stickyRef = useRef(null);
  const [isSticky, setIsSticky] = React.useState(false);
  const [lastRating, setLastRating] = React.useState(null);
  const lastSaveTimeRef = useRef(0);
  const matchStartTimeRef = useRef(null);
  const detectedCardsRef = useRef([]);
  const statusTemplatesRef = useRef({});

  // Sync state to ref for match-end analysis
  useEffect(() => { detectedCardsRef.current = detectedCards; }, [detectedCards]);

  // Load Templates
  useEffect(() => {
    const loadStatusTemplates = async () => {
      const { extractSequenceFeatures } = await import('../lib/visionEngine');
      const templates = {};
      const urls = { victory: '/templates/victory.png', lose: '/templates/lose.png' };
      for (const [key, url] of Object.entries(urls)) {
        try {
          const img = new Image(); img.src = url;
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
          const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const { features } = extractSequenceFeatures(ctx.getImageData(0, 0, img.width, img.height), 0, -9.0);
          templates[key] = features;
        } catch (e) {}
      }
      statusTemplatesRef.current = templates;
    };
    loadStatusTemplates();
  }, []);

  const resetSlots = useCallback(() => {
    setTurn(''); setIsTurnLocked(false);
    setResult(''); setIsResultLocked(false);
    setDiff(''); setRatingChange(''); setIsDiffLocked(false);
    setTurnScore(null); setResultScore(null);
    if (!isMyDeckLocked) setMyDecks([]);
    if (!isOpponentDeckLocked) setOppDecks([]);
    if (!isTagsLocked) setSelectedTags([]);
    gotoState(STATES.DETECTING_TURN);
    matchStartTimeRef.current = null;
    setDetectedCards([]);
    setCurrentCard({ name: '', archetype: '', confidence: 0, votes: 0 });
    addLog("スロットリセット → 次の試合待機中", 'info');
  }, [isMyDeckLocked, isOpponentDeckLocked, isTagsLocked, addLog, setTurn, setIsTurnLocked, setResult, setIsResultLocked, setDiff, setRatingChange, setIsDiffLocked, setTurnScore, setResultScore, setMyDecks, setOppDecks, setSelectedTags, gotoState, setDetectedCards, setCurrentCard]);

  const saveMatch = useCallback(async () => {
    if (isProcessing) return;
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2000) return;
    const finalData = {
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
  }, [mode, turn, result, diff, myDecks, oppDecks, selectedTags, lastRating, onRecorded, resetSlots, isProcessing, addLog, setLastRating]);

  // 2. OCR Engine Hook
  const {
    isScanning,
    captureStatus,
    showRoiOverlay,
    setShowRoiOverlay,
    initTesseract,
    captureAndAnalyze,
    lastUpdateRef,
    isBusyRef,
    rvfcIdRef,
    ocrWorkerRef
  } = useOcrEngine({
    recordingRef: { current: isRecording },
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
    gotoState,
    resetSlots,
    postData,
    isProcessing,
    setIsProcessing,
    lastSaveTimeRef,
    matchStartTimeRef,
    lastRating,
    setLastRating,
    setShowCelebration,
    selectedTags,
    onRecordedCallback: onRecorded
  });

  // 3. Autofill Hook
  useMatchAutofill({
    detectedCards,
    isMyDeckLocked,
    isOpponentDeckLocked,
    isTagsLocked,
    availableTags,
    availableDecks,
    themePairings: themePairings,
    myDecks,
    oppDecks,
    setMyDecks,
    setOppDecks,
    setSelectedTags,
    result,
    addLog,
    playNotificationSound,
    matchStartTimeRef,
    detectedCardsRef
  });

  // --- Capture Lifecycle ---
  const stopRecording = useCallback(() => { 
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); } 
    setIsRecording(false); 
  }, [stream]);

  const startCapture = useCallback(async () => {
    try {
      playNotificationSound(); 
      await initTesseract();
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "never", frameRate: { ideal: 10, max: 15 }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }, 
        audio: false 
      });
      lastUpdateRef.current = Date.now();
      setStream(mediaStream);
      setIsRecording(true);
      setCurrentState(STATES.DETECTING_TURN); 
      stateRef.current = STATES.DETECTING_TURN;
      mediaStream.getVideoTracks()[0].onended = () => stopRecording();
    } catch (err) { console.error(err); addLog("キャプチャ失敗", 'error'); }
  }, [initTesseract, stopRecording, addLog, lastUpdateRef, setCurrentState, stateRef]);

  // Handle Analysis Loop
  useEffect(() => {
    if (isRecording && videoRef.current) {
      const loop = () => {
        if (!isRecording || !videoRef.current) return;
        const now = Date.now();
        if (now - lastUpdateRef.current > 500 && !isBusyRef.current) {
           isBusyRef.current = true;
           captureAndAnalyze(videoRef, canvasRef).finally(() => { isBusyRef.current = false; });
           lastUpdateRef.current = now;
        }
        if (videoRef.current) {
          rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
        }
      };
      if (videoRef.current) {
        rvfcIdRef.current = videoRef.current.requestVideoFrameCallback(loop);
      }
      return () => { if (videoRef.current && rvfcIdRef.current) videoRef.current.cancelVideoFrameCallback(rvfcIdRef.current); };
    }
  }, [isRecording, captureAndAnalyze, lastUpdateRef, isBusyRef, rvfcIdRef]);

  useEffect(() => { if (stream && videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  // Keyboard Shortcuts
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

  // Intersection Observer for Sticky
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { 
      setIsSticky(!entry.isIntersecting); 
    }, { threshold: 0 });
    if (stickyRef.current) observer.observe(stickyRef.current);
    return () => observer.disconnect();
  }, []);

  const handleCardClick = useCallback((card) => {
    if (!card.archetype) return;
    const theme = normalizeTheme(themeMapRef.current[card.archetype] || card.archetype);
    if (card.side === 'BLUE' && !isMyDeckLocked) {
      setMyDecks(prev => prev.includes(theme) ? prev : [...prev, theme]);
      addLog(`テーマ追加: ${theme} (味方)`, 'success');
      playNotificationSound('restore');
    } else if (card.side === 'RED' && !isOpponentDeckLocked) {
      setOppDecks(prev => prev.includes(theme) ? prev : [...prev, theme]);
      addLog(`テーマ追加: ${theme} (相手)`, 'success');
      playNotificationSound('restore');
    }
  }, [isMyDeckLocked, isOpponentDeckLocked, addLog, setMyDecks, setOppDecks]);

  return (
    <div className="space-y-6">
      {showCelebration && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="glass-card border-emerald-500/40 p-6 shadow-emerald-500/20 shadow-2xl animate-bounce text-center">
            <span className="text-xl font-black text-emerald-400 uppercase tracking-widest">Match Recorded</span>
          </div>
        </div>
      )}

      {/* Summary Status Badges */}
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'TURN', val: turn }, { label: 'RESULT', val: result }, { label: 'POINTS', val: diff }].map((s) => (
          <div key={s.label} className="py-2 px-3 glass-card bg-zinc-950/20 border-zinc-800/50 flex flex-col items-center justify-center">
            <div className="text-[9px] text-zinc-500 font-black mb-1.5 uppercase tracking-tighter">{s.label}</div>
            <div className={`w-1.5 h-1.5 rounded-full ${s.val ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-zinc-800'}`} />
          </div>
        ))}
      </div>

      <div ref={stickyRef} className="h-[1px] w-full bg-transparent" />
      
      {/* Video Feed Component */}
      <VisionFeed 
        videoRef={videoRef}
        canvasRef={canvasRef}
        stream={stream}
        isRecording={isRecording}
        isScanning={isScanning}
        captureStatus={captureStatus}
        isSticky={isSticky}
        togglePip={() => videoRef.current?.requestPictureInPicture()}
        showRoiOverlay={showRoiOverlay}
        setShowRoiOverlay={setShowRoiOverlay}
        currentCard={currentCard}
      />

      {stream && (
        <div className="glass-card p-6 border-zinc-500/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> 
              Real-time recognition
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalysisMonitor 
              canvasRef={canvasRef}
              showRoiOverlay={showRoiOverlay}
              setShowRoiOverlay={setShowRoiOverlay}
              currentCard={currentCard}
            />

            <ActionSlots 
              turn={turn}
              result={result}
              diff={diff}
              mode={mode}
              isProcessing={isProcessing}
              setTurn={setTurn}
              setResult={setResult}
              setDiff={setDiff}
              setIsTurnLocked={setIsTurnLocked}
              setIsResultLocked={setIsResultLocked}
              setIsDiffLocked={setIsDiffLocked}
              setRatingChange={setRatingChange}
              saveMatch={saveMatch}
              resetSlots={resetSlots}
              addLog={addLog}
              currentState={currentState}
              setCurrentState={setCurrentState}
              stateRef={stateRef}
              STATES={STATES}
            />
          </div>

          <DetectionLogs ocrLogs={ocrLogs} />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-4">
        {!isRecording ? (
          <button 
            onClick={startCapture} 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-500/30 ring-1 ring-white/10 active:scale-95"
          >
            <MonitorUp className="w-8 h-8" /> 
            Launch Vision
          </button>
        ) : (
          <button 
            onClick={stopRecording} 
            className="flex-1 bg-zinc-950 border border-zinc-800/50 text-rose-500 hover:text-rose-400 py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-2xl active:scale-95"
          >
            <Square className="w-8 h-8" /> 
            Kill Process
          </button>
        )}
      </div>

      {/* Settings Form */}
      <MatchSettings 
        mode={mode}
        setMode={setMode}
        availableDecks={availableDecks}
        availableTags={availableTags}
        myDecks={myDecks}
        setMyDecks={setMyDecks}
        isMyDeckLocked={isMyDeckLocked}
        setIsMyDeckLocked={setIsMyDeckLocked}
        oppDecks={oppDecks}
        setOppDecks={setOppDecks}
        isOpponentDeckLocked={isOpponentDeckLocked}
        setIsOpponentDeckLocked={setIsOpponentDeckLocked}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        isTagsLocked={isTagsLocked}
        setIsTagsLocked={setIsTagsLocked}
        setIsInputActive={() => {}} 
      />

      {/* Card Database View */}
      <CardDatabase 
        detectedCards={detectedCards}
        handleCardClick={handleCardClick}
      />
    </div>
  );
}
