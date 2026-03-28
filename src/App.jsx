import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { fetchData } from './lib/api';
import Dashboard from './components/Dashboard';
import Recorder from './components/Recorder';
import './App.css';

function App() {
  const [data, setData] = useState({ records: [], decks: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    const result = await fetchData();
    
    if (result.success) {
      setData({
        records: result.records || [],
        decks: result.decks || []
      });
    } else {
      setError(result.error || "Failed to load data from GAS.");
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen py-10 px-4 md:px-8 text-zinc-200">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            MD Tracker
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Automated Match Analytics for Master Duel</p>
        </div>
        
        <button 
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="mt-4 md:mt-0 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 rounded-lg text-sm font-medium flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Fresh Data"}
        </button>
      </header>
      
      <main className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Recording and Configuration */}
        <div className="xl:col-span-1 border border-white/5 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          <Recorder availableDecks={data.decks} onRecorded={() => loadData(true)} />
        </div>

        {/* Right Column: Dashboard */}
        <div className="xl:col-span-2 border border-white/5 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 shadow-2xl ring-1 ring-white/10">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>Loading records from Google Sheets...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center text-red-400 bg-red-500/10 rounded-xl p-6 text-center border border-red-500/20">
              <p className="font-medium mb-2">Connection Error</p>
              <p className="text-sm opacity-80">{error}</p>
              <button onClick={() => loadData(true)} className="mt-4 text-sm underline">Retry</button>
            </div>
          ) : (
            <Dashboard records={data.records} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
