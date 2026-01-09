
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

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata.title.trim() || !metadata.description.trim()) {
      setError('Please enter a Title and Description to analyze.');
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
      setError(err.message || 'Analysis failed. This usually happens due to API limits or network issues.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchIntelligence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intelNiche.trim()) return;

    setFetchingIntel(true);
    setError(null);
    setIntelResult(null);
    try {
      const result = await fetchMarketIntelligence(intelNiche);
      setIntelResult(result);
    } catch (err: any) {
      console.error(err);
      setError(`Market Research Error: ${err.message || 'The grounding tool is temporarily unavailable.'}`);
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

  const handleNewGrading = () => {
    if (analysis && !isAlreadySaved) {
      if (!confirm('Clear editor and start new analysis?')) return;
    }
    setMetadata({ title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' });
    setAnalysis(null);
    setImprovedDesc(null);
    setIntelResult(null);
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
      setError(`Improvement Error: ${err.message}`);
    } finally {
      setExpanding(false);
    }
  };

  // Fix: Added missing copy function for the AI-improved description
  const copyImprovedDescription = () => {
    if (improvedDesc) {
      navigator.clipboard.writeText(improvedDesc);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Fix: Added missing apply function to update the metadata description with AI output
  const applyImprovedDescription = () => {
    if (improvedDesc) {
      setMetadata(prev => ({ ...prev, description: improvedDesc }));
      setSaveStatus('Description Updated!');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  // Fix: Added missing tag handler to update metadata tags from recommendations
  const handleAddTag = (tag: string) => {
    setMetadata(prev => {
      const currentTags = prev.tags.split(',').map(t => t.trim()).filter(t => t !== "");
      if (currentTags.some(t => t.toLowerCase() === tag.toLowerCase())) return prev;
      return { ...prev, tags: currentTags.length > 0 ? [...currentTags, tag].join(', ') : tag };
    });
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-xl hover:scale-110 transition-transform">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors">
              History ({savedGradings.length})
            </button>
          </div>
        </div>
      </nav>

      {showHistory && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl p-6 overflow-y-auto transform animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black uppercase tracking-tight">Saved Reports</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-red-500">✕</button>
            </div>
            <div className="space-y-4">
              {savedGradings.length === 0 ? (
                <p className="text-center py-10 text-gray-500 font-medium">No reports saved yet.</p>
              ) : (
                savedGradings.map(save => (
                  <div key={save.id} onClick={() => { setMetadata(save.metadata); setAnalysis(save.analysis); setShowHistory(false); }} className="p-4 border dark:border-gray-800 rounded-2xl cursor-pointer hover:border-red-500 transition-all bg-gray-50 dark:bg-gray-800/50 group">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{new Date(save.timestamp).toLocaleString()}</p>
                    <h3 className="font-bold text-sm line-clamp-1 group-hover:text-red-500 transition-colors">{save.metadata.title}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded">Score: {save.analysis.overallScore}</span>
                      <button onClick={(e) => { e.stopPropagation(); saveToStorage(savedGradings.filter(s => s.id !== save.id)); }} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Market Research Section */}
        <div className="mb-10 bg-gradient-to-br from-indigo-900 to-black rounded-[2.5rem] p-10 text-white shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full -mr-20 -mt-20 group-hover:bg-indigo-500/30 transition-colors"></div>
          <h2 className="text-4xl font-black uppercase mb-4 tracking-tighter relative">Trend Scanner</h2>
          <p className="text-indigo-200 mb-8 max-w-xl font-medium relative">Enter your niche to discover trending keywords, current audience search patterns, and identified content gaps powered by live search.</p>
          <form onSubmit={handleFetchIntelligence} className="flex flex-col sm:flex-row gap-4 max-w-2xl relative">
            <input value={intelNiche} onChange={e => setIntelNiche(e.target.value)} placeholder="Niche (e.g. Minecraft Hacks, Skincare Routine...)" className="flex-1 px-6 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none focus:bg-white/20 focus:border-indigo-400 transition-all font-bold placeholder:text-white/30" />
            <button type="submit" disabled={fetchingIntel || !intelNiche.trim()} className="px-10 py-4 bg-white text-indigo-900 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all uppercase text-xs disabled:opacity-50 shadow-xl">
              {fetchingIntel ? 'Scanning...' : 'Scan Market'}
            </button>
          </form>

          {intelResult && (
            <div ref={intelRef} className="mt-8 p-8 bg-white/5 rounded-3xl border border-white/10 animate-in zoom-in-95 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  Market Analysis: {intelNiche}
                </h3>
                <button onClick={() => setIntelResult(null)} className="text-white/40 hover:text-white">✕</button>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed opacity-90 prose prose-invert prose-indigo max-w-none text-indigo-50">{intelResult.text}</div>
              {intelResult.sources.length > 0 && (
                <div className="mt-10 pt-8 border-t border-white/10">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">Referenced Intelligence</h4>
                  <div className="flex flex-wrap gap-3">
                    {intelResult.sources.map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" className="flex items-center gap-2 text-[10px] font-bold bg-white/5 px-4 py-2 rounded-xl hover:bg-indigo-600 transition-all border border-white/5">{s.title || 'Source Data'}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border dark:border-gray-800">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
                  <span className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">✍️</span>
                  Optimization Editor
                </h2>
                <button onClick={handleNewGrading} className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors">New Audit</button>
              </div>
              <form onSubmit={handleAnalyze} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Video Title</label>
                  <input name="title" value={metadata.title} onChange={handleInputChange} placeholder="Draft title here..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 transition-all font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Duration</label>
                    <input name="duration" value={metadata.duration} onChange={handleInputChange} placeholder="e.g. 10:45" className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 transition-all font-bold" />
                  </div>
                   <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Tags (Comma split)</label>
                    <input name="tags" value={metadata.tags} onChange={handleInputChange} placeholder="seo, tags, viral" className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 transition-all font-bold" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Description Content</label>
                  <textarea name="description" value={metadata.description} onChange={handleInputChange} rows={8} placeholder="Draft description here..." className="w-full p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl outline-none focus:border-red-500 transition-all font-medium resize-none leading-relaxed" />
                </div>
                <button type="submit" disabled={loading} className="w-full py-5 bg-red-600 text-white font-black rounded-3xl shadow-xl hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest text-sm">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Crunching Data...
                    </span>
                  ) : 'Execute SEO Audit'}
                </button>
              </form>
              {error && <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black border border-red-100 dark:border-red-900/30 animate-shake">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-7">
            {!analysis && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white/50 dark:bg-gray-900/50 rounded-[2.5rem] border-4 border-dashed border-gray-100 dark:border-gray-800">
                <div className="text-6xl mb-4 grayscale opacity-30">🚀</div>
                <h3 className="text-2xl font-black text-gray-400 uppercase tracking-tight">Audit Ready</h3>
                <p className="text-gray-400 max-w-xs mt-2 font-medium">Input your metadata to generate your SEO score and optimization roadmap.</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
                {/* Score Summary Block */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-10 border dark:border-gray-800">
                  <div className="w-48 h-48 relative flex-shrink-0 scale-110">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                          startAngle={90}
                          endAngle={450}
                        >
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
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800 dark:text-gray-100">Performance Verdict</h2>
                        <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${analysis.overallScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                           {analysis.overallScore >= 80 ? 'Optimized' : 'Needs Optimization'}
                        </div>
                      </div>
                      <button onClick={handleSaveGrading} disabled={isAlreadySaved} className={`p-4 rounded-2xl transition-all shadow-sm ${isAlreadySaved ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 dark:bg-gray-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600'}`}>
                        {isAlreadySaved ? '✓' : '💾'}
                      </button>
                    </div>
                    <div className="italic text-lg text-gray-500 dark:text-gray-400 leading-relaxed font-medium">"{analysis.summary}"</div>
                  </div>
                </div>

                {/* Bar Chart Block */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] shadow-xl border dark:border-gray-800">
                  <h3 className="text-xs font-black uppercase text-gray-400 mb-8 tracking-widest">Sectional Strength</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#374151' : '#f1f5f9'} />
                        <XAxis dataKey="name" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          cursor={{ fill: isDarkMode ? '#1f2937' : '#f9fafb', radius: 15 }}
                          contentStyle={{ 
                            borderRadius: '20px', 
                            border: 'none', 
                            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="score" radius={[12, 12, 12, 12]} barSize={50}>
                          {barChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score Cards Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <ScoreCard label="Title Architecture" data={analysis.title} icon="📐" />
                  <ScoreCard label="Content Strategy" data={analysis.description} onAppendToDescription={handleAppendToDescription} currentTags={metadata.tags} icon="📋" />
                  {/* Added missing Tags scorecard to display the recommended specificTags strings */}
                  <ScoreCard label="Metadata Tags" data={analysis.tags} onAddTag={handleAddTag} currentTags={metadata.tags} icon="🏷️" />
                </div>

                {/* AI Polish Section */}
                <div className="bg-indigo-600 dark:bg-indigo-800 p-10 rounded-[2.5rem] flex flex-col sm:flex-row justify-between items-center text-white shadow-2xl shadow-indigo-500/30 group">
                  <div className="mb-6 sm:mb-0 text-center sm:text-left">
                    <h3 className="text-2xl font-black uppercase tracking-tight">AI Polish Magic</h3>
                    <p className="text-indigo-100 text-sm font-bold opacity-80 uppercase tracking-widest">Complete SEO Refactor</p>
                  </div>
                  <button onClick={handleExpandDescription} disabled={expanding} className="px-10 py-5 bg-white text-indigo-600 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all uppercase text-xs shadow-xl group-hover:rotate-1">
                    {expanding ? 'Brewing...' : 'Invoke Magic'}
                  </button>
                </div>

                {improvedDesc && (
                  <div ref={improvedDescRef} className="p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border-2 border-indigo-100 dark:border-indigo-900/50 relative animate-in slide-in-from-bottom-5 duration-700">
                    <div className="absolute top-0 right-10 -mt-3 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">New Draft</div>
                    <textarea readOnly value={improvedDesc} className="w-full h-80 p-8 bg-gray-50 dark:bg-gray-800 rounded-3xl outline-none font-medium leading-relaxed resize-none dark:text-gray-200 border border-transparent focus:border-indigo-400 transition-colors" />
                    <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
                      <button onClick={copyImprovedDescription} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}>
                        {isCopied ? 'Copied!' : 'Copy to Clipboard'}
                      </button>
                      <button onClick={applyImprovedDescription} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all">
                        Apply to Editor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      {saveStatus && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-10 py-5 rounded-full font-black uppercase text-[10px] tracking-widest shadow-2xl z-[100] animate-in slide-in-from-bottom-10">{saveStatus}</div>}
    </div>
  );
};

export default App;
