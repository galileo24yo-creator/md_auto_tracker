import React, { useState } from 'react';
import { FileText, Copy, Check, ExternalLink, X, Settings2, Database, Globe, Play, Activity, EyeOff, Monitor } from 'lucide-react';

import gasCode from '../../backend/Code.gs?raw';

export default function SetupGuide({ onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(gasCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 px-6">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border-t-indigo-500/50 border-t-2">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
              <Settings2 className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">GAS Setup Guide</h2>
              <p className="text-sm text-zinc-500 font-medium">Google Apps Script を連携してデータベースを構築しましょう</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-zinc-800 rounded-full transition-all text-zinc-400 hover:text-white hover:rotate-90 duration-300"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
          
          {/* Introduction */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Database className="w-48 h-48 text-indigo-400" />
            </div>
            <p className="text-zinc-200 leading-relaxed text-lg relative z-10">
              このアプリは、対戦記録を <span className="text-white font-bold underline decoration-indigo-500/50 underline-offset-4">Google スプレッドシート</span> に自動で保存し、リアルタイムで集計します。<br />
              以下の手順に従って、Google アカウントにバックエンド・プログラムを導入してください。
            </p>
          </div>

          {/* Stepper Logic with visual cues */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Step 1 */}
            <div className="space-y-4 p-6 bg-zinc-950/40 rounded-2xl border border-zinc-800/50 hover:border-indigo-500/30 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg">1</div>
                <h3 className="text-xl font-bold text-white">スプレッドシートの作成</h3>
              </div>
              <div className="ml-14 space-y-4">
                <p className="text-zinc-400 text-sm leading-relaxed">
                  まずは、データを記録するための箱（スプレッドシート）を用意します。
                </p>
                <a 
                  href="https://sheets.new" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 rounded-xl text-xs font-bold transition-all border border-zinc-700 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Google Sheets を開く
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 p-6 bg-zinc-950/40 rounded-2xl border border-zinc-800/50 hover:border-indigo-500/30 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg">2</div>
                <h3 className="text-xl font-bold text-white">Apps Script を起動</h3>
              </div>
              <div className="ml-14">
                <p className="text-zinc-400 text-sm leading-relaxed">
                  上部のメニューバーから「<span className="text-zinc-200">拡張機能</span>」を選択し、「<span className="text-indigo-400 font-bold decoration-indigo-400 decoration-1 underline underline-offset-4">Apps Script</span>」をクリックします。
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 (Full Width) */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-indigo-400 shadow-lg">3</div>
              <h3 className="text-2xl font-bold text-white">ソースコードの導入</h3>
            </div>
            
            <div className="ml-14 space-y-6">
              <div className="p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">Live Code Snippet (Code.gs)</span>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-xl group/btn transform hover:-translate-y-0.5 active:translate-y-0 ${
                      copied 
                        ? "bg-emerald-500 text-white" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />}
                    {copied ? "COPIED TO CLIPBOARD!" : "CLICK TO COPY CODE"}
                  </button>
                </div>
                
                <div className="bg-zinc-950 rounded-xl border border-zinc-900 p-6 font-mono text-[12px] text-zinc-400 max-h-64 overflow-y-auto scrollbar-thin shadow-inner relative group/code">
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none group-hover/code:opacity-20 transition-opacity" />
                  <pre className="opacity-50 select-none pointer-events-none">
                    {gasCode.substring(0, 1000)}...
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* New Step 4: Run setupSheets (Highly Prominent) */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse">4</div>
              <h3 className="text-2xl font-black text-white">初期設定の実行 (重要)</h3>
            </div>
            
            <div className="ml-14 p-8 bg-amber-500/5 border border-amber-500/20 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all duration-700" />
              
              <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                <div className="flex-1 space-y-4">
                  <p className="text-zinc-200 leading-relaxed">
                    コードを保存したら、画面上部のツールバーにあるドロップダウンから <span className="text-amber-400 font-black px-2 py-0.5 bg-amber-500/10 rounded">setupSheets</span> を選択し、その左隣の「<span className="text-white font-bold">実行</span>」ボタンをクリックしてください。
                  </p>
                  <p className="text-zinc-400 text-sm">
                    これにより、スプレッドシートに必要な「対戦記録」シートと「設定」シートが自動的に作成されます。これを行わないと、アプリが正しく動作しません。
                  </p>
                </div>
                
                <div className="w-full md:w-64 p-4 bg-zinc-900/80 rounded-2xl border border-white/5 flex flex-col gap-3 shadow-2xl">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700">
                    <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    <span className="text-[10px] font-black text-zinc-300 uppercase underline decoration-emerald-500 decoration-2 underline-offset-4">Run (実行)</span>
                  </div>
                  <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-indigo-500/30 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-indigo-300">setupSheets</span>
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  </div>
                  <p className="text-[9px] text-zinc-500 text-center font-bold">※実行後に「承認」を求められたら許可してください</p>
                </div>
              </div>
            </div>
          </section>

          {/* Step 5 */}
          <section className="space-y-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-black text-indigo-400 shadow-lg">5</div>
              <h3 className="text-2xl font-bold text-white">ウェブアプリとして公開</h3>
            </div>
            
            <div className="ml-14 p-8 bg-gradient-to-r from-zinc-950/40 to-transparent rounded-3xl border border-zinc-800/30">
              <ul className="space-y-6 text-zinc-300 text-sm">
                <li className="flex items-start gap-4 group">
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">✓</div>
                  <p>右上の「<span className="text-white font-bold">新しいデプロイ</span>」をクリックします。</p>
                </li>
                <li className="flex items-start gap-4 group">
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">✓</div>
                  <p>種類を「<span className="text-white font-bold">ウェブアプリ</span>」に選択（歯車アイコン）。</p>
                </li>
                <li className="flex items-start gap-4 group">
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">✓</div>
                  <p>実行ユーザーを「自分」、アクセスできるユーザーを「全員」に設定。</p>
                </li>
                <li className="flex items-start gap-4 group">
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform text-indigo-400 font-bold">!</div>
                  <p className="text-zinc-100 font-medium">発行されたURLをアプリの Settings に貼り付けてください。</p>
                </li>
              </ul>
              <div className="mt-10 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Globe className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-emerald-400 font-black text-lg">You're Ready To Go!</h4>
                  <p className="text-emerald-300/60 text-sm">URLを設定すれば、管理が始まります。</p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex justify-center">
          <button 
            onClick={onClose}
            className="group px-12 py-4 bg-white hover:bg-indigo-50 text-black font-black rounded-2xl transition-all shadow-xl hover:shadow-indigo-500/20 flex items-center gap-3 active:scale-95"
          >
            UNDERSTOOD!
          </button>
        </div>
      </div>
    </div>
  );
}
