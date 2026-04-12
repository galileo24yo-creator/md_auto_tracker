import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, Settings, X, Save, HelpCircle, Database, Pencil, Trash2, Plus, Check } from 'lucide-react';
import { fetchData, getGasUrl, getProfiles, getActiveProfile, saveProfiles } from './lib/api';
import { decodeHTMLEntities } from './lib/utils';
import Dashboard from './components/Dashboard';
import Recorder from './components/Recorder';
import SetupGuide from './components/SetupGuide';
import VisualBoard from './components/VisualBoard';
import './App.css';

function App() {
  const [data, setData] = useState({ records: [], decks: [], reasons: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
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
      // Decode entities for all string data
      const decodedRecords = (result.records || []).map(r => ({
        ...r,
        myDeck: decodeHTMLEntities(r.myDeck),
        opponentDeck: decodeHTMLEntities(r.opponentDeck),
        memo: decodeHTMLEntities(r.memo)
      }));
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
    <div className="min-h-screen py-10 px-4 md:px-10 text-zinc-200">
      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            MD Tracker
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-zinc-500 text-sm">Automated Match Analytics for Master Duel</p>
            {activeProfile && (
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold rounded-full uppercase">
                Profile: {activeProfile.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition ${showSettings ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-white"}`}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refresh" : "Fresh Data"}
          </button>
        </div>
      </header>
      
      {showSettings && (
        <div className="max-w-[1600px] mx-auto mb-8 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-zinc-800/80 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                Connection Profiles
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSetupGuide(true)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Setup Guide
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
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${activeProfile?.id === p.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                    onClick={() => editingProfileId !== p.id && handleSwitchProfile(p)}
                  >
                    {editingProfileId === p.id ? (
                      <div className="space-y-3" onClick={e => e.stopPropagation()}>
                        <input 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Profile Name"
                        />
                        <input 
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="GAS WebApp URL"
                        />
                        <input 
                          value={editSheetUrl || ''}
                          onChange={e => setEditSheetUrl(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-400 outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Spreadsheet URL (Optional)"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveProfile} className="flex-1 bg-indigo-600 text-white py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button onClick={() => setEditingProfileId(null)} className="flex-1 bg-zinc-800 text-zinc-400 py-1 rounded text-[10px] font-bold">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-zinc-200">{p.name}</span>
                          {activeProfile?.id === p.id && (
                            <span className="bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded font-black">ACTIVE</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate mb-3">{p.url || 'URL not set'}</div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-1.5 rounded transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-1.5 rounded transition"
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
                  <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Add New Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Left Column: Recording and Configuration (Sticky on XL screens) */}
        <div className="xl:col-span-2 xl:sticky xl:top-6 self-start z-20 border border-white/5 bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          <Recorder 
            availableDecks={data.decks} 
            availableTags={displayReasons} 
            onRecorded={() => loadData(true)} 
          />
        </div>

        {/* Right Column: Dashboard (60% width) */}
        <div className="xl:col-span-3 border border-white/5 bg-slate-900/80 rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>Loading records from Google Sheets...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center text-red-400 bg-red-500/10 rounded-xl p-8 text-center border border-red-500/20">
              <Database className="w-10 h-10 mb-4 opacity-50" />
              <p className="font-bold text-zinc-100 mb-2">GAS Connection Required</p>
              <p className="text-sm opacity-80 mb-6 max-w-sm mx-auto">{error}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowSetupGuide(true)}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-bold transition shadow-lg shadow-indigo-500/20"
                >
                  View Setup Guide
                </button>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold transition"
                >
                  Configure URL
                </button>
              </div>
            </div>
          ) : (
            <Dashboard 
              records={data.records} 
              onRefresh={() => loadData(true)} 
              decks={data.decks}
              reasons={data.reasons}
              displayReasons={displayReasons}
              activeProfile={activeProfile}
            />
          )}
        </div>
      </main>

      {/* Setup Guide Modal */}
      {showSetupGuide && (
        <SetupGuide onClose={() => setShowSetupGuide(false)} />
      )}
    </div>
  );
}

export default App;
