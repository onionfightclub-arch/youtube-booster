
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoMetadata, AnalysisResult, SavedGrading, IntelligenceResult } from './types.ts';
import { analyzeMetadata, improveDescription, fetchMarketIntelligence } from './services/geminiService.ts';
import ScoreCard from './components/ScoreCard.tsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie
} from 'recharts';

const STORAGE_KEY = 'yt_boost_grader_saves_v4';
const DRAFT_KEY = 'yt_boost_grader_draft_v1';
const THEME_KEY = 'yt_boost_grader_theme';

const App: React.FC = () => {
  const improvedDescRef = useRef<HTMLDivElement>(null);
  const intelRef = useRef<HTMLDivElement>(null);

  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) { console.error("Failed to parse draft", e); }
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
  
  const [intelNiche, setIntelNiche] = useState('');
  const [fetchingIntel, setFetchingIntel] = useState(false);
  const [intelResult, setIntelResult] = useState<IntelligenceResult | null>(null);

  const [showCompetitorInput, setShowCompetitorInput] = useState(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        return !!(parsed.competitorUrl || parsed.competitorNotes);
      } catch (e) { return false; }
    }
    return false;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

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

  useEffect(() => {
    if (improvedDesc && improvedDescRef.current) {
      improvedDescRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [improvedDesc]);

  useEffect(() => {
    if (intelResult && intelRef.current) {
      intelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [intelResult]);

  const saveToStorage = (newSaves: SavedGrading[]) => {
    setSavedGradings(newSaves);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const handleAppendToDescription = (text: string) => {
    setMetadata(prev => {
      const current = prev.description.trim();
      const separator = current === '' ? '' : '\n\n';
      return { ...prev, description: current + separator + text };
    });
    setSaveStatus('Section Added!');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleAddTag = (newTag: string) => {
    setMetadata(prev => {
      const currentTags = prev.tags.trim();
      if (!currentTags) return { ...prev, tags: newTag };
      const tagsArray = currentTags.split(',').map(t => t.trim().toLowerCase());
      if (tagsArray.includes(newTag.trim().toLowerCase())) return prev;
      return { ...prev, tags: `${currentTags}, ${newTag.trim()}` };
    });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata.title || !metadata.description) {
      setError('Missing Title or Description');
      return;
    }

    setLoading(true);
    setError(null);
    setImprovedDesc(null);
    try {
      const result = await analyzeMetadata(metadata);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError(`Analysis Error: ${err.message || 'Check your internet connection and API status.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchIntelligence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelNiche.trim()) return;

    setFetchingIntel(true);
    setError(null);
    try {
      const result = await fetchMarketIntelligence(intelNiche);
      setIntelResult(result);
    } catch (err: any) {
      console.error(err);
      setError(`Market Intel Error: ${err.message || 'Google Search grounding might be temporarily unavailable.'}`);
    } finally {
      setFetchingIntel(false);
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

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveToStorage(savedGradings.filter(s => s.id !== id));
  };

  const handleLoadSaved = (save: SavedGrading) => {
    setMetadata(save.metadata);
    setAnalysis(save.analysis);
    setImprovedDesc(null);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewGrading = () => {
    if (analysis && !isAlreadySaved) {
      if (!confirm('Unsaved report. Clear anyway?')) return;
    }
    setMetadata({ title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' });
    setAnalysis(null);
    setImprovedDesc(null);
    setIntelResult(null);
    setShowCompetitorInput(false);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleExpandDescription = async () => {
    if (!analysis) return;
    setExpanding(true);
    setError(null);
    try {
      const allRecs = [...analysis.title.recommendations, ...analysis.description.recommendations].slice(0, 10);
      const improved = await improveDescription(metadata.description, metadata.title, allRecs, metadata.duration);
      setImprovedDesc(improved);
    } catch (err: any) {
      console.error(err);
      setError(`Magic Error: ${err.message || 'Generation failed.'}`);
    } finally {
      setExpanding(false);
    }
  };

  const applyImprovedDescription = () => {
    if (improvedDesc) {
      setMetadata(prev => ({ ...prev, description: improvedDesc }));
      setImprovedDesc(null);
      setSaveStatus('Applied AI Magic!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyImprovedDescription = () => {
    if (improvedDesc) {
      navigator.clipboard.writeText(improvedDesc);
      setIsCopied(true);
      setSaveStatus('Magic Copied!');
      setTimeout(() => setIsCopied(false), 2000);
    }
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gray-100 dark:bg-gray-800">
              History ({savedGradings.length})
            </button>
          </div>
        </div>
      </nav>

      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black mb-6">SAVED REPORTS</h2>
            <div className="space-y-4">
              {savedGradings.map(save => (
                <div key={save.id} onClick={() => handleLoadSaved(save)} className="p-4 border dark:border-gray-800 rounded-2xl cursor-pointer hover:border-red-500 transition-all">
                  <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(save.timestamp).toLocaleDateString()}</p>
                  <h3 className="font-bold text-sm line-clamp-1">{save.metadata.title}</h3>
                  <p className="text-red-500 font-black text-xs mt-2">SCORE: {save.analysis.overallScore}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Trend Pulse */}
        <div className="mb-10 bg-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl">
          <h2 className="text-4xl font-black uppercase mb-4">What's Trending?</h2>
          <form onSubmit={handleFetchIntelligence} className="flex gap-4 max-w-2xl">
            <input value={intelNiche} onChange={e => setIntelNiche(e.target.value)} placeholder="Niche (e.g. AI Tutorials...)" className="flex-1 px-6 py-4 bg-white/10 rounded-2xl outline-none focus:bg-white/20 transition-all font-bold" />
            <button type="submit" disabled={fetchingIntel} className="px-8 py-4 bg-white text-indigo-900 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all uppercase text-xs">
              {fetchingIntel ? 'Scanning...' : 'Scan Market'}
            </button>
          </form>

          {intelResult && (
            <div ref={intelRef} className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/10">
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-black uppercase">Market Report: {intelNiche}</h3>
                <button onClick={() => setIntelResult(null)}>✕</button>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed opacity-90">{intelResult.text}</div>
              {intelResult.sources.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-2">
                  {intelResult.sources.map((s, i) => (
                    <a key={i} href={s.uri} target="_blank" className="text-[10px] font-bold bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20">{s.title || 'Source'}</a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border dark:border-gray-800">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black flex items-center gap-2">EDITOR</h2>
                <button onClick={handleNewGrading} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500">Reset</button>
              </div>
              <form onSubmit={handleAnalyze} className="space-y-6">
                <input name="title" value={metadata.title} onChange={handleInputChange} placeholder="Title..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="duration" value={metadata.duration} onChange={handleInputChange} placeholder="Duration..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none" />
                  <input name="tags" value={metadata.tags} onChange={handleInputChange} placeholder="Tags..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none" />
                </div>
                <textarea name="description" value={metadata.description} onChange={handleInputChange} rows={6} placeholder="Description..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none resize-none" />
                <button type="submit" disabled={loading} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl hover:bg-red-700 disabled:opacity-50 uppercase tracking-widest">
                  {loading ? 'Analyzing...' : 'Execute Analysis'}
                </button>
              </form>
              {error && <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-7">
            {analysis && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="bg-white dark:bg-gray-900 p-10 rounded-[2.5rem] shadow-2xl flex items-center gap-10">
                  <div className="text-center">
                    <div className="text-5xl font-black text-red-600">{analysis.overallScore}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">SCORE</div>
                  </div>
                  <div className="italic text-lg text-gray-500 leading-relaxed font-medium">"{analysis.summary}"</div>
                  <button onClick={handleSaveGrading} disabled={isAlreadySaved} className="ml-auto p-4 rounded-full bg-gray-50 dark:bg-gray-800">{isAlreadySaved ? '✓' : '💾'}</button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <ScoreCard label="Title SEO" data={analysis.title} icon="📝" />
                  <ScoreCard label="Content Strategy" data={analysis.description} onAppendToDescription={handleAppendToDescription} icon="📋" />
                </div>

                <div className="bg-indigo-600 p-8 rounded-[2rem] flex justify-between items-center text-white">
                  <div>
                    <h3 className="text-xl font-black uppercase">AI Description Magic</h3>
                    <p className="text-xs opacity-70">Complete SEO Optimized Rewrite</p>
                  </div>
                  <button onClick={handleExpandDescription} disabled={expanding} className="px-8 py-4 bg-white text-indigo-600 font-black rounded-2xl hover:scale-105 transition-all">
                    {expanding ? 'Brewing...' : 'Invoke Magic'}
                  </button>
                </div>

                {improvedDesc && (
                  <div ref={improvedDescRef} className="p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border-2 border-indigo-100">
                    <textarea readOnly value={improvedDesc} className="w-full h-80 p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none font-medium leading-relaxed resize-none" />
                    <div className="flex justify-end gap-4 mt-6">
                      <button onClick={copyImprovedDescription} className="px-6 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl font-black text-xs uppercase">{isCopied ? 'Copied!' : 'Copy'}</button>
                      <button onClick={applyImprovedDescription} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">Apply to Editor</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      {saveStatus && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-4 rounded-full font-black uppercase text-xs shadow-2xl z-[100]">{saveStatus}</div>}
    </div>
  );
};

export default App;
