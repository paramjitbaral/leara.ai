import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Info, Book, Github, MessageSquare, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { theme } = useStore();

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg border rounded-3xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
          theme === 'dark' ? "bg-[#0c0c0c] border-white/10" : "bg-white border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className={cn(
                  "text-lg font-semibold tracking-tight",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>Help & Documentation</Dialog.Title>
                <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                  Master your AI-powered workspace
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

          <div className="space-y-8 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
            <section className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Getting Started</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className={cn(
                  "p-4 rounded-2xl border flex gap-4 transition-all",
                  theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-50 border-zinc-100"
                )}>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-bold mb-1", theme === 'dark' ? "text-white" : "text-zinc-900")}>AI Copilot</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">Use the right panel to chat with AI about your code. It can explain, fix bugs, and generate new features.</p>
                  </div>
                </div>
                <div className={cn(
                  "p-4 rounded-2xl border flex gap-4 transition-all",
                  theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-50 border-zinc-100"
                )}>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <Book className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-bold mb-1", theme === 'dark' ? "text-white" : "text-zinc-900")}>Learning Mode</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">Click the "Learn" button in the top bar to enter an interactive mentorship session for the active file.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Keyboard Shortcuts</h3>
              <div className="space-y-2">
                {[
                  { label: 'Send Message', key: 'Enter' },
                  { label: 'New Line', key: 'Shift + Enter' },
                  { label: 'Toggle Sidebar', key: 'Ctrl + B' }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center p-3 hover:bg-zinc-500/5 rounded-xl transition-colors">
                    <span className="text-xs text-zinc-500">{item.label}</span>
                    <kbd className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold border",
                      theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"
                    )}>{item.key}</kbd>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Community & Support</h3>
              <div className="flex gap-3">
                <button className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                  theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"
                )}>
                  <Github className="w-4 h-4" />
                  GitHub
                </button>
                <button className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]",
                  theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-zinc-100 border-zinc-200 text-zinc-900"
                )}>
                  <MessageSquare className="w-4 h-4" />
                  Discord
                </button>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-500/10 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold opacity-50">Leara.ai v1.0.0 • Made with ❤️</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
