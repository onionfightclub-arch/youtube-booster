
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
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const initChat = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") {
      setError("AI Key not found in environment.");
      return false;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const context = `
        You are an expert YouTube Strategist. Help the creator optimize:
        Title: ${metadata.title || 'Draft'}
        Description: ${metadata.description || 'Draft'}
        Current SEO Score: ${analysis?.overallScore || 'Unscored'}
        Verdict: ${analysis?.summary || 'N/A'}
        
        Provide high-energy, tactical advice on CTR and retention. Be specific.
      `;

      chatInstance.current = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: { systemInstruction: context },
      });
      setError(null);
      return true;
    } catch (err) {
      console.error(err);
      setError("Failed to initialize strategist.");
      return false;
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    if (!chatInstance.current) {
      const success = initChat();
      if (!success) return;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    setError(null);

    try {
      const response = await chatInstance.current.sendMessageStream({ message: userMsg });
      let fullText = '';
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of response) {
        const textChunk = chunk.text || "";
        fullText += textChunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'model', text: fullText };
          return updated;
        });
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.message?.includes("API_KEY_INVALID") 
        ? "Invalid API Key. Please check settings." 
        : "Strategist is offline. Try again later.";
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!chatInstance.current) initChat();
        }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-red-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-[100] flex items-center justify-center group"
      >
        {isOpen ? <span className="text-2xl">✕</span> : <span className="text-2xl">💬</span>}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-[2.5rem] shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-6 bg-gradient-to-r from-red-600 to-red-800 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></span>
              Consultant {error ? '(Offline)' : '(Online)'}
            </h3>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100">
                ⚠️ {error}
              </div>
            )}
            {messages.length === 0 && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-30">
                <span className="text-4xl">🤖</span>
                <p className="text-xs font-black uppercase tracking-tighter">Strategist Ready</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium ${
                  msg.role === 'user' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-200'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && <div className="text-[10px] text-gray-400 font-bold ml-2">Consultant is thinking...</div>}
          </div>

          <form onSubmit={handleSend} className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-800">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={error ? "AI is currently disabled..." : "Ask your strategist..."}
              disabled={!!error || isTyping}
              className="w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-red-500 disabled:opacity-50"
            />
          </form>
        </div>
      )}
    </>
  );
};

export default StrategyChat;
