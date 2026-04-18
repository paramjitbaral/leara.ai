import React from 'react';
import { useStore, AIMode } from '../store';
import { logOut } from '../firebase';
import { Sparkles, BrainCircuit, Zap, Settings, User, LogOut, ChevronDown, Cpu, Globe, Key, GraduationCap, Sun, Moon, ShieldCheck } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils';
import { ApiKeyModal } from './ApiKeyModal';

interface TopBarProps {
  onEnterLearnMode: () => void;
}

export function TopBar({ onEnterLearnMode }: TopBarProps) {
  const { aiMode, setAiMode, aiProvider, setAiProvider, currentUsage, usageLimit, user, setIsLearningModalOpen, isLearningActive, theme, setTheme, setUserApiKey, setCurrentView, userApiKey, isApiKeyModalOpen, setIsApiKeyModalOpen } = useStore();

  const modes: { id: AIMode; label: string; icon: any }[] = [
    { id: 'explain', label: 'Explain', icon: Sparkles },
    { id: 'practice', label: 'Practice', icon: BrainCircuit },
    { id: 'build', label: 'Build', icon: Zap },
  ];

  const providers: { id: 'gemini' | 'openai' | 'ollama'; label: string; icon: any; isLocal?: boolean }[] = [
    { id: 'gemini', label: 'Gemini 3.1', icon: Globe },
    { id: 'openai', label: 'OpenAI GPT-4', icon: Globe },
    { id: 'ollama', label: 'Ollama (Local)', icon: Cpu, isLocal: true },
  ];

  const currentProvider = providers.find(p => p.id === aiProvider);
  const ProviderIcon = currentProvider?.icon || Globe;

  return (
    <>
      <header className={cn(
      "h-14 border-b flex items-center justify-between px-6 shrink-0 z-50 transition-colors",
      theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-white border-zinc-200"
    )}>
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setCurrentView('dashboard')}>
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-110">
            <Zap className="w-5 h-5" />
          </div>
          <span className={cn(
            "font-display text-lg tracking-tight transition-colors",
            theme === 'dark' ? "text-white" : "text-zinc-900"
          )}>Leara<span className="text-emerald-500">.ai</span></span>
        </div>
        
        <div className={cn("h-6 w-[1px]", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
        
        <button
          onClick={onEnterLearnMode}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
            isLearningActive 
              ? "bg-emerald-500 text-black shadow-xl shadow-emerald-500/20" 
              : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
          )}
        >
          {isLearningActive ? (
            <>
              <BrainCircuit className="w-4 h-4 animate-pulse" />
              Learning Active
            </>
          ) : (
            <>
              <GraduationCap className="w-4 h-4" />
              Learn Mode
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-6">
        {/* AI Provider Selector */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-xl border transition-all text-xs font-bold",
              theme === 'dark' 
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20" 
                : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm"
            )}>
              <ProviderIcon className="w-4 h-4 text-zinc-500" />
              <span>{currentProvider?.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className={cn(
                "min-w-[220px] rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 border",
                theme === 'dark' ? "bg-[#1e1e1e] border-white/10" : "bg-white border-zinc-200"
              )}
              align="start"
              sideOffset={8}
            >
              {providers.map((p) => (
                <DropdownMenu.Item 
                  key={p.id}
                  onClick={() => setAiProvider(p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer outline-none transition-all group",
                    aiProvider === p.id 
                      ? "bg-emerald-500 text-white" 
                      : theme === 'dark' 
                        ? "text-zinc-400 hover:bg-white/5 hover:text-white" 
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <p.icon className={cn(
                      "w-4 h-4",
                      aiProvider === p.id ? "text-white" : "text-zinc-500"
                    )} />
                    <span className="text-[11px] font-bold uppercase tracking-widest">{p.label}</span>
                  </div>
                  {p.isLocal && (
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter",
                      aiProvider === p.id ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    )}>Local</span>
                  )}
                </DropdownMenu.Item>
              ))}
              <div className={cn("h-px my-1.5", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
              <DropdownMenu.Item 
                onClick={() => setIsApiKeyModalOpen(true)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer outline-none transition-all group",
                  theme === 'dark' ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-zinc-500" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Custom API Key</span>
                </div>
                {userApiKey && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className={cn("h-6 w-[1px]", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            "p-2 rounded-xl transition-all",
            theme === 'dark' ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
          )}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className={cn("h-6 w-[1px]", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest leading-none",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>{user?.displayName || 'User'}</span>
            <span className="text-[9px] text-zinc-500 font-bold leading-none mt-1.5">{user?.email}</span>
          </div>
          
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center text-zinc-500 overflow-hidden transition-all",
                theme === 'dark' ? "bg-zinc-800 border border-white/5 hover:border-emerald-500/50" : "bg-zinc-100 border border-zinc-200 hover:border-emerald-500/50"
              )}>
                {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className={cn(
                  "min-w-[200px] border rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200",
                  theme === 'dark' ? "bg-[#1e1e1e] border-white/10" : "bg-white border-zinc-200"
                )}
                align="end"
                sideOffset={8}
              >
                <div className={cn("px-3 py-3 border-b mb-2", theme === 'dark' ? "border-white/5" : "border-zinc-100")}>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-zinc-900")}>{user?.displayName}</p>
                  <p className="text-[9px] text-zinc-500 font-bold mt-1">{user?.email}</p>
                </div>
                <DropdownMenu.Item className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest",
                  theme === 'dark' ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}>
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={logOut}
                  className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      </header>
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
      />
    </>
  );
}
