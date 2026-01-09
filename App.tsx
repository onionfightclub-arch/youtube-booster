
import React, { useState, useEffect, useMemo } from 'react';
import { VideoMetadata, AnalysisResult, SavedGrading } from './types.ts';
import { analyzeMetadata } from './services/geminiService.ts';
import ScoreCard from './components/ScoreCard.tsx';
import StrategyChat from './components/StrategyChat.tsx';
import { ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const STORAGE_KEY = 'yt_boost_grader_saves_v4';
const DRAFT_KEY = 'yt_boost_grader_draft_v1';
const THEME_KEY = 'yt_boost_grader_theme';

const App: React.FC = () => {
  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try { return JSON.parse(savedDraft); } catch (e) { console.error(e); }
    }
    return { title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' };
  });

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedGradings, setSavedGradings] = useState<SavedGrading[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const checkKey = async () => {
      const selected = await (window as any).aistudio?.hasSelectedApiKey();
      const envKey = process.env.API_KEY;
      const isSet = !!selected || (!!envKey && envKey !== "undefined" && envKey !== "");
      setApiReady(isSet);
    };
    checkKey();
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) try { setSavedGradings(JSON.parse(stored)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(metadata));
  }, [metadata]);

  const handleOpenSelectKey = async () => {
    await (window as any).aistudio?.openSelectKey();
    setApiReady(true);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const handleAppendToDescription = (text: string) => {
    setMetadata(prev => ({ ...prev, description: (prev.description.trim() + '\n\n' + text).trim() }));
    setSaveStatus('Section Added!');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiReady) return handleOpenSelectKey();
    if (!metadata.title.trim() || !metadata.description.trim()) {
      setError('Please provide a title and description.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMetadata(metadata);
      setAnalysis(result);
    } catch (err: any) {
      if (err.message === "REAUTH_REQUIRED") {
        setError("AI Connection Lost. Please click 'Setup AI' to reconnect.");
        setApiReady(false);
      } else {
        setError(err.message || 'Analysis failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isAlreadySaved = useMemo(() => {
    return analysis ? savedGradings.some(s => s.metadata.title === metadata.title) : false;
  }, [analysis, metadata.title, savedGradings]);

  const handleSaveGrading = () => {
    if (!analysis || isAlreadySaved) return;
    const newSave: SavedGrading = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      metadata: { ...metadata },
      analysis: { ...analysis }
    };
    const updated = [newSave, ...savedGradings];
    setSavedGradings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveStatus('Report Saved!');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const pieChartData = useMemo(() => analysis ? [
    { name: 'Score', value: analysis.overallScore },
    { name: 'Remaining', value: 100 - analysis.overallScore },
  ] : [], [analysis]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 transition-colors">
      <nav className="bg-white/80 dark:bg-gray-900/80 border-b dark:border-gray-800 sticky top-0 z-50 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black">▶</span>
            </div>
            <h1 className="text-lg font-black uppercase tracking-tighter">Boost Grader</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleOpenSelectKey}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${apiReady ? 'bg-green-100 text-green-700' : 'bg-red-600 text-white animate-pulse shadow-lg'}`}
            >
              {apiReady ? '● AI Connected' : 'Setup AI'}
            </button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2">{isDarkMode ? '☀️' : '🌙'}</button>
            <button onClick={() => setShowHistory(!showHistory)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-800">History</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {!apiReady && (
          <div className="mb-8 p-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-3xl text-center shadow-lg">
            <h3 className="text-lg font-black text-red-600 dark:text-red-400 uppercase tracking-tight">AI Offline</h3>
            <p className="text-xs text-gray-500 font-medium mt-1 mb-4">You need to link a Gemini API key from a paid project to begin.</p>
            <button onClick={handleOpenSelectKey} className="px-6 py-2 bg-red-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-xl">Setup Connection</button>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className={`bg-white dark:bg-gray-900 p-6 rounded-[2rem] shadow-xl border dark:border-gray-800 ${!apiReady ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-sm font-black uppercase tracking-widest mb-6 opacity-40">Video Draft</h2>
              <form onSubmit={handleAnalyze} className="space-y-4">
                <input name="title" value={metadata.title} onChange={handleInputChange} placeholder="Title..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl outline-none focus:border-red-500 font-bold text-sm" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="duration" value={metadata.duration} onChange={handleInputChange} placeholder="Duration" className="p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl outline-none text-xs font-bold" />
                  <input name="tags" value={metadata.tags} onChange={handleInputChange} placeholder="Tags..." className="p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl outline-none text-xs font-bold" />
                </div>
                <textarea name="description" value={metadata.description} onChange={handleInputChange} rows={6} placeholder="Description..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl outline-none focus:border-red-500 text-xs font-medium resize-none" />
                <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl hover:bg-red-700 disabled:opacity-50 uppercase tracking-widest text-xs">
                  {loading ? 'Analyzing...' : 'Execute Audit'}
                </button>
              </form>
              {error && <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase text-center border border-red-100">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-7">
            {analysis ? (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] shadow-xl flex items-center gap-6 border dark:border-gray-800">
                  <div className="w-32 h-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} innerRadius={45} outerRadius={60} dataKey="value" stroke="none">
                          <Cell fill={analysis.overallScore > 70 ? '#10b981' : '#f59e0b'} />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center font-black">
                      <div className="text-3xl">{analysis.overallScore}</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="text-sm font-black uppercase">Verdict</h3>
                      <button onClick={handleSaveGrading} className="text-xs">{isAlreadySaved ? '✓' : '💾'}</button>
                    </div>
                    <p className="text-xs text-gray-500 italic mt-2">"{analysis.summary}"</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <ScoreCard label="Title" data={analysis.title} icon="📐" />
                  <ScoreCard label="Content" data={analysis.description} onAppendToDescription={handleAppendToDescription} currentTags={metadata.tags} icon="📋" />
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 opacity-20 bg-white/50 dark:bg-gray-900/50 rounded-[2rem] border-2 border-dashed border-gray-300">
                <span className="text-4xl">🚀</span>
                <p className="text-[10px] font-black uppercase tracking-widest mt-4">System Ready</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <StrategyChat metadata={metadata} analysis={analysis} />
      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-80 bg-white dark:bg-gray-900 p-6 shadow-2xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-black uppercase mb-6">Reports</h2>
            {savedGradings.map(s => (
              <div key={s.id} onClick={() => { setMetadata(s.metadata); setAnalysis(s.analysis); setShowHistory(false); }} className="p-3 border rounded-xl mb-3 cursor-pointer hover:border-red-500">
                <h4 className="text-xs font-bold line-clamp-1">{s.metadata.title}</h4>
                <div className="text-[10px] opacity-50">{new Date(s.timestamp).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {saveStatus && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-full font-black uppercase text-[10px] shadow-2xl z-[100]">{saveStatus}</div>}
    </div>
  );
};

export default App;
