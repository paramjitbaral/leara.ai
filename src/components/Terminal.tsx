import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal as TerminalIcon, Trash2, Plus, RotateCcw, Search, Maximize2, Minimize2, X, Globe, Server, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { getWebContainer } from '../services/webcontainer';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  id: string;
  type: 'server' | 'browser';
  isActive: boolean;
}

function TerminalInstance({ id, type, isActive }: TerminalInstanceProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const {
    userId, theme, activeProject,
    setPreviewUrl, setIsPreviewOpen,
    terminalCommand, setTerminalCommand
  } = useStore();
  const [isBooting, setIsBooting] = useState(false);

  const inputHandlerRef = useRef<((data: string) => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Handle outside commands (only if active)
  useEffect(() => {
    if (isActive && terminalCommand && inputHandlerRef.current) {
      // Clear line then send command
      inputHandlerRef.current('\u0015' + terminalCommand + '\r');
      setTerminalCommand(null);
    }
  }, [terminalCommand, setTerminalCommand, isActive]);

  useEffect(() => {
    if (!terminalRef.current) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const term = new XTerm({
      theme: theme === 'dark' ? {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#333333',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#10b981',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#34d399',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      } : {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#333333',
        selectionBackground: '#add6ff',
        black: '#000000',
        red: '#cd3131',
        green: '#008000',
        yellow: '#795e26',
        blue: '#059669',
        magenta: '#af00db',
        cyan: '#001080',
        white: '#ffffff',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#34d399',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 11,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
      rows: 24,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(unicode11Addon);

    term.open(terminalRef.current);
    
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {}

    fitAddon.fit();
    xtermRef.current = term;

    if (type === 'server') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const folderParam = activeProject?.folderName ? `&folder=${activeProject.folderName}` : '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/terminal?userId=${userId}${folderParam}`);

      ws.onopen = () => {
        const { cols, rows } = term;
        // Use a unique prefix to prevent shell injection/echoing
        ws.send(`__resize__:${JSON.stringify({ cols, rows })}`);
        term.write('\r\n\x1b[32mConnected to terminal server\x1b[0m\r\n');
      };

      ws.onmessage = (event) => term.write(event.data);
      ws.onclose = () => term.write('\r\n\x1b[31mTerminal connection closed\x1b[0m\r\n');

      inputHandlerRef.current = (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      };

      const onDataDisposable = term.onData((data) => inputHandlerRef.current?.(data));

      cleanupRef.current = () => {
        ws.close();
        onDataDisposable.dispose();
      };
    } else {
      setIsBooting(true);
      term.write('\r\n\x1b[31mBooting WebContainer...\x1b[0m\r\n');
      let isCancelled = false;

      const boot = async () => {
        try {
          const wc = await getWebContainer();
          if (isCancelled) return;
          setIsBooting(false);
          const proc = await wc.spawn('jsh', { terminal: { cols: term.cols, rows: term.rows } });
          const writer = proc.input.getWriter();
          inputHandlerRef.current = (data) => writer.write(data);
          proc.output.pipeTo(new WritableStream({ write(data) { term.write(data); } }));
          const onDataDisposable = term.onData((data) => inputHandlerRef.current?.(data));
          
          cleanupRef.current = () => {
            proc.kill();
            onDataDisposable.dispose();
          };
        } catch (err: any) {
          setIsBooting(false);
          term.write(`\r\n\x1b[31mFailed: ${err.message}\x1b[0m\r\n`);
        }
      };
      boot();
      const orig = cleanupRef.current;
      cleanupRef.current = () => { isCancelled = true; if (orig) orig(); };
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(() => fitAddon.fit());
    ro.observe(terminalRef.current);

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      term.dispose();
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [userId, theme, activeProject, type]);

  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus();
    }
  }, [isActive]);

  return (
    <div className="h-full w-full relative">
      <div ref={terminalRef} className="h-full w-full p-2" />
      {isBooting && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/50 backdrop-blur-sm z-10">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
      )}
    </div>
  );
}

interface TerminalProps {
  onClose?: () => void;
}

export function Terminal({ onClose }: TerminalProps) {
  const { 
    terminals, activeTerminalId, addTerminal, removeTerminal, setActiveTerminalId, 
    theme 
  } = useStore();

  return (
    <div className={cn(
      "h-full flex flex-col font-mono text-sm overflow-hidden transition-colors duration-300",
      theme === 'dark' ? "bg-[#1e1e1e]" : "bg-white"
    )}>
      {/* Header / Tab Bar */}
      <div className={cn(
        "h-9 border-b flex items-center justify-between shrink-0",
        theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-zinc-50 border-zinc-200"
      )}>
        <div className="flex-1 flex items-center h-full overflow-x-auto no-scrollbar">
          {terminals.map((t, idx) => {
            const isActive = activeTerminalId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTerminalId(t.id)}
                className={cn(
                  "h-full px-4 flex items-center gap-2 border-r cursor-pointer transition-all min-w-[100px] max-w-[160px] group relative",
                  isActive 
                    ? (theme === 'dark' ? "bg-[#1e1e1e] text-emerald-500" : "bg-white text-emerald-600 shadow-[inset_0_-1px_0_white]") 
                    : (theme === 'dark' ? "bg-[#161616] text-zinc-500 hover:bg-[#1a1a1a] border-white/5" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 border-zinc-200")
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-tab"
                    className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500"
                  />
                )}
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-zinc-700"
                )} />
                <span className="truncate text-[10px] font-bold uppercase tracking-wider">
                  {t.name} {terminals.length > 1 ? idx + 1 : ''}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminal(t.id);
                  }}
                  className={cn(
                    "ml-auto opacity-0 group-hover:opacity-100 transition-all",
                    theme === 'dark' ? "hover:text-red-400" : "hover:text-red-500"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          
          <button
            onClick={() => addTerminal('server')}
            className={cn(
              "h-full px-3 flex items-center transition-all outline-none border-r",
              theme === 'dark' ? "text-zinc-600 hover:text-emerald-500 hover:bg-white/5 border-white/5" : "text-zinc-400 hover:text-emerald-600 hover:bg-black/5 border-zinc-200"
            )}
            title="Open New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-2">
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'dark' ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "hover:bg-black/5 text-zinc-400 hover:text-zinc-900"
              )}
              title="Close Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Viewports */}
      <div className="flex-1 relative overflow-hidden">
        {terminals.map((t) => (
          <div 
            key={t.id} 
            className={cn(
              "absolute inset-0 transition-opacity duration-200",
              activeTerminalId === t.id ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            )}
          >
            <TerminalInstance 
              id={t.id} 
              type={t.type} 
              isActive={activeTerminalId === t.id} 
            />
          </div>
        ))}

        {terminals.length === 0 && (
          <div className={cn(
            "h-full flex flex-col items-center justify-center gap-4",
            theme === 'dark' ? "text-zinc-600" : "text-zinc-400"
          )}>
            <TerminalIcon className="w-8 h-8 opacity-20" />
            <button 
              onClick={() => addTerminal('server')}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
            >
              Start New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
