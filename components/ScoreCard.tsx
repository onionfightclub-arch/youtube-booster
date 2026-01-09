
import React, { useMemo, useState } from 'react';
import { GradingDetails } from '../types.ts';

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
  const isDescription = label.toLowerCase().includes("content") || label.toLowerCase().includes("strategy");
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
    if (low.includes('timestamp')) return '⏳';
    if (low.includes('cta') || low.includes('subscribe')) return '🔔';
    if (low.includes('social') || low.includes('link')) return '🔗';
    if (low.includes('about')) return 'ℹ️';
    return '💡';
  };

  const parseSuggestion = (item: string, index: number): SuggestionItem => {
    const parts = item.split('|').map(p => p.trim());
    
    // Defensive check
    if (parts.length < 2) {
      return { category: 'General', title: 'SEO Enhancement', description: item, template: '', originalIndex: index };
    }

    const category = parts[0] || 'Misc';
    const title = parts[1] || 'Optimization';
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
    <div className="p-8 rounded-[2.5rem] border transition-all bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-2xl">
            {icon}
          </div>
          <h3 className="font-black text-lg text-gray-800 dark:text-gray-100 uppercase tracking-tight">{label}</h3>
        </div>
        <div className={`px-4 py-1 rounded-full font-black text-xl border ${getScoreColor(data.score)}`}>
          {data.score}
        </div>
      </div>

      <div className="space-y-6 flex-1">
        {/* Specific Tag Highlights */}
        {data.specificTags && data.specificTags.length > 0 && (
          <div className="mb-4 p-5 bg-red-50/20 dark:bg-red-900/10 rounded-3xl border border-red-100/50 dark:border-red-900/20">
            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Recommended Tag Strings</h4>
            <div className="flex flex-wrap gap-2">
              {data.specificTags.map((tag, idx) => {
                const isAdded = activeTagsList.includes(tag.trim().toLowerCase());
                return (
                  <button
                    key={idx}
                    onClick={() => { copyToClipboard(tag); if (onAddTag) onAddTag(tag); }}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition-all flex items-center gap-2 border ${
                      isAdded 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'bg-white dark:bg-gray-800 border-red-100 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white'
                    }`}
                  >
                    {isAdded ? '✓' : '+'} {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Structural Suggestions / Blocks */}
        {isDescription && groupedSuggestions && Object.keys(groupedSuggestions).length > 0 && (
          <div className="mb-4 space-y-8">
            {(Object.entries(groupedSuggestions) as [string, SuggestionItem[]][]).map(([groupName, items]) => {
              const isGroupAdded = addedGroup === groupName;
              return (
                <div key={groupName} className="space-y-4">
                  <div className="flex items-center justify-between border-b dark:border-gray-800 pb-2">
                    <h5 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      {groupName}
                    </h5>
                    <button
                      onClick={() => handleAddAllInGroup(groupName, items)}
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-all ${
                        isGroupAdded 
                        ? 'bg-green-600 text-white shadow-sm' 
                        : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                      }`}
                    >
                      {isGroupAdded ? 'All Added ✓' : `Add All Blocks (${items.length})`}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {items.map((item) => {
                      const isCurrentlyCopied = copiedIndex === item.originalIndex;
                      const isCurrentlyAdded = addedIndex === item.originalIndex;

                      return (
                        <div key={item.originalIndex} className="bg-gray-50 dark:bg-gray-800/30 rounded-2xl p-4 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group">
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{getStructuralIcon(item.category)}</span>
                            <div className="flex-1">
                              <h5 className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">{item.title}</h5>
                              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                              
                              {item.template && (
                                <div className="mt-4 space-y-2">
                                  <div className="bg-white dark:bg-gray-950 rounded-xl p-3 border dark:border-gray-800 text-[10px] text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                                    {item.template}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => copyToClipboard(item.template, item.originalIndex)}
                                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                                        isCurrentlyCopied ? 'bg-green-600 border-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                      }`}
                                    >
                                      {isCurrentlyCopied ? 'Copied' : 'Copy'}
                                    </button>
                                    <button
                                      onClick={() => handleAddToEditor(item.template, item.originalIndex)}
                                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                        isCurrentlyAdded ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                                      }`}
                                    >
                                      {isCurrentlyAdded ? 'Added' : 'Add to Box'}
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
        )}

        <div>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Expert Feedback</h4>
          <ul className="space-y-3">
            {data.feedback.map((item, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex gap-3 leading-relaxed">
                <span className="text-red-400 flex-shrink-0 mt-1">•</span> {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Optimization Tasks</h4>
          <div className="space-y-2">
            {data.suggestions.map((suggestion, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-xs font-bold text-gray-800 dark:text-gray-200 border border-transparent hover:border-red-100 transition-colors">
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;
