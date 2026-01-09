
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { VideoMetadata, AnalysisResult, ChatMessage } from '../types.ts';

interface StrategyChatProps {
  metadata: VideoMetadata;
  analysis: AnalysisResult | null;
}

const StrategyChat: React.FC<StrategyChatProps> = ({ metadata, analysis }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const initChat = () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const context = `
      You are an expert YouTube Strategist. You are helping a creator optimize their video.
      CURRENT DATA:
      Title: ${metadata.title || 'N/A'}
      Description: ${metadata.description || 'N/A'}
      Current SEO Score: ${analysis?.overallScore || 'Not yet analyzed'}
      
      FEEDBACK FROM SYSTEM:
      ${analysis ? JSON.stringify(analysis.summary) : 'No analysis yet.'}
      
      Your goal is to provide actionable, high-energy advice on how to improve CTR, Retention, and SEO.
      Be concise but strategic. Suggest specific title variations, thumbnail concepts, or hook improvements.
    `;

    chatInstance.current = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: context,
      },
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    if (!chatInstance.current) initChat();

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await chatInstance.current.sendMessageStream({ message: userMsg });
      let fullText = '';
      
      // Add empty model message to start streaming into
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of response) {
        fullText += chunk.text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', text: fullText };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I lost my connection to the studio. Can you try again?" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!chatInstance.current) initChat();
        }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-red-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[100] flex items-center justify-center group"
      >
        {isOpen ? (
          <span className="text-2xl">✕</span>
        ) : (
          <div className="relative">
            <span className="text-2xl">💬</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-red-600 rounded-full animate-pulse"></span>
          </div>
        )}
        <span className="absolute right-20 bg-gray-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          Strategy Consultant
        </span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-[2.5rem] shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-red-600 to-red-800 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Strategy Consultant
            </h3>
            <p className="text-[10px] opacity-70 mt-1 font-bold">Ask me about thumbnails, hooks, or titles.</p>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-30">
                <span className="text-4xl">🤖</span>
                <p className="text-xs font-black uppercase tracking-tighter">Ready to optimize.</p>
                <p className="text-[10px] font-medium leading-relaxed">Ask "Give me 3 viral title variations" or "How can I improve my description score?"</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${
                  msg.role === 'user' 
                  ? 'bg-red-600 text-white rounded-tr-none' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none animate-pulse">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800">
            <div className="relative">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your strategist..."
                className="w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-2xl pl-4 pr-12 py-3 text-xs font-bold outline-none focus:border-red-500 transition-colors"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                ↑
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default StrategyChat;
