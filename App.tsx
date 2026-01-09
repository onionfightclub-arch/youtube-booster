
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VideoMetadata, AnalysisResult, SavedGrading } from './types.ts';
import { analyzeMetadata, improveDescription } from './services/geminiService.ts';
import ScoreCard from './components/ScoreCard.tsx';
import StrategyChat from './components/StrategyChat.tsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';

const STORAGE_KEY = 'yt_boost_grader_saves_v4';
const DRAFT_KEY = 'yt_boost_grader_draft_v1';
const THEME_KEY = 'yt_boost_grader_theme';

const App: React.FC = () => {
  const improvedDescRef = useRef<HTMLDivElement>(null);

  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try { return JSON.parse(savedDraft); } catch (e) { console.error("Failed to parse draft", e); }
    }
    return { title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' };
  });

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [improvedDesc, setImprovedDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedGradings, setSavedGradings] = useState<SavedGrading[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const key = process.env.API_KEY;
    setApiReady(!!key && key !== "undefined" && key !== "");
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setSavedGradings(JSON.parse(stored)); } catch (e) { console.error("History fail", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(metadata));
  }, [metadata]);

  const saveToStorage = (newSaves: SavedGrading[]) => {
    setSavedGradings(newSaves);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
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
    if (!apiReady) {
      setError("AI System is not ready. Missing API Key in environment.");
      return;
    }
    if (!metadata.title.trim() || !metadata.description.trim()) {
      setError('Please enter a Title and Description.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setImprovedDesc(null);
    try {
      const result = await analyzeMetadata(metadata);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Analysis failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const isAlreadySaved = useMemo(() => {
    if (!analysis) return false;
    return savedGradings.some(s => s.metadata.title === metadata.title && s.analysis.overallScore === analysis.overallScore);
  }, [analysis, metadata.title, savedGradings]);

  const handleSaveGrading = () => {
    if (!analysis || isAlreadySaved) return;
    const newSave: SavedGrading = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      metadata: { ...metadata },
      analysis: { ...analysis }
    };
    saveToStorage([newSave, ...savedGradings]);
    setSaveStatus('Report Saved!');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleNewGrading = () => {
    setMetadata({ title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' });
    setAnalysis(null);
    setImprovedDesc(null);
  };

  const barChartData = useMemo(() => {
    if (!analysis) return [];
    return [
      { name: 'Title', score: analysis.title.score },
      { name: 'Content', score: analysis.description.score },
      { name: 'Tags', score: analysis.tags.score },
    ];
  }, [analysis]);

  const pieChartData = useMemo(() => {
    if (!analysis) return [];
    return [
      { name: 'Score', value: analysis.overallScore },
      { name: 'Remaining', value: 100 - analysis.overallScore },
    ];
  }, [analysis]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 transition-colors duration-300">
      <nav className="bg-white/80 dark:bg-gray-900/80 border-b dark:border-gray-800 sticky top-0 z-50 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-800 dark:from-red-500 dark:to-red-700 uppercase tracking-tighter">Boost Grader</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${apiReady ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
              <div className={`w-2 h-2 rounded-full ${apiReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {apiReady ? 'AI Ready' : 'AI Disconnected'}
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-xl">{isDarkMode ? '☀️' : '🌙'}</button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gray-100 dark:bg-gray-800">History</button>
          </div>
        </div>
      </nav>

      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black uppercase tracking-tight">Saved Reports</h2>
              <button onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="space-y-4">
              {savedGradings.map(save => (
                <div key={save.id} onClick={() => { setMetadata(save.metadata); setAnalysis(save.analysis); setShowHistory(false); }} className="p-4 border dark:border-gray-800 rounded-2xl cursor-pointer hover:border-red-500 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(save.timestamp).toLocaleString()}</p>
                  <h3 className="font-bold text-sm line-clamp-1">{save.metadata.title}</h3>
                  <span className="text-[10px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded mt-2 inline-block">Score: {save.analysis.overallScore}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {!apiReady && (
          <div className="mb-10 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-200 dark:border-red-800 rounded-3xl text-center">
            <h3 className="text-lg font-black text-red-600 dark:text-red-400 uppercase tracking-tight">Environment Configuration Required</h3>
            <p className="text-sm text-red-500/80 font-medium mt-1">The Gemini API Key is missing. Please set the <code>API_KEY</code> environment variable in your platform settings to enable analysis and strategist features.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border dark:border-gray-800">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">Optimization Editor</h2>
                <button onClick={handleNewGrading} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500">New Audit</button>
              </div>
              <form onSubmit={handleAnalyze} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Video Title</label>
                  <input name="title" value={metadata.title} onChange={handleInputChange} placeholder="Video title..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 transition-all font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input name="duration" value={metadata.duration} onChange={handleInputChange} placeholder="Duration (e.g. 10:45)" className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none font-bold" />
                  <input name="tags" value={metadata.tags} onChange={handleInputChange} placeholder="Tags (comma split)" className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Description</label>
                  <textarea name="description" value={metadata.description} onChange={handleInputChange} rows={8} placeholder="Draft description here..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 font-medium resize-none" />
                </div>
                <button type="submit" disabled={loading || !apiReady} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl hover:bg-red-700 disabled:opacity-50 uppercase tracking-widest text-sm">
                  {loading ? 'Crunching Data...' : 'Execute SEO Audit'}
                </button>
              </form>
              {error && <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black border border-red-100">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-7">
            {analysis ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-10 border dark:border-gray-800">
                  <div className="w-48 h-48 relative flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} innerRadius={65} outerRadius={85} paddingAngle={0} dataKey="value" stroke="none" startAngle={90} endAngle={450}>
                          <Cell key="cell-0" fill={getScoreColor(analysis.overallScore)} />
                          <Cell key="cell-1" fill={isDarkMode ? '#1f2937' : '#f3f4f6'} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-5xl font-black text-gray-800 dark:text-gray-100 tracking-tighter">{analysis.overallScore}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Overall</div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800 dark:text-gray-100">Performance Verdict</h2>
                      <button onClick={handleSaveGrading} disabled={isAlreadySaved} className={`p-4 rounded-2xl transition-all shadow-sm ${isAlreadySaved ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 dark:bg-gray-800 hover:bg-red-500 hover:text-white'}`}>
                        {isAlreadySaved ? '✓' : '💾'}
                      </button>
                    </div>
                    <div className="italic text-lg text-gray-500 dark:text-gray-400 leading-relaxed font-medium">"{analysis.summary}"</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <ScoreCard label="Title Architecture" data={analysis.title} icon="📐" />
                  <ScoreCard label="Content Strategy" data={analysis.description} onAppendToDescription={handleAppendToDescription} currentTags={metadata.tags} icon="📋" />
                  <ScoreCard label="Metadata Tags" data={analysis.tags} currentTags={metadata.tags} icon="🏷️" />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white/50 dark:bg-gray-900/50 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800">
                <div className="text-6xl mb-4 grayscale opacity-30">🚀</div>
                <h3 className="text-2xl font-black text-gray-400 uppercase tracking-tight">Ready for Audit</h3>
              </div>
            )}
          </div>
        </div>
      </main>

      <StrategyChat metadata={metadata} analysis={analysis} />
      {saveStatus && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-10 py-5 rounded-full font-black uppercase text-[10px] tracking-widest shadow-2xl z-[100]">{saveStatus}</div>}
    </div>
  );
};

export default App;
