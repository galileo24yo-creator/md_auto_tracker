import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Settings, X, Save, HelpCircle, Database } from 'lucide-react';
import { fetchData, getGasUrl } from './lib/api';
import Dashboard from './components/Dashboard';
import Recorder from './components/Recorder';
import SetupGuide from './components/SetupGuide';
import './App.css';

function App() {
  const [data, setData] = useState({ records: [], decks: [], reasons: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [tempUrl, setTempUrl] = useState(getGasUrl());

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    const result = await fetchData();
    
    if (result.success) {
      setData({
        records: result.records || [],
        decks: result.decks || [],
        reasons: result.reasons || []
      });
    } else {
      setError(result.error || "Failed to load data from GAS.");
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  const saveUrl = () => {
    localStorage.setItem('md_gas_url', tempUrl);
    setShowSettings(false);
    loadData(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen py-10 px-4 md:px-10 text-zinc-200">
      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            MD Tracker
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Automated Match Analytics for Master Duel</p>
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
          <div className="bg-zinc-800/40 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Backend Connection Settings
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSetupGuide(true)}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Setup Guide
                </button>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Google Apps Script WebApp URL</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <button 
                    onClick={saveUrl}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed italic">
                  ※GASで「新しいデプロイ」を行った際は、発行された新しいURLに書き換えてください。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Left Column: Recording and Configuration (Increased width to 40%) */}
        <div className="xl:col-span-2 border border-white/5 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          <Recorder 
            availableDecks={data.decks} 
            availableTags={data.reasons} 
            onRecorded={() => loadData(true)} 
          />
        </div>

        {/* Right Column: Dashboard (60% width) */}
        <div className="xl:col-span-3 border border-white/5 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
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
