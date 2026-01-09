
import React, { useMemo, useState } from 'react';
import { GradingDetails } from '../types';

interface SuggestionItem {
  category: string;
  title: string;
  description: string;
  template: string;
  originalIndex: number;
}

interface ScoreCardProps {
  label: string;
  data: GradingDetails;
  icon: React.ReactNode;
  onAddTag?: (tag: string) => void;
  onAppendToDescription?: (text: string) => void;
  currentTags?: string;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ label, data, icon, onAddTag, onAppendToDescription, currentTags = "" }) => {
  const isDescription = label === "Content Strategy";
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [addedIndex, setAddedIndex] = useState<number | null>(null);
  const [addedGroup, setAddedGroup] = useState<string | null>(null);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50';
  };

  const activeTagsList = useMemo(() => {
    return currentTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== "");
  }, [currentTags]);

  const copyToClipboard = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleAddToEditor = (text: string, index: number) => {
    if (onAppendToDescription) {
      onAppendToDescription(text);
      setAddedIndex(index);
      setTimeout(() => setAddedIndex(null), 2000);
    }
  };

  const handleAddAllInGroup = (groupName: string, items: SuggestionItem[]) => {
    if (onAppendToDescription) {
      const combinedText = items
        .map(item => item.template)
        .filter(t => !!t)
        .join('\n\n');
      
      if (combinedText) {
        onAppendToDescription(combinedText);
        setAddedGroup(groupName);
        setTimeout(() => setAddedGroup(null), 2000);
      }
    }
  };

  const getStructuralIcon = (category: string) => {
    const low = category.toLowerCase();
    if (low.includes('timestamp')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    );
    if (low.includes('cta') || low.includes('subscribe')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
    );
    if (low.includes('social') || low.includes('link')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
    );
    if (low.includes('about')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    );
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
    );
  };

  const parseSuggestion = (item: string, index: number): SuggestionItem => {
    const parts = item.split('|').map(p => p.trim());
    if (parts.length < 3) return { category: 'Task', title: item, description: '', template: '', originalIndex: index };
    
    const category = parts[0];
    const title = parts[1];
    let desc = parts[2] || '';
    let template = '';

    const templateIndex = item.indexOf('Template:');
    if (templateIndex !== -1) {
      template = item.substring(templateIndex + 9).trim();
      if (template.startsWith('[') && template.endsWith(']')) {
        template = template.substring(1, template.length - 1);
      }
      if (desc.includes('Template:')) {
        desc = desc.split('Template:')[0].trim();
      }
    }

    return { category, title, description: desc, template, originalIndex: index };
  };

  const groupedSuggestions = useMemo(() => {
    if (!isDescription || !data.structuralSuggestions) return null;

    const groups: Record<string, SuggestionItem[]> = {};
    
    data.structuralSuggestions.forEach((item, idx) => {
      const suggestion = parseSuggestion(item, idx);
      const cat = suggestion.category.toUpperCase();
      
      let groupName = 'Miscellaneous';
      if (cat.includes('ABOUT')) groupName = 'About Sections';
      else if (cat.includes('SOCIAL') || cat.includes('LINK')) groupName = 'Socials & Links';
      else if (cat.includes('CTA') || cat.includes('SUBSCRIBE')) groupName = 'Call to Actions';
      else if (cat.includes('TIMESTAMP') || cat.includes('CHAPTER')) groupName = 'Timestamps & Chapters';
      else if (cat.includes('DISCLAIMER')) groupName = 'Legal & Disclaimers';

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(suggestion);
    });

    return groups;
  }, [data.structuralSuggestions, isDescription]);

  return (
    <div className="p-6 rounded-2xl border transition-all hover:shadow-md bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
            {icon}
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{label}</h3>
        </div>
        <div className={`px-4 py-1 rounded-full font-bold text-xl border ${getScoreColor(data.score)}`}>
          {data.score}
        </div>
      </div>

      <div className="space-y-4 flex-1">
        {data.specificTags && data.specificTags.length > 0 && (
          <div className="mb-4 p-4 bg-red-50/30 dark:bg-red-900/10 rounded-xl border border-red-100/50 dark:border-red-900/20">
            <h4 className="text-[10px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest mb-3 flex justify-between items-center">
              Suggested Tag Strings
              <span className="text-[8px] font-normal lowercase opacity-60">Click to add to box</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.specificTags.map((tag, idx) => {
                const isAdded = activeTagsList.includes(tag.trim().toLowerCase());
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      copyToClipboard(tag);
                      if (onAddTag) onAddTag(tag);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all shadow-sm flex items-center gap-1 border active:scale-90 ${
                      isAdded 
                      ? 'bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500' 
                      : 'bg-white dark:bg-gray-800 border-red-100 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-500 hover:text-white dark:hover:text-white hover:border-red-600 dark:hover:border-red-500'
                    }`}
                  >
                    {isAdded ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    ) : (
                      <span className="text-sm font-bold leading-none">+</span>
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isDescription && groupedSuggestions && Object.keys(groupedSuggestions).length > 0 && (
          <div className="mb-4 p-5 bg-indigo-50/20 dark:bg-indigo-900/10 rounded-[1.5rem] border border-indigo-100/50 dark:border-indigo-900/20">
            <h4 className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Structural Groups
            </h4>
            <div className="space-y-8">
              {/* Cast Object.entries result to fix 'unknown' type inference on 'items' */}
              {(Object.entries(groupedSuggestions) as [string, SuggestionItem[]][]).map(([groupName, items]) => {
                const isGroupAdded = addedGroup === groupName;
                return (
                  <div key={groupName} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-100/30 dark:border-indigo-800/30 pb-2">
                      <h5 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        {groupName}
                      </h5>
                      <button
                        onClick={() => handleAddAllInGroup(groupName, items)}
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-all ${
                          isGroupAdded 
                          ? 'bg-green-600 text-white' 
                          : 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900'
                        }`}
                      >
                        {isGroupAdded ? 'All Added ✓' : `Add All (${items.length})`}
                      </button>
                    </div>
                    <div className="space-y-6">
                      {items.map((item) => {
                        const isCurrentlyCopied = copiedIndex === item.originalIndex;
                        const isCurrentlyAdded = addedIndex === item.originalIndex;

                        return (
                          <div key={item.originalIndex} className="group relative">
                            <div className="flex items-start gap-4">
                              <div className="mt-1 p-2 rounded-xl text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                                {getStructuralIcon(item.category)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-black text-gray-800 dark:text-gray-100 truncate pr-4">
                                  {item.title}
                                </h5>
                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-snug mt-1">
                                  {item.description}
                                </p>
                                
                                {item.template && (
                                  <div className="mt-3 space-y-2">
                                    <div className="bg-white/50 dark:bg-gray-950/50 rounded-xl p-3 border border-indigo-50 dark:border-indigo-900/30 text-[10px] text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                                      {item.template}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => copyToClipboard(item.template, item.originalIndex)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                          isCurrentlyCopied 
                                          ? 'bg-green-600 border-green-600 text-white' 
                                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                      >
                                        {isCurrentlyCopied ? 'Copied!' : 'Copy'}
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                                      </button>
                                      <button
                                        onClick={() => handleAddToEditor(item.template, item.originalIndex)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                          isCurrentlyAdded 
                                          ? 'bg-green-600 border-green-600 text-white' 
                                          : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'
                                        }`}
                                      >
                                        {isCurrentlyAdded ? 'Added!' : 'Add to Box'}
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Expert Feedback
          </h4>
          <ul className="space-y-2">
            {data.feedback.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2 leading-snug">
                <span className="text-red-300 dark:text-red-500 mt-1 flex-shrink-0">•</span> {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
            Improvement Tasks
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {data.suggestions.map((suggestion, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm italic text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 group hover:border-red-100 dark:hover:border-red-900 transition-colors">
                "{suggestion}"
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;
