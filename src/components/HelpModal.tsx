import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Info, Book, Github, MessageSquare, Zap, BrainCircuit, GraduationCap, Terminal as TerminalIcon } from 'lucide-react';
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
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-2xl p-6 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
          theme === 'dark' ? "bg-[#0a0a0a] border-white/5" : "bg-white border-zinc-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <Dialog.Title className={cn(
                  "text-xs font-black uppercase tracking-[0.2em]",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>Documentation Center</Dialog.Title>
              </div>
            </div>
            <Dialog.Close className={cn(
              "p-1.5 rounded-lg transition-all hover:bg-zinc-100 dark:hover:bg-white/5",
              theme === 'dark' ? "text-zinc-600" : "text-zinc-400"
            )}>
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
            <section className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-2 px-1">
                <Zap className="w-2.5 h-2.5" /> Core Intelligence
              </h3>
              <div className="space-y-2">
                {[
                  { title: 'Leara Core', desc: 'Integrated AI engineering companion.', icon: BrainCircuit },
                  { title: 'Learn Mode', desc: 'Socratic mentorship for code logic.', icon: GraduationCap },
                  { title: 'Terminal', desc: 'High-performance local/remote shell.', icon: TerminalIcon }
                ].map((f) => (
                  <div key={f.title} className={cn(
                    "relative p-3 rounded-xl border transition-all group overflow-hidden",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10" : "bg-zinc-50 border-zinc-100 hover:bg-zinc-100"
                  )}>
                    {/* Hover Accent Bar */}
                    <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-emerald-500 scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/5 flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 transition-colors">
                        <f.icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <h4 className={cn("text-[10px] font-black uppercase tracking-widest transition-colors mb-0.5", theme === 'dark' ? "text-zinc-200 group-hover:text-white" : "text-zinc-900 group-hover:text-emerald-600")}>{f.title}</h4>
                        <p className="text-[9px] text-zinc-600 font-bold max-w-[280px] leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                <Book className="w-3 h-3" /> Key Commands
              </h3>
              <div className="grid grid-cols-1 gap-1">
                {[
                  { label: 'Submit Prompt', key: 'Enter' },
                  { label: 'New Thread', key: 'Ctrl + K' },
                  { label: 'Format Code', key: 'Shift + Alt + F' }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center px-2 py-1.5 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-all group">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400 transition-colors">{item.label}</span>
                    <div className="flex gap-1">
                      {item.key.split('+').map((k, i) => (
                        <kbd key={i} className={cn(
                          "px-1.5 py-0.5 rounded-md text-[8px] font-black border tracking-tighter shadow-sm",
                          theme === 'dark' ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"
                        )}>{k.trim()}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-6 flex gap-2">
            <button className={cn(
              "flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-emerald-500/10 hover:border-emerald-500/20",
              theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-400 hover:text-emerald-500" : "bg-zinc-100 border-zinc-200 text-zinc-600"
            )}>
              <Github className="w-3 h-3 text-current" />
              OSS Source
            </button>
            <button className={cn(
              "flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-emerald-500/10 hover:border-emerald-500/20",
              theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-400 hover:text-emerald-500" : "bg-zinc-100 border-zinc-200 text-zinc-600"
            )}>
              <MessageSquare className="w-3 h-3 text-current" />
              Community
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
