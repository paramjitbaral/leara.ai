import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Send, Sparkles, Bug, Zap, PlusCircle, Loader2, User, Bot, X, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as Tabs from '@radix-ui/react-tabs';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'ask' | 'fix' | 'improve' | 'generate';
}

export function CopilotPanel() {
  const { activeFile, aiMode, aiProvider, userApiKey, userId, setCurrentView } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (type: Message['type'] = 'ask') => {
    if (!input.trim() && type === 'ask') return;
    
    const userMessage: Message = { role: 'user', content: input || `Please ${type} this code.`, type };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Get Context
      const context = {
        fileName: activeFile?.name,
        language: activeFile?.language,
        content: activeFile?.content,
        mode: aiMode,
        // In a real app, you'd also include selected code from Monaco here
      };

      // 2. Call AI
      let responseText = "";
      
      const systemInstructions = {
        explain: "You are a patient coding mentor. Explain the code step-by-step, focusing on concepts and 'why' things work. Use analogies where helpful.",
        practice: "You are a coding tutor. Instead of giving answers, ask the user questions to help them figure it out themselves. Provide small hints if they are stuck.",
        build: "You are a senior software engineer. Provide direct, efficient code solutions and best practices. Focus on performance and scalability."
      };

      if (aiProvider === 'ollama') {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input, context, provider: 'ollama', systemInstruction: systemInstructions[aiMode] })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        responseText = data.response;
      } else if (aiProvider === 'openai') {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: input, 
            context, 
            provider: 'openai', 
            apiKey: userApiKey,
            systemInstruction: systemInstructions[aiMode] 
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        responseText = data.response;
      } else {
        // Default to Gemini
        const apiKey = userApiKey || process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          throw new Error("Gemini API Key is missing. Please provide one.");
        }
        const ai = new GoogleGenAI({ apiKey });
        const model = ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Context: ${JSON.stringify(context)}\n\nQuery: ${input || type}\n\nMode: ${aiMode}`,
          config: {
            systemInstruction: systemInstructions[aiMode]
          }
        });
        const result = await model;
        responseText = result.text || "No response from AI.";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
      {/* Professional Header */}
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#1e1e1e]">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
            title="Back to Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-white">Copilot</span>
          </div>
        </div>
        <div className="flex items-center">
          <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="text-[8px] text-emerald-500 uppercase font-bold tracking-widest">
              {aiMode}
            </span>
          </div>
        </div>
      </div>

      {/* Professional Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Bot className="w-10 h-10" />
            <p className="text-xs font-medium max-w-[200px] uppercase tracking-widest leading-relaxed">
              Ask me to explain, fix, or generate code.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex gap-3 group",
            msg.role === 'assistant' ? "bg-white/[0.03] -mx-4 px-4 py-4 border-y border-white/5" : ""
          )}>
            <div className="shrink-0 mt-0.5">
              <div className={cn(
                "w-6 h-6 rounded flex items-center justify-center",
                msg.role === 'user' ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.2)]"
              )}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="flex-1 text-[12px] prose prose-invert max-w-none leading-relaxed text-zinc-300">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 bg-white/[0.03] -mx-4 px-4 py-4 border-y border-white/5 animate-pulse">
            <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500/50">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 flex items-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500/50" />
            </div>
          </div>
        )}
      </div>

      {/* Professional Input Area */}
      <div className="p-4 border-t border-white/5 bg-[#1e1e1e]">
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask anything..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 pr-12 text-xs text-white focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-zinc-600 resize-none min-h-[80px] max-h-[200px] shadow-inner"
          />
          <button 
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="absolute bottom-3 right-3 p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded-lg text-white transition-all shadow-lg shadow-emerald-500/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-[7px] text-zinc-600 font-bold uppercase tracking-widest px-1">
          <span>Shift + Enter for new line</span>
          <span>{aiProvider === 'gemini' ? 'Gemini 3.1' : aiProvider === 'openai' ? 'GPT-4' : 'Ollama'}</span>
        </div>
      </div>
    </div>
  );
}
