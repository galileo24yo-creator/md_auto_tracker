import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, Settings, X, Save, HelpCircle, Database, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { fetchData, getGasUrl, getProfiles, getActiveProfile, saveProfiles } from './lib/api';
import { decodeHTMLEntities } from './lib/utils';
import { normalizeTheme } from './lib/themeUtils';
import Dashboard from './components/Dashboard';
import Recorder from './components/Recorder';
import SetupGuide from './components/SetupGuide';
import UserManual from './components/UserManual';
import VisualBoard from './components/VisualBoard';
import './App.css';

function App() {
  const [data, setData] = useState({ records: [], decks: [], reasons: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // 表示モードの判定 (?view=obs)
  const query = new URLSearchParams(window.location.search);
  const isObsMode = query.get('view') === 'obs';
  
  // Profiles State
  const [profiles, setProfiles] = useState(getProfiles());
  const [activeProfile, setActiveProfile] = useState(getActiveProfile());
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editSheetUrl, setEditSheetUrl] = useState('');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    const result = await fetchData();
    
    if (result.success) {
      // Decode entities and PRE-NORMALIZE for ultimate performance
      const decodedRecords = (result.records || []).map(r => {
        const myDeck = decodeHTMLEntities(r.myDeck || "");
        const oppDeck = decodeHTMLEntities(r.opponentDeck || "");
        const resultStr = String(r.result || "").toUpperCase();
        
        // 事前計算（高速化用フラグ）
        const isWin = resultStr.includes('VIC') || resultStr === 'WIN';
        const isFirst = String(r.turn || "").includes('先');
        
        return {
          ...r,
          myDeck,
          opponentDeck: oppDeck,
          memo: decodeHTMLEntities(r.memo || ""),
          _isWin: isWin,
          _isFirst: isFirst,
          // 事前パース済みのタグ配列
          _tags: (decodeHTMLEntities(r.memo || "")).split(/[,、，]+/).map(t => t.trim()).filter(Boolean),
          // 高速フィルター用配列
          _myThemes: myDeck.split(/[,、，\+]+/).map(t => normalizeTheme(t)).filter(Boolean),
          _oppThemes: oppDeck.split(/[,、，\+]+/).map(t => normalizeTheme(t)).filter(Boolean)
        };
      });
      const decodedDecks = (result.decks || []).map(d => decodeHTMLEntities(d));
      const decodedReasons = (result.reasons || []).map(r => decodeHTMLEntities(r));

      setData({
        records: decodedRecords,
        decks: decodedDecks,
        reasons: decodedReasons
      });
      setLastUpdated(new Date());
    } else {
      setError(result.error || "Failed to load data from GAS.");
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const handleAddProfile = () => {
    const newProfile = { id: Date.now().toString(), name: 'New Profile', url: '' };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    saveProfiles(updated, activeProfile?.id);
    startEditing(newProfile);
  };

  const startEditing = (p) => {
    setEditingProfileId(p.id);
    setEditName(p.name);
    setEditUrl(p.url);
    setEditSheetUrl(p.sheetUrl || '');
  };

  const handleSaveProfile = () => {
    const updated = profiles.map(p => 
      p.id === editingProfileId ? { ...p, name: editName, url: editUrl, sheetUrl: editSheetUrl } : p
    );
    setProfiles(updated);
    saveProfiles(updated, activeProfile?.id);
    
    // If the saved profile is the active one, update activeProfile state too
    if (activeProfile?.id === editingProfileId) {
      setActiveProfile(updated.find(p => p.id === editingProfileId));
    }
    
    setEditingProfileId(null);
  };

  const handleDeleteProfile = (id) => {
    if (!window.confirm("この設定を削除しますか？")) return;
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    
    let nextActiveId = activeProfile?.id;
    if (activeProfile?.id === id) {
      nextActiveId = updated.length > 0 ? updated[0].id : null;
      setActiveProfile(updated.length > 0 ? updated[0] : null);
    }
    saveProfiles(updated, nextActiveId);
  };

  const handleSwitchProfile = (p) => {
    setActiveProfile(p);
    saveProfiles(profiles, p.id);
    setShowSettings(false);
    loadData(true);
  };

  useEffect(() => {
    // Initial profile migration if necessary
    const legacyUrl = localStorage.getItem('md_gas_url');
    if (legacyUrl && profiles.length === 0) {
      const initialProfile = { id: 'default', name: 'Default Profile', url: legacyUrl };
      const initialList = [initialProfile];
      setProfiles(initialList);
      setActiveProfile(initialProfile);
      saveProfiles(initialList, 'default');
      localStorage.removeItem('md_gas_url');
    }
    loadData();
  }, []);

  const displayReasons = useMemo(() => {
    const list = [];
    (data.reasons || []).forEach(r => {
      // 符号([+] or [-])と本体を分離
      const match = r.match(/^(\[[+-]\])\s*(.*)/);
      
      if (match) {
        const trait = match[1];
        const base = match[2];
        const invertedTrait = trait === '[+]' ? '[-]' : '[+]';

        list.push(`${trait} 自：${base}`);
        list.push(`${invertedTrait} 敵：${base}`);
      } else {
        // 符号がない場合は従来通り（ただしデフォルト不利扱い）
        list.push(`自：${r}`);
        list.push(`敵：${r}`);
      }
    });
    return list;
  }, [data.reasons]);

  // 【最適化】履歴からテーマの組み合わせ（共起）情報を抽出
  const themePairings = useMemo(() => {
    if (!data.records || data.records.length === 0) return new Map();
    const map = new Map();
    const recentRecords = data.records.slice(-100);
    
    recentRecords.forEach(r => {
      ['myDeck', 'opponentDeck'].forEach(key => {
        const deckStr = r[key];
        if (!deckStr) return;
        const themes = deckStr.split(/[,、，\+]+/)
          .map(t => normalizeTheme(t))
          .filter(Boolean);
        if (themes.length >= 2) {
          for (let i = 0; i < themes.length; i++) {
            for (let j = 0; j < themes.length; j++) {
              if (i === j) continue;
              const t1 = themes[i];
              const t2 = themes[j];
              if (!map.has(t1)) map.set(t1, new Set());
              map.get(t1).add(t2);
            }
          }
        }
      });
    });
    return map;
  }, [data.records]);

  // 子コンポーネントをメモ化して、Dashboardのフィルタ操作がRecorderに波及しないようにする
  const MemoizedRecorder = useMemo(() => (
    <Recorder 
      themePairings={themePairings}
      availableDecks={data.decks} 
      availableTags={displayReasons} 
      onRecorded={() => loadData(true)} 
      onOpenManual={() => setShowUserManual(true)}
    />
  ), [themePairings, data.decks, displayReasons]);

  const MemoizedDashboard = useMemo(() => (
    <Dashboard 
      records={data.records} 
      onRefresh={() => loadData(true)} 
      decks={data.decks}
      reasons={data.reasons}
      displayReasons={displayReasons}
      activeProfile={activeProfile}
    />
  ), [data.records, data.decks, data.reasons, displayReasons, activeProfile]);

  useEffect(() => {
    if (isObsMode) {
      document.body.classList.add('is-obs-mode');
    } else {
      document.body.classList.remove('is-obs-mode');
    }
    return () => document.body.classList.remove('is-obs-mode');
  }, [isObsMode]);

  // OBS用の自動更新ポーリング
  useEffect(() => {
    if (!isObsMode) return;
    
    // URLパラメータから間隔を取得（デフォルト30秒）
    const intervalSeconds = parseInt(query.get('interval') || '30', 10);
    const intervalMs = Math.max(intervalSeconds, 5) * 1000; // 最低5秒
    
    const timer = setInterval(() => {
      loadData(true);
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [isObsMode]);

  if (isObsMode) {
    return (
      <div className="min-h-screen bg-transparent">
        {loading ? (
          <div className="h-screen flex items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <VisualBoard 
            records={data.records} 
            displayReasons={displayReasons} 
            lastUpdated={lastUpdated}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 md:px-10">
      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-zinc-500/10">
        <div>
          <h1 className="text-3xl tracking-tighter text-premium">
            MD Tracker
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-70">Automated Match Analytics</p>
            {activeProfile && (
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-black rounded-md uppercase">
                {activeProfile.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowUserManual(true)}
            className="p-2.5 rounded-xl border bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
            title="User Manual"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl border transition-all ${showSettings ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-white"}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Fresh Data"}
          </button>
        </div>
      </header>
      
      {showSettings && (
        <div className="max-w-[1600px] mx-auto mb-8 animate-in slide-in-from-top-4 duration-300">
          <div className="glass-card p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                Connection Profiles
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSetupGuide(true)}
                  className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Setup Guide
                </button>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map(p => (
                  <div 
                    key={p.id} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${activeProfile?.id === p.id ? 'bg-indigo-500/5 border-indigo-500/50' : 'bg-zinc-950/30 border-zinc-800/50 hover:border-zinc-700'}`}
                    onClick={() => editingProfileId !== p.id && handleSwitchProfile(p)}
                  >
                    {editingProfileId === p.id ? (
                      <div className="space-y-3" onClick={e => e.stopPropagation()}>
                        <input 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Profile Name"
                        />
                        <input 
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="GAS WebApp URL"
                        />
                        <input 
                          value={editSheetUrl}
                          onChange={e => setEditSheetUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Spreadsheet URL (Optional)"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveProfile} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            Save Changes
                          </button>
                          <button onClick={() => setEditingProfileId(null)} className="flex-1 bg-zinc-800 text-zinc-400 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-xs text-zinc-200 uppercase tracking-tight">{p.name}</span>
                          {activeProfile?.id === p.id && (
                            <div className="flex items-center gap-1.5">
                              <span className="status-dot bg-indigo-400 animate-pulse" />
                              <span className="text-[8px] text-indigo-400 font-black uppercase tracking-widest">Active</span>
                            </div>
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono truncate mb-3 opacity-60">{p.url || 'URL not set'}</div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-2 rounded-lg transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-2 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button 
                  onClick={handleAddProfile}
                  className="p-4 rounded-xl border border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-zinc-500 hover:text-indigo-400 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <Plus className="w-6 h-6 group-hover:scale-110 transition-all" />
                  <span className="text-[10px] font-black uppercase tracking-widest">New Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-2 xl:sticky xl:top-6 self-start z-20">
          {MemoizedRecorder}
        </div>

        <div className="xl:col-span-3">
          <div className="glass-card p-6 shadow-2xl min-h-[600px]">
            {loading ? (
              <div className="h-[500px] flex flex-col items-center justify-center text-zinc-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500 opacity-50" />
                <p className="text-xs font-black uppercase tracking-widest opacity-40">Loading Database</p>
              </div>
            ) : error ? (
              <div className="h-[500px] flex flex-col items-center justify-center">
                <div className="p-8 glass-card border-rose-500/20 text-center max-w-sm">
                  <Database className="w-10 h-10 mb-4 mx-auto text-rose-500 opacity-50" />
                  <p className="font-black text-white uppercase tracking-tight mb-2">Sync Required</p>
                  <p className="text-[10px] text-zinc-500 font-bold mb-6 leading-relaxed uppercase">{error}</p>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setShowSetupGuide(true)}
                      className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                    >
                      Setup Guide
                    </button>
                    <button 
                      onClick={() => setShowSettings(true)}
                      className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Configure URL
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              MemoizedDashboard
            )}
          </div>
        </div>
      </main>

      {showSetupGuide && (
        <SetupGuide onClose={() => setShowSetupGuide(false)} />
      )}

      {showUserManual && (
        <UserManual 
          onClose={() => setShowUserManual(false)} 
          onOpenSetup={() => {
            setShowUserManual(false);
            setShowSetupGuide(true);
          }} 
        />
      )}
    </div>
  );
}

export default App;
