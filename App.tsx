
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoMetadata, AnalysisResult, SavedGrading, IntelligenceResult } from './types';
import { analyzeMetadata, improveDescription, fetchMarketIntelligence } from './services/geminiService';
import ScoreCard from './components/ScoreCard';
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

  // Initialize metadata from localStorage if it exists
  const [metadata, setMetadata] = useState<VideoMetadata>(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
    return {
      title: '',
      description: '',
      tags: '',
      duration: '',
      script: '',
      competitorUrl: '',
      competitorNotes: ''
    };
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
  
  // Market Intelligence State
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

  // Theme synchronization
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  // Load saved history
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedGradings(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved gradings", e);
      }
    }
  }, []);

  // Auto-save draft whenever metadata changes
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(metadata));
  }, [metadata]);

  // Scroll to improved description when it's generated
  useEffect(() => {
    if (improvedDesc && improvedDescRef.current) {
      improvedDescRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [improvedDesc]);

  // Scroll to intelligence when it's fetched
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
      return {
        ...prev,
        description: current + separator + text
      };
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
      setError('Please provide at least a title and description.');
      return;
    }

    setLoading(true);
    setError(null);
    setImprovedDesc(null);
    try {
      const result = await analyzeMetadata(metadata);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError('Analysis failed. Please check your API key or connection.');
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
    } catch (err) {
      console.error(err);
      setError('Market Research failed. Please try again.');
    } finally {
      setFetchingIntel(false);
    }
  };

  const isAlreadySaved = useMemo(() => {
    if (!analysis) return false;
    return savedGradings.some(s => 
      s.metadata.title === metadata.title && 
      s.analysis.overallScore === analysis.overallScore
    );
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
      if (!confirm('You have an unsaved report. Are you sure you want to start a new one?')) return;
    }
    const emptyMetadata = { title: '', description: '', tags: '', duration: '', script: '', competitorUrl: '', competitorNotes: '' };
    setMetadata(emptyMetadata);
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
      const allRecs = [
        ...analysis.title.recommendations,
        ...analysis.description.recommendations,
        ...analysis.tags.recommendations
      ].slice(0, 10);
      const improved = await improveDescription(metadata.description, metadata.title, allRecs);
      setImprovedDesc(improved);
    } catch (err) {
      console.error(err);
      setError('Generation failed. The model might be busy, please try again.');
    } finally {
      setExpanding(false);
    }
  };

  const applyImprovedDescription = () => {
    if (improvedDesc) {
      setMetadata(prev => ({ ...prev, description: improvedDesc }));
      setImprovedDesc(null);
      setSaveStatus('Editor Updated!');
      setTimeout(() => setSaveStatus(null), 2000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyImprovedDescription = () => {
    if (improvedDesc) {
      navigator.clipboard.writeText(improvedDesc);
      setIsCopied(true);
      setSaveStatus('Copied to Clipboard!');
      setTimeout(() => {
        setIsCopied(false);
        setSaveStatus(null);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 font-sans selection:bg-red-100 dark:selection:bg-red-900/40 selection:text-red-900 dark:selection:text-red-200 transition-colors duration-300">
      <nav className="bg-white/80 dark:bg-gray-900/80 border-b dark:border-gray-800 sticky top-0 z-50 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-red-900/20">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </div>
              <div>
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-800 dark:from-red-500 dark:to-red-700 uppercase tracking-tighter">
                  Boost Grader
                </h1>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 -mt-1 uppercase tracking-tighter">YouTube SEO Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                )}
              </button>
              <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${showHistory ? 'bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-950/40' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                History {savedGradings.length > 0 && `(${savedGradings.length})`}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showHistory && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="absolute right-0 top-0 bottom-0 w-full max-sm:max-w-xs max-w-sm bg-white dark:bg-gray-900 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="font-black text-xl text-gray-800 dark:text-gray-100 uppercase tracking-tight">Saved Reports</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-gray-950/30">
              {savedGradings.length === 0 ? (
                <p className="text-center py-20 text-gray-400 dark:text-gray-600 font-bold text-sm">No saved reports found.</p>
              ) : (
                savedGradings.map((save) => (
                  <div key={save.id} onClick={() => handleLoadSaved(save)} className="p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-red-300 dark:hover:border-red-900 transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{new Date(save.timestamp).toLocaleDateString()}</span>
                      <button onClick={(e) => handleDeleteSaved(save.id, e)} className="p-1 text-gray-200 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                    <h3 className="font-black text-gray-800 dark:text-gray-100 text-sm line-clamp-2 leading-tight uppercase tracking-tight">{save.metadata.title}</h3>
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`px-2 py-0.5 rounded text-[10px] font-black border ${save.analysis.overallScore >= 80 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {save.analysis.overallScore} SCORE
                      </div>
                      {save.metadata.duration && (
                        <div className="px-2 py-0.5 rounded text-[10px] font-black border bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-600">
                          {save.metadata.duration}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Market Intelligence / Trending Section */}
        <div className="mb-10 bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900 dark:to-black rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-colors duration-500"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-400/30 mb-6">
                <div className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse"></div>
                <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Global Trends Pulse</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-white leading-[0.9] uppercase tracking-tighter mb-4">
                What's Trending <br/><span className="text-indigo-300">In Your Niche?</span>
              </h2>
              <p className="text-indigo-100 text-sm font-medium max-w-md opacity-80 leading-relaxed mb-8">
                Harness real-time YouTube intelligence powered by live search. Discover high-volume keywords and content gaps before your competitors do.
              </p>
              
              <form onSubmit={handleFetchIntelligence} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <div className="flex-1 relative">
                   <input 
                    value={intelNiche}
                    onChange={(e) => setIntelNiche(e.target.value)}
                    placeholder="Enter niche (e.g. AI Tutorials, Cooking Hacks...)"
                    className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none transition-all font-bold"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={fetchingIntel || !intelNiche}
                  className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50 disabled:scale-100"
                >
                  {fetchingIntel ? 'Researching...' : 'Scan Market'}
                </button>
              </form>
            </div>
            
            <div className="w-full md:w-1/3 flex justify-center">
              <div className="w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/30 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 shadow-inner relative">
                 <svg className={`w-24 h-24 text-white/40 ${fetchingIntel ? 'animate-spin' : 'animate-bounce'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                 <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full"></div>
              </div>
            </div>
          </div>

          {intelResult && (
            <div ref={intelRef} className="mt-12 p-8 sm:p-10 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                   <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                   Intel Report: {intelNiche}
                 </h3>
                 <button onClick={() => setIntelResult(null)} className="text-white/40 hover:text-white transition-colors">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
              </div>
              
              <div className="prose prose-invert prose-indigo max-w-none mb-10 text-indigo-50/90 font-medium leading-relaxed whitespace-pre-wrap">
                {intelResult.text}
              </div>

              {intelResult.sources.length > 0 && (
                <div className="pt-8 border-t border-white/10">
                  <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Research Sources</h4>
                  <div className="flex flex-wrap gap-4">
                    {intelResult.sources.map((source, i) => (
                      <a 
                        key={i} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-xl border border-white/10 text-xs font-bold text-white transition-all"
                      >
                        <svg className="w-3 h-3 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        {source.title || 'View Source'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl border border-white dark:border-gray-800 p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3 uppercase tracking-tight">
                  <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-600 dark:text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </div>
                  Optimization Editor
                </h2>
                <button onClick={handleNewGrading} className="text-[10px] text-gray-400 dark:text-gray-600 hover:text-red-500 font-black uppercase tracking-widest transition-colors flex items-center gap-1 group">
                  <svg className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Reset Draft
                </button>
              </div>
              
              <form onSubmit={handleAnalyze} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Video Title</label>
                  <input name="title" value={metadata.title} onChange={handleInputChange} placeholder="Video title..." className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 outline-none transition-all text-sm font-medium dark:text-gray-100" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Duration</label>
                    <input name="duration" value={metadata.duration} onChange={handleInputChange} placeholder="e.g. 10:45" className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 outline-none transition-all text-sm font-medium dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Tags</label>
                    <input name="tags" value={metadata.tags} onChange={handleInputChange} placeholder="split by comma" className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 outline-none transition-all text-sm font-medium dark:text-gray-100" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Description</label>
                    {analysis && (
                      <button type="button" onClick={handleExpandDescription} disabled={expanding} className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                        <svg className={`w-3 h-3 ${expanding ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Polish
                      </button>
                    )}
                  </div>
                  <textarea name="description" value={metadata.description} onChange={handleInputChange} rows={8} placeholder="Full description..." className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 outline-none transition-all text-sm font-medium dark:text-gray-100 resize-none leading-relaxed" />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Video Script (Optional)</label>
                  <textarea name="script" value={metadata.script} onChange={handleInputChange} rows={3} placeholder="Paste script content for deeper analysis..." className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:border-red-500 outline-none transition-all text-sm font-medium dark:text-gray-100 resize-none" />
                </div>

                <div>
                  <button type="button" onClick={() => setShowCompetitorInput(!showCompetitorInput)} className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-3 hover:text-indigo-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    {showCompetitorInput ? 'Hide Competitor Benchmarking' : 'Add Competitor Benchmark (Beta)'}
                  </button>
                  {showCompetitorInput && (
                    <div className="space-y-4 p-5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div>
                        <label className="block text-[9px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1.5">Competitor Video URL</label>
                        <input name="competitorUrl" value={metadata.competitorUrl} onChange={handleInputChange} placeholder="https://youtube.com/watch?v=..." className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs font-medium dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1.5">Competitor Performance Notes</label>
                        <textarea name="competitorNotes" value={metadata.competitorNotes} onChange={handleInputChange} rows={3} placeholder="What are they doing better? (e.g. Higher view count, better hook, etc.)" className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs font-medium dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={loading} className="w-full py-5 bg-gray-900 dark:bg-red-600 hover:bg-black dark:hover:bg-red-700 text-white font-black rounded-[1.5rem] shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-sm">
                    {loading ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Execute Boost Analysis"}
                  </button>
                </div>
              </form>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            {saveStatus && (
              <div className="fixed top-20 right-8 z-[100] bg-green-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl animate-in slide-in-from-right-10">
                {saveStatus}
              </div>
            )}
            
            {!analysis && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-gray-900 rounded-[2rem] border-2 border-dashed border-gray-100 dark:border-gray-800 min-h-[500px]">
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Intelligence Ready</h3>
                <p className="text-gray-400 dark:text-gray-500 max-w-sm mt-3 font-medium text-sm leading-relaxed">Submit your metadata for a precision SEO audit and competitive roadmap.</p>
              </div>
            )}

            {loading && (
              <div className="space-y-8">
                <div className="h-48 bg-white dark:bg-gray-900 rounded-[2rem] animate-pulse border dark:border-gray-800 shadow-sm"></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-64 bg-white dark:bg-gray-900 rounded-[2rem] animate-pulse border dark:border-gray-800 shadow-sm"></div>
                  <div className="h-64 bg-white dark:bg-gray-900 rounded-[2rem] animate-pulse border dark:border-gray-800 shadow-sm"></div>
                </div>
              </div>
            )}

            {analysis && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl border border-white dark:border-gray-800 p-10 flex flex-col md:flex-row items-center gap-10 relative">
                  <div className="absolute top-6 right-6">
                     <button onClick={handleSaveGrading} disabled={isAlreadySaved} className={`p-3 rounded-2xl transition-all border ${isAlreadySaved ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 bg-gray-50 dark:bg-gray-800'}`}>
                        {isAlreadySaved ? '✓ SAVED' : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>}
                     </button>
                  </div>
                  <div className="relative w-44 h-44 flex items-center justify-center scale-110">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[{ value: analysis.overallScore }, { value: 100 - analysis.overallScore }]} innerRadius={65} outerRadius={85} paddingAngle={0} startAngle={90} endAngle={450} dataKey="value" stroke="none">
                          <Cell fill={analysis.overallScore >= 80 ? '#10b981' : analysis.overallScore >= 50 ? '#f59e0b' : '#ef4444'} />
                          <Cell fill={isDarkMode ? '#1f2937' : '#f1f5f9'} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-gray-800 dark:text-gray-100 tracking-tighter">{analysis.overallScore}</span>
                      <span className="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest">Score</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-3">
                    <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">Audit Summary</h2>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium italic text-lg">"{analysis.summary}"</p>
                  </div>
                </div>

                {/* Competitor Audit Section */}
                {analysis.competitiveAudit && (
                  <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-900 shadow-xl shadow-indigo-500/5 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Competitor Intelligence</h3>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Benchmarking Audit</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="p-6 bg-green-50/30 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/40">
                        <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                          Your Unique Advantages
                        </h4>
                        <ul className="space-y-3">
                          {analysis.competitiveAudit.userStrengths.map((str, i) => (
                            <li key={i} className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 flex-shrink-0"></span>
                              {str}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-6 bg-red-50/30 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/40">
                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                          Competitor Edge
                        </h4>
                        <ul className="space-y-3">
                          {analysis.competitiveAudit.competitorStrengths.map((str, i) => (
                            <li key={i} className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 flex-shrink-0"></span>
                              {str}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 bg-indigo-50/20 dark:bg-indigo-950/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/50">
                        <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Gap Analysis</h4>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed italic">"{analysis.competitiveAudit.gapAnalysis}"</p>
                      </div>
                      <div className="p-6 bg-gray-900 dark:bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 dark:shadow-none">
                        <h4 className="text-[10px] font-black text-indigo-400 dark:text-indigo-200 uppercase tracking-widest mb-2">Recommended Strategic Move</h4>
                        <p className="text-sm font-black text-white leading-relaxed">{analysis.competitiveAudit.strategicMove}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                  <ScoreCard label="Title SEO" data={analysis.title} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h7"></path></svg>} />
                  <ScoreCard 
                    label="Content Strategy" 
                    data={analysis.description} 
                    onAppendToDescription={handleAppendToDescription}
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 4v4h4"></path></svg>} 
                  />
                </div>
                
                {/* AI Description Magic Section */}
                <div className="bg-indigo-600 dark:bg-indigo-900 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="text-center md:text-left relative z-10">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">AI Description Magic</h3>
                    <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Complete SEO Rewrite</p>
                  </div>
                  <button 
                    onClick={handleExpandDescription} 
                    disabled={expanding} 
                    className="px-10 py-5 bg-white text-indigo-600 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center gap-3 relative z-10"
                  >
                    {expanding ? (
                       <span className="flex items-center gap-2">
                         <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         Magic in progress...
                       </span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Invoke Magic
                      </>
                    )}
                  </button>
                </div>

                {improvedDesc && (
                  <div ref={improvedDescRef} className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-indigo-100 dark:border-indigo-900 shadow-2xl animate-in zoom-in-95 duration-500 relative">
                    <div className="absolute top-0 right-10 -mt-3">
                       <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">New Draft Ready</span>
                    </div>
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      Magical Output
                    </h4>
                    <textarea 
                      readOnly 
                      value={improvedDesc} 
                      className="w-full h-80 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-6 text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner" 
                    />
                    <div className="flex flex-col sm:flex-row justify-end gap-4 mt-6">
                      <button 
                        onClick={copyImprovedDescription} 
                        className={`flex items-center justify-center gap-2 px-6 py-3 font-black rounded-xl text-xs uppercase tracking-widest transition-all ${
                          isCopied 
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                            Copy to Clipboard
                          </>
                        )}
                      </button>
                      <button 
                        onClick={applyImprovedDescription} 
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Update Editor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
