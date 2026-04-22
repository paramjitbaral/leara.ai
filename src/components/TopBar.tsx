import React from 'react';
import { useStore, AIMode } from '../store';
import { logOut, signIn } from '../firebase';
import { Sparkles, BrainCircuit, Zap, Settings, User, LogOut, LogIn, ChevronDown, Cpu, Globe, Key, GraduationCap, Sun, Moon, ShieldCheck, Plus, Check } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils';
import { ApiKeyModal } from './ApiKeyModal';
import { LearaLogo } from './LearaLogo';

interface TopBarProps {
  onEnterLearnMode: () => void;
}

export function TopBar({ onEnterLearnMode }: TopBarProps) {
  const { aiMode, setAiMode, aiProvider, setAiProvider, currentUsage, usageLimit, user, setIsLearningModalOpen, isLearningActive, theme, setTheme, providerKeys, setUserApiKey, setCurrentView, userApiKey, isApiKeyModalOpen, setIsApiKeyModalOpen } = useStore();

  const modes: { id: AIMode; label: string; icon: any }[] = [
    { id: 'explain', label: 'Explain', icon: Sparkles },
    { id: 'practice', label: 'Practice', icon: BrainCircuit },
    { id: 'build', label: 'Build', icon: Zap },
  ];

  const providers: { id: 'gemini' | 'openai' | 'ollama' | 'custom'; label: string; icon: any; isLocal?: boolean }[] = [
    { id: 'gemini', label: 'Gemini 3.1', icon: Globe },
    { id: 'openai', label: 'OpenAI GPT-4', icon: Globe },
    { id: 'ollama', label: 'Ollama (Local)', icon: Cpu, isLocal: true },
    { id: 'custom', label: 'Custom SDK', icon: Key },
  ];

  const currentProvider = providers.find(p => p.id === aiProvider) || providers[0];
  const ProviderIcon = currentProvider.icon;

  return (
    <>
      <header className={cn(
        "h-14 border-b flex items-center justify-between px-6 shrink-0 z-50 transition-colors",
        theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-white border-zinc-200"
      )}>
        <div className="flex items-center gap-8">
          <div className="cursor-pointer" role="button" onClick={() => setCurrentView('dashboard')}>
            <LearaLogo size="sm" />
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
              )}>{user?.uid === 'local-desktop-user' ? 'Local Desktop' : (user?.displayName || 'User')}</span>
              <span className="text-[9px] text-zinc-500 font-bold leading-none mt-1.5">
                {user?.uid === 'local-desktop-user' ? 'Working Offline' : user?.email}
              </span>
            </div>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center text-zinc-500 overflow-hidden transition-all active:scale-95",
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
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {user?.uid === 'local-desktop-user' ? 'Local Desktop Mode' : user?.displayName}
                    </p>
                    <p className="text-[9px] text-zinc-500 font-bold mt-1">
                      {user?.uid === 'local-desktop-user' ? 'Sync Disabled' : user?.email}
                    </p>
                  </div>

                  {user?.uid === 'local-desktop-user' ? (
                    <DropdownMenu.Item
                      onClick={() => signIn(true)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/10 rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest"
                    >
                      <LogIn className="w-4 h-4" /> Sign In to Cloud
                    </DropdownMenu.Item>
                  ) : (
                    <>
                      <DropdownMenu.Item className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest",
                        theme === 'dark' ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      )}>
                        <Settings className="w-4 h-4" /> Settings
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={() => {
                          logOut();
                          if (user?.uid === 'local-desktop-user') {
                            useStore.getState().setUser(null);
                            window.location.reload();
                          }
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest active:scale-95"
                      >
                        <LogOut className="w-4 h-4" /> Log Out
                      </DropdownMenu.Item>
                    </>
                  )}
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
