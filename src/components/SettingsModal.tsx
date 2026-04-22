import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Moon, Sun, Terminal as TerminalIcon, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { 
    sidebarPosition, setSidebarPosition,
    theme, setTheme,
    terminalType, setTerminalType,
    isLearningActive, setIsLearningActive
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'appearance' | 'editor' | 'terminal'>('appearance');
  const [position, setPosition] = useState(sidebarPosition);
  const [activeTheme, setActiveTheme] = useState(theme);
  const [termType, setTermType] = useState(terminalType);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPosition(sidebarPosition);
      setActiveTheme(theme);
      setTermType(terminalType);
      setIsSaved(false);
    }
  }, [isOpen, sidebarPosition, theme, terminalType]);

  const handleSave = () => {
    setSidebarPosition(position);
    setTheme(activeTheme);
    setTerminalType(termType);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'editor', label: 'Editor', icon: Settings2 },
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[480px] border rounded-2xl shadow-2xl z-[101] outline-none overflow-hidden flex animate-in zoom-in-95 duration-200",
          theme === 'dark' ? "bg-[#0a0a0a] border-white/5" : "bg-white border-zinc-200"
        )}>
          {/* Professional Sidebar */}
          <div className={cn(
            "w-[180px] border-r flex flex-col p-4 gap-1",
            theme === 'dark' ? "border-white/5 bg-black/20" : "border-zinc-200 bg-zinc-50"
          )}>
            <div className="mb-6 px-2">
              <h2 className={cn("text-[10px] font-black uppercase tracking-[0.2em]", theme === 'dark' ? "text-white" : "text-zinc-900")}>Settings</h2>
              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Preferences</p>
            </div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all btn-tactile group",
                  activeTab === tab.id 
                    ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20")
                    : (theme === 'dark' ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/5" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100")
                )}
              >
                <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? (theme === 'dark' ? "text-emerald-500" : "text-white") : "text-zinc-600 group-hover:text-zinc-400")} />
                {tab.label}
              </button>
            ))}
            
            <div className="mt-auto">
              <div className={cn("p-3 rounded-xl border", theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-100 border-zinc-200")}>
                 <p className="text-[8px] text-zinc-500 font-bold uppercase leading-relaxed text-center">Managed by Leara Core v1.3</p>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className={cn("flex-1 flex flex-col", theme === 'dark' ? "bg-[#0d0d0d]" : "bg-white")}>
            <div className="flex-1 p-8 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between group">
                        <div>
                          <h4 className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>System Theme</h4>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Toggle workspace optics</p>
                        </div>
                        <div className={cn("flex p-1 rounded-xl border", theme === 'dark' ? "bg-black/40 border-white/5" : "bg-zinc-100 border-zinc-200")}>
                          <button 
                            onClick={() => setActiveTheme('dark')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", 
                              activeTheme === 'dark' 
                                ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-zinc-900 text-white shadow-lg") 
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >Dark</button>
                          <button 
                            onClick={() => setActiveTheme('light')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", 
                              activeTheme === 'light' 
                                ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-zinc-900 text-white shadow-lg") 
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >Light</button>
                        </div>
                      </div>

                      <div className={cn("h-px w-full", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />

                      <div className="flex items-center justify-between group">
                        <div>
                          <h4 className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>Sidebar Axis</h4>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Primary docking position</p>
                        </div>
                        <div className={cn("flex p-1 rounded-xl border", theme === 'dark' ? "bg-black/40 border-white/5" : "bg-zinc-100 border-zinc-200")}>
                          <button 
                            onClick={() => setPosition('left')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", 
                              position === 'left' 
                                ? "bg-emerald-500 text-white shadow-lg" 
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >Left</button>
                          <button 
                            onClick={() => setPosition('right')}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", 
                              position === 'right' 
                                ? "bg-emerald-500 text-white shadow-lg" 
                                : "text-zinc-500 hover:text-zinc-300"
                            )}
                          >Right</button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'terminal' && (
                  <motion.div
                    key="terminal"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-zinc-300" : "text-zinc-700")}>Terminal Type</h4>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Execution environment engine</p>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <button 
                          onClick={() => setTermType('server')}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all truncate text-left flex justify-between items-center group", 
                            termType === 'server' 
                              ? (theme === 'dark' ? "bg-white/5 border-emerald-500/50 text-white" : "bg-zinc-50 border-emerald-500 text-zinc-900") 
                              : (theme === 'dark' ? "border-white/5 text-zinc-500" : "border-zinc-200 text-zinc-400")
                          )}
                        >
                          Node Shell
                          {termType === 'server' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                        </button>
                        <button 
                          onClick={() => setTermType('browser')}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all truncate text-left flex justify-between items-center", 
                            termType === 'browser' 
                              ? (theme === 'dark' ? "bg-white/5 border-emerald-500/50 text-white" : "bg-zinc-50 border-emerald-500 text-zinc-900") 
                              : (theme === 'dark' ? "border-white/5 text-zinc-500" : "border-zinc-200 text-zinc-400")
                          )}
                        >
                          Web Container
                          {termType === 'browser' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={cn(
              "p-6 border-t flex items-center justify-between",
              theme === 'dark' ? "border-white/5 bg-black/20" : "border-zinc-100 bg-zinc-50"
            )}>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Unsaved Changes will be lost</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-all font-mono"
                >Cancel</button>
                <button 
                  onClick={handleSave}
                  disabled={isSaved}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all btn-tactile shadow-2xl",
                    isSaved 
                      ? "bg-emerald-500 text-white" 
                      : (theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-black")
                  )}
                >
                  {isSaved ? 'Applied' : 'Apply Settings'}
                </button>
              </div>
            </div>
          </div>

          <Dialog.Close className={cn(
            "absolute top-4 right-4 p-1.5 rounded-lg transition-all outline-none",
            theme === 'dark' ? "text-zinc-600 hover:text-white hover:bg-white/5" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
          )}>
            <X className="w-4 h-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
