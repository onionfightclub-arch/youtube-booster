
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
  const [hasKey, setHasKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);

  useEffect(() => {
    const checkKey = async () => {
      const selected = await (window as any).aistudio?.hasSelectedApiKey();
      const envKey = process.env.API_KEY;
      setHasKey(!!selected || (!!envKey && envKey !== "undefined" && envKey !== ""));
    };
    checkKey();
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !hasKey) return;

    if (!chatInstance.current) {
      try {
        // Strict initialization per guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatInstance.current = ai.chats.create({
          model: 'gemini-3-pro-preview',
          config: { 
            systemInstruction: `You are a YouTube Growth Strategist. Help optimize this video: "${metadata.title}". Score: ${analysis?.overallScore || 'N/A'}.` 
          },
        });
      } catch (err) {
        setMessages(prev => [...prev, { role: 'model', text: "Connection error. Re-link your API key." }]);
        return;
      }
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const stream = await chatInstance.current.sendMessageStream({ message: userMsg });
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of stream) {
        fullText += (chunk.text || "");
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'model', text: fullText };
          return next;
        });
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: "Service error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[100]">
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[450px] bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-3xl shadow-2xl z-[100] flex flex-col overflow-hidden">
          <div className="p-4 bg-red-600 text-white flex justify-between">
            <span className="text-xs font-black uppercase">Strategist</span>
            {!hasKey && <span className="text-[8px] animate-pulse">Setup Required</span>}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {!hasKey ? (
              <div className="text-center p-4">
                <p className="text-[10px] font-bold text-gray-400">Setup your API key in the header to chat.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-xl text-[10px] font-medium max-w-[85%] ${m.role === 'user' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {isTyping && <div className="text-[8px] text-gray-400 font-bold ml-1">Typing...</div>}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t dark:border-gray-800">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasKey ? "Ask advice..." : "Offline..."}
              disabled={!hasKey || isTyping}
              className="w-full p-3 bg-gray-50 dark:bg-gray-950 rounded-xl text-xs font-bold outline-none border dark:border-gray-800 focus:border-red-500"
            />
          </form>
        </div>
      )}
    </>
  );
};

export default StrategyChat;
