import React from 'react';
import { Activity } from 'lucide-react';

const DetectionLogs = ({ ocrLogs }) => {
  return (
    <div className="mt-6 bg-zinc-950/60 border border-zinc-800/50 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[10px] custom-scrollbar shadow-inner">
      <h4 className="text-zinc-500 mb-3 uppercase font-black text-[9px] flex items-center gap-2 opacity-60">
        <Activity className="w-3 h-3" /> Console log
      </h4>
      <div className="space-y-1.5">
        {ocrLogs.map((log, i) => (
          <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-amber-400' : log.type === 'debug' ? 'text-zinc-600' : 'text-zinc-400'}`}>
            <span className="text-zinc-700 font-bold shrink-0">[{log.time}]</span>
            <span className="tracking-tight">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetectionLogs;
