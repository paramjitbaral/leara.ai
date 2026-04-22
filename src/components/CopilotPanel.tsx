import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { Send, Sparkles, Bug, Zap, PlusCircle, Loader2, User, Bot, X, LayoutDashboard, Plus, Mic, ArrowUp, ChevronDown, Cpu, Globe, Monitor, Link, Check, GraduationCap, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'ask' | 'fix' | 'improve' | 'generate';
}

export function CopilotPanel() {
  const { 
    activeFile, aiMode, setAiMode, aiProvider, setAiProvider, 
    userApiKey, userId, setCurrentView, aiModel, theme, providerKeys,
    setIsApiKeyModalOpen, setIsAIPanelOpen
  } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const providers = [
    { id: 'gemini', label: 'Gemini AI', icon: Globe },
    { id: 'openai', label: 'OpenAI', icon: Cpu },
    { id: 'ollama', label: 'Ollama', icon: Monitor },
    { id: 'custom', label: 'Custom SDK', icon: Link },
  ] as const;

  const modes: { id: typeof aiMode; label: string; icon: any }[] = [
    { id: 'explain', label: 'Explain', icon: Sparkles },
    { id: 'practice', label: 'Practice', icon: GraduationCap },
    { id: 'build', label: 'Build', icon: Zap },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (type: Message['type'] = 'ask') => {
    if (!input.trim() && type === 'ask') return;
    
    if (!userApiKey && aiProvider !== 'ollama') {
      toast.error('AI Access Key Required', {
        description: 'Please connect your API key in the configuration settings to use AI features.',
      });
      setIsApiKeyModalOpen(true);
      return;
    }
    
    const userMessage: Message = { role: 'user', content: input || `Please ${type} this code.`, type };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const context = {
        fileName: activeFile?.name,
        language: activeFile?.language,
        content: activeFile?.content,
        mode: aiMode,
      };

      const systemInstructions = {
        explain: "You are a patient coding mentor. Explain the code step-by-step, focusing on concepts and 'why' things work.",
        practice: "You are a coding tutor. Instead of giving answers, ask the user questions to help them figure it out themselves.",
        build: "You are a senior software engineer. Provide direct, efficient code solutions and best practices."
      };

      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: currentInput || type, 
          context, 
          provider: aiProvider, 
          apiKey: userApiKey,
          model: aiModel,
          endpoint: useStore.getState().aiEndpoint,
          systemInstruction: systemInstructions[aiMode] 
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
      {/* Leara Core Header */}
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-white">Leara Core</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setMessages([])}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
            title="Start New Thread"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setIsAIPanelOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-red-400 btn-tactile"
            title="Collapse Leara Core"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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

      {/* Premium High-Fidelity Input Area */}
      <div className="p-4 border-t border-white/5 bg-[#1e1e1e]">
        {/* Attachment Chips */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {attachments.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/10 rounded-lg group">
                  <span className="text-[9px] font-bold text-zinc-400 truncate max-w-[100px]">{file.name}</span>
                  <button 
                    onClick={() => removeAttachment(idx)}
                    className="p-0.5 hover:bg-white/10 rounded-md text-zinc-600 hover:text-red-400"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "relative flex flex-col border transition-all duration-200 group-within:border-emerald-500/30 overflow-hidden",
          theme === 'dark' ? "bg-white/[0.03] border-white/10 rounded-xl shadow-2xl" : "bg-zinc-50 border-zinc-200 rounded-xl"
        )}>
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            multiple 
            className="hidden" 
          />

          {/* Main Input Area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask anything, @ to mention, / for workflows"
            className="w-full bg-transparent px-4 pt-3 pb-1 text-[12px] text-white focus:outline-none transition-all placeholder:text-zinc-600 resize-none min-h-[50px] max-h-[180px]"
          />

          {/* Bottom Action Bar */}
          <div className="px-2 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all outline-none"
                title="Attach files or context"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <div className={cn("h-4 w-[1px] mx-0.5", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

              {/* Mode Switcher */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all group/btn outline-none">
                    <Zap className={cn("w-3 h-3 transition-colors", aiMode === 'build' ? "text-amber-500" : "text-zinc-600 group-hover/btn:text-amber-500/70")} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{aiMode === 'build' ? 'Fast' : aiMode}</span>
                    <ChevronDown className="w-2 h-2 text-zinc-600" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="min-w-[140px] bg-[#1e1e1e] border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" align="start">
                    {modes.map((m) => (
                      <DropdownMenu.Item
                        key={m.id}
                        onClick={() => setAiMode(m.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer outline-none transition-all",
                          aiMode === m.id ? "bg-emerald-500 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Provider Switcher */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all group/btn outline-none border",
                    (!providerKeys[aiProvider] && aiProvider !== 'ollama')
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                      : "text-zinc-500 hover:text-white hover:bg-white/5 border-transparent"
                  )}>
                    <Cpu className={cn(
                      "w-3 h-3 transition-colors", 
                      (providerKeys[aiProvider] || aiProvider === 'ollama') ? "text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "text-amber-500/50 animate-pulse"
                    )} />
                    <span className="text-[9px] font-black uppercase tracking-tighter truncate max-w-[80px]">
                      {(!providerKeys[aiProvider] && aiProvider !== 'ollama') 
                        ? "Connect AI" 
                        : (providers.find(p => p.id === aiProvider)?.label || aiProvider)}
                    </span>
                    <ChevronDown className="w-2 h-2 text-zinc-600" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="min-w-[150px] bg-[#0f0f0f] border border-white/5 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" align="start">
                    {providers.filter(p => providerKeys[p.id] || p.id === 'ollama').map((p) => (
                      <DropdownMenu.Item
                        key={p.id}
                        onClick={() => setAiProvider(p.id)}
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer outline-none transition-all group",
                          aiProvider === p.id 
                            ? "bg-emerald-500/10 text-emerald-500" 
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <p.icon className={cn("w-3 h-3 icon-smooth", aiProvider === p.id ? "text-emerald-500" : "text-zinc-600 group-hover:text-emerald-400")} />
                          <span className="text-[9px] font-bold uppercase tracking-tighter">{p.label.split(' ')[0]}</span>
                        </div>
                        {aiProvider === p.id && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                      </DropdownMenu.Item>
                    ))}

                    {providers.filter(p => providerKeys[p.id] || p.id === 'ollama').length === 0 && (
                      <div className="px-2 py-3 text-center">
                        <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">No AI Connected</p>
                      </div>
                    )}

                    <DropdownMenu.Item
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-tighter text-zinc-600 hover:text-emerald-500 hover:bg-emerald-500/5 cursor-pointer outline-none transition-all"
                    >
                      <Plus className="w-2.5 h-2.5" /> 
                      <span>Configure</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0",
                  (!input.trim() && attachments.length === 0) ? "bg-white/5 text-zinc-600 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200 shadow-xl shadow-black/50"
                )}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
