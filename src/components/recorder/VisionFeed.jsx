import React from 'react';
import { MonitorUp, Monitor, Eye, EyeOff, Activity } from 'lucide-react';

const VisionFeed = ({ 
  videoRef, 
  canvasRef, 
  stream, 
  isRecording, 
  isScanning, 
  captureStatus, 
  isSticky, 
  togglePip, 
  showRoiOverlay, 
  setShowRoiOverlay,
  currentCard
}) => {
  return (
    <div
      className={`aspect-video rounded-3xl overflow-hidden relative transition-all duration-500 shadow-2xl ${
        isSticky
          ? captureStatus === 'FROZEN'
            ? 'sticky top-4 z-40 bg-zinc-950/90 border border-rose-500/50 backdrop-blur-xl'
            : 'sticky top-4 z-0 opacity-0 pointer-events-none'
          : 'bg-zinc-950/80 border border-white/5 z-10 opacity-100 backdrop-blur-md ring-1 ring-white/5'
      }`}
    >
      {isRecording && (
        <div className="absolute top-5 left-5 z-[45] flex items-center gap-2">
          {isScanning ? (
            <div className="flex items-center gap-2 bg-indigo-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-xl shadow-indigo-500/40 animate-pulse uppercase tracking-widest">
              <span className="status-dot bg-white animate-ping" />
              Live Scanning
            </div>
          ) : (
            <div className="bg-zinc-950/80 text-zinc-500 text-[10px] font-black px-3 py-1 rounded-full border border-zinc-800 uppercase tracking-widest">
              Vision Standby
            </div>
          )}
        </div>
      )}

      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
          <MonitorUp className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest opacity-40">Awaiting Video Input</p>
        </div>
      )}

      {isRecording && captureStatus === 'FROZEN' && (
        <div className="absolute inset-0 z-30 bg-rose-950/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <Activity className="w-12 h-12 text-rose-400 mb-4 animate-pulse opacity-50" />
          <div className="text-white font-black text-xl uppercase tracking-tighter">Recognition Halted</div>
          <p className="text-xs text-rose-200/60 font-bold mt-2 uppercase">Input Stream Static</p>
        </div>
      )}

      {isRecording && (
        <button 
          onClick={togglePip} 
          className="absolute bottom-5 right-5 p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white transition-all z-40 active:scale-90"
        >
          <Monitor className="w-5 h-5" />
        </button>
      )}

      {/* Internal Debug Canvas Overlay (Hidden) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VisionFeed;
