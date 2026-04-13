import React, { useState } from 'react';
import { 
  X, HelpCircle, Monitor, Eye, EyeOff, Activity, 
  Gamepad2, Zap, Settings, Info, Keyboard, 
  AlertTriangle, CheckCircle2, ChevronRight,
  ExternalLink, MousePointer2, Play, TrendingUp, Trophy
} from 'lucide-react';

const ManualSection = ({ icon: Icon, title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={`border rounded-2xl transition-all duration-300 ${isOpen ? 'bg-zinc-900 shadow-xl border-indigo-500/30' : 'bg-zinc-950/40 border-zinc-800/50 hover:border-zinc-700'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl transition-all duration-300 ${isOpen ? 'bg-indigo-500 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`font-bold transition-colors ${isOpen ? 'text-white' : 'text-zinc-300'}`}>{title}</h3>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-zinc-600 transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-400' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="px-5 pb-6 text-sm text-zinc-400 leading-relaxed animate-in slide-in-from-top-2 duration-300">
          <div className="pl-[3.25rem] space-y-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default function UserManual({ onClose, onOpenSetup }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-6">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative border-t-indigo-500/50 border-t-2">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
              <HelpCircle className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">User Manual</h2>
              <p className="text-sm text-zinc-500 font-medium">MD Tracker の使い方とトラブルシューティング</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-zinc-800 rounded-full transition-all text-zinc-400 hover:text-white hover:rotate-90 duration-300"
          >
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-3xl flex flex-col items-center text-center group hover:bg-indigo-500/10 transition-colors">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-indigo-400" />
              </div>
              <h4 className="text-white font-bold mb-1">自動データ抽出</h4>
              <p className="text-[10px] text-zinc-500">画面共有から対戦状況を<br/>リアルタイムで解析</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl flex flex-col items-center text-center group hover:bg-emerald-500/10 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-white font-bold mb-1">GAS 連携</h4>
              <p className="text-[10px] text-zinc-500">Googleスプレッドシートへの<br/>自動保存機能を搭載</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-3xl flex flex-col items-center text-center group hover:bg-amber-500/10 transition-colors">
              <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="text-white font-bold mb-1">高度な統計</h4>
              <p className="text-[10px] text-zinc-500">勝率や要因分析など<br/>多彩な角度から集計</p>
            </div>
          </div>

          <div className="space-y-3">
            <ManualSection icon={Zap} title="基本の使い方" defaultOpen={true}>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black shrink-0 text-white">1</div>
                  <p><span className="text-zinc-200 font-bold">Launch Vision</span> をクリックし、Master Duelの画面共有を開始します。</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black shrink-0 text-white">2</div>
                  <p>対戦が始まると「先攻/後攻」を、終了時には「勝敗」と「レート変動」を自動検知します。</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black shrink-0 text-white">3</div>
                  <p><span className="text-emerald-400 font-bold">Submit Record</span> を押してデータを保存（ショートカット key: <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-white font-mono">S</span>）</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-black shrink-0 text-indigo-400 border border-indigo-500/30">Auto</div>
                  <p>保存を忘れても大丈夫です。次の試合のターン検知時に、前回のデータが残っている場合は<span className="text-indigo-400 font-bold">自動的に送信</span>されます。</p>
                </div>
              </div>
            </ManualSection>

            <ManualSection icon={Monitor} title="画像認識が失敗・停止する時は">
              <div className="space-y-6">
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>ブラウザの制限（タブの非アクティブ化）</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    ブラウザの仕様により、本アプリのタブが「背面」に回ると処理速度が極端に制限され、画像認識が停止します。
                  </p>
                  <div className="bg-zinc-950/50 p-3 rounded-xl border border-white/5 mt-2">
                    <p className="text-emerald-400 text-[10px] font-black uppercase mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> おすすめの回避策
                    </p>
                    <ul className="list-disc list-inside text-[11px] space-y-1">
                      <li>アプリを「別ウィンドウ」で開き、MDの横に配置する</li>
                      <li>「画面全体」または「ウィンドウ共有」を利用する</li>
                    </ul>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/80 space-y-2">
                    <h4 className="text-zinc-200 font-bold flex items-center gap-2 text-xs">
                      <EyeOff className="w-4 h-4 text-zinc-500" /> MDの最小化
                    </h4>
                    <p className="text-[11px]">
                      Master Duelを最小化するとOSから描画データが送られなくなります。画面は常に表示させてください。
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/80 space-y-2">
                    <h4 className="text-zinc-200 font-bold flex items-center gap-2 text-xs">
                      <MousePointer2 className="w-4 h-4 text-zinc-500" /> プレビューの消失
                    </h4>
                    <p className="text-[11px]">
                      プレビューが画面外に隠れると「ゴーストモード（透過追従）」になります。そのまま操作可能です。
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                  <h4 className="text-indigo-300 font-bold flex items-center gap-2 text-xs mb-2">
                    <Zap className="w-4 h-4" /> フリーズ検知アラート
                  </h4>
                  <p className="text-[11px]">
                    認識が停止すると「画像認識が停止しています」という警告が表示されます。また、6秒以上の停止で警告音でも通知します。
                  </p>
                </div>
              </div>
            </ManualSection>

            <ManualSection icon={Activity} title="ダッシュボードと分析の活用">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-zinc-200 font-bold flex items-center gap-2 text-xs">
                    <TrendingUp className="w-4 h-4 text-indigo-400" /> 3段階の階層フィルタ
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    膨大なデータから「今の課題」を見つけ出すための強力なフィルタリングシステムです。
                  </p>
                  <ul className="grid grid-cols-1 gap-2 mt-2">
                    <li className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex items-start gap-3">
                      <span className="text-indigo-400 font-black text-[10px] mt-0.5">L1</span>
                      <div className="text-[10px]">
                        <span className="text-zinc-300 font-bold">期間・モード</span><br/>
                        「過去30日のランク戦」など、全体の集計範囲を決めます。
                      </div>
                    </li>
                    <li className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex items-start gap-3">
                      <span className="text-indigo-400 font-black text-[10px] mt-0.5">L2</span>
                      <div className="text-[10px]">
                        <span className="text-zinc-300 font-bold">セット(連戦)指定</span><br/>
                        「直近の20戦」や「特定の連勝/連敗区間」を切り出して分析できます。
                      </div>
                    </li>
                    <li className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex items-start gap-3">
                      <span className="text-indigo-400 font-black text-[10px] mt-0.5">L3</span>
                      <div className="text-[10px]">
                        <span className="text-zinc-300 font-bold">詳細テーマ・タグ</span><br/>
                        L2で絞られた中から、特定のデッキや勝敗要因をさらに深掘りします。
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/80 space-y-2">
                    <h4 className="text-indigo-300 font-bold flex items-center gap-2 text-xs">
                      <Zap className="w-4 h-4" /> AI Insights
                    </h4>
                    <p className="text-[11px]">
                      現在のフィルタ条件に基づき、AIが勝率改善のための具体的なアドバイスを自動生成します。
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/80 space-y-2">
                    <h4 className="text-emerald-300 font-bold flex items-center gap-2 text-xs">
                      <Trophy className="w-4 h-4" /> Factor Analysis
                    </h4>
                    <p className="text-[11px]">
                      勝敗に直結したカードやプレイをタグ集計し、「なぜ勝てたのか/負けたのか」を可視化します。
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <h4 className="text-white font-bold flex items-center gap-2 text-xs mb-2">
                    <Gamepad2 className="w-4 h-4 text-indigo-400" /> Visuals & OBS 連携
                  </h4>
                  <p className="text-[11px] mb-3">各統計グラフを配信画面に表示するための機能です。</p>
                  <ul className="list-disc list-inside text-[10px] text-zinc-500 space-y-1">
                    <li><span className="text-zinc-300">Image Save</span>: グラフを画像(PNG)として保存し、SNS等で共有できます。</li>
                    <li><span className="text-zinc-300">Copy OBS URL</span>: ブラウザソース用のURLを発行します。フィルタ条件も維持されます。</li>
                  </ul>
                </div>
              </div>
            </ManualSection>

            <ManualSection icon={Settings} title="初期設定とGAS連携">
              <p>データを永久保存するには、Google Apps Script (GAS) の設定が必要です。</p>
              <button 
                onClick={onOpenSetup}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-lg"
              >
                <Settings className="w-4 h-4" /> GAS セットアップガイドを開く
              </button>
            </ManualSection>

            <ManualSection icon={Keyboard} title="便利なショートカットと機能">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase">Shortcuts</h4>
                  <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <span className="text-[11px]">保存 (Submit)</span>
                    <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-white text-xs">S</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <span className="text-[11px]">リセット</span>
                    <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-white text-xs">R</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                    <span className="text-[11px]">キャプチャ切替</span>
                    <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-white text-xs">V</kbd>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase">Special Features</h4>
                  <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-[10px] font-bold text-zinc-200">PiP モード</div>
                    <p className="text-[9px] text-zinc-500">プレビュー右下のアイコンで、別窓表示が可能です。</p>
                  </div>
                  <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-[10px] font-bold text-zinc-200">スロットロック</div>
                    <p className="text-[9px] text-zinc-500">鍵アイコンで、デッキ選択の自動リセットを防げます。</p>
                  </div>
                </div>
              </div>
            </ManualSection>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-zinc-800 bg-zinc-950/50 flex justify-center">
          <button 
            onClick={onClose}
            className="group px-12 py-4 bg-white hover:bg-indigo-50 text-black font-black rounded-2xl transition-all shadow-xl flex items-center gap-3 active:scale-95"
          >
            UNDERSTOOD!
          </button>
        </div>
      </div>
    </div>
  );
}
