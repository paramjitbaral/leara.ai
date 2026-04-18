import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { X, Key, Save, AlertCircle, Cpu, Globe, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { 
    userApiKey, setUserApiKey, 
    aiProvider, setAiProvider,
    sidebarPosition, setSidebarPosition,
    theme 
  } = useStore();
  
  const [apiKey, setApiKey] = useState(userApiKey || '');
  const [provider, setProvider] = useState(aiProvider);
  const [position, setPosition] = useState(sidebarPosition);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(userApiKey || '');
      setProvider(aiProvider);
      setPosition(sidebarPosition);
      setIsSaved(false);
    }
  }, [isOpen, userApiKey, aiProvider, sidebarPosition]);

  const handleSave = () => {
    setUserApiKey(apiKey);
    setAiProvider(provider);
    setSidebarPosition(position);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1500);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-3xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
          theme === 'dark' ? "bg-[#0c0c0c] border-white/10" : "bg-white border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className={cn(
                  "text-lg font-semibold tracking-tight",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>AI Settings</Dialog.Title>
                <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                  Configure your AI intelligence engine
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className={cn(
              "p-2 rounded-lg transition-all hover:bg-zinc-100 dark:hover:bg-white/5",
              theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
            )}>
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 ml-1">
                  AI Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProvider('gemini')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border transition-all",
                      provider === 'gemini'
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                        : theme === 'dark' ? "bg-white/[0.03] border-white/5 text-zinc-500 hover:border-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Google Gemini
                  </button>
                  <button
                    onClick={() => setProvider('openai')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border transition-all",
                      provider === 'openai'
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                        : theme === 'dark' ? "bg-white/[0.03] border-white/5 text-zinc-500 hover:border-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    OpenAI GPT
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 ml-1">
                  {provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? "Paste your Gemini API key here..." : "Paste your OpenAI API key here..."}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm font-mono outline-none border transition-all",
                    theme === 'dark' 
                      ? "bg-white/[0.03] border-white/10 focus:border-emerald-500/50 text-white placeholder:text-zinc-700" 
                      : "bg-zinc-50 border-zinc-200 focus:border-emerald-500/50 text-zinc-900 placeholder:text-zinc-300"
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 ml-1">
                  Sidebar Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPosition('left')}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border transition-all",
                      position === 'left'
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                        : theme === 'dark' ? "bg-white/[0.03] border-white/5 text-zinc-500 hover:border-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    Left
                  </button>
                  <button
                    onClick={() => setPosition('right')}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold border transition-all",
                      position === 'right'
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500"
                        : theme === 'dark' ? "bg-white/[0.03] border-white/5 text-zinc-500 hover:border-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                    )}
                  >
                    Right
                  </button>
                </div>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl flex items-start gap-3 border",
              theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-50 border-zinc-100"
            )}>
              <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Switching providers will change how the AI responds. Your key is stored locally and never leaves your browser.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaved}
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100",
                isSaved 
                  ? "bg-emerald-500 text-black" 
                  : theme === 'dark' ? "bg-white text-black" : "bg-zinc-900 text-white"
              )}
            >
              {isSaved ? 'Settings Saved' : 'Save Configuration'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
