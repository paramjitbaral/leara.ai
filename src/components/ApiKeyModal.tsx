import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const { userApiKey, setUserApiKey, theme } = useStore();
  const [tempKey, setTempKey] = useState(userApiKey || '');
  const [isSaved, setIsSaved] = useState(false);

  // Sync tempKey when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempKey(userApiKey || '');
      setIsSaved(false);
    }
  }, [isOpen, userApiKey]);

  const handleSave = () => {
    if (!tempKey.trim()) return;
    setUserApiKey(tempKey);
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
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className={cn(
                  "text-lg font-semibold tracking-tight",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>API Configuration</Dialog.Title>
                <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                  Securely store your provider credentials
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
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 ml-1">
                Provider API Key
              </label>
              <div className="relative group">
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="sk-..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm font-mono outline-none border transition-all",
                    theme === 'dark' 
                      ? "bg-white/[0.03] border-white/10 focus:border-emerald-500/50 text-white placeholder:text-zinc-700" 
                      : "bg-zinc-50 border-zinc-200 focus:border-emerald-500/50 text-zinc-900 placeholder:text-zinc-300"
                  )}
                  autoFocus
                />
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl flex items-start gap-3 border",
              theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-50 border-zinc-100"
            )}>
              <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Your key is stored locally and never leaves your browser. It enables custom AI providers like OpenAI and Anthropic.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaved || !tempKey.trim()}
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100",
                isSaved 
                  ? "bg-emerald-500 text-black" 
                  : theme === 'dark' ? "bg-white text-black" : "bg-zinc-900 text-white"
              )}
            >
              {isSaved ? 'Configuration Saved' : 'Update Credentials'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
