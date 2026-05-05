import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal as TerminalIcon, Trash2, Plus, RotateCcw, Search, Maximize2, Minimize2, X, Globe, Server, Loader2, AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { useStore, Problem } from '../store';
import { getWebContainer } from '../services/webcontainer';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import '@xterm/xterm/css/xterm.css';

function ProblemsView() {
  const { problems, setActiveFile, setEditorScrollLine, theme, files } = useStore();

  const handleProblemClick = (problem: Problem) => {
    const findNode = (nodes: any[], id: string): any => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const f = findNode(n.children, id);
          if (f) return f;
        }
      }
      return null;
    };
    const node = findNode(files, problem.fileId);
    if (node) {
      setActiveFile(node);
      setEditorScrollLine(problem.line);
    }
  };

  if (problems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 animate-in fade-in duration-500">
        <Check className="w-8 h-8 text-emerald-500/50" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em]">No problems detected</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead className={cn(
          "sticky top-0 z-10 text-[9px] uppercase tracking-[0.15em] font-black",
          theme === 'dark' ? "bg-[#161616] text-zinc-500" : "bg-zinc-50 text-zinc-400"
        )}>
          <tr>
            <th className="px-4 py-3 border-b border-white/5 w-32">Severity</th>
            <th className="px-4 py-3 border-b border-white/5">Message</th>
            <th className="px-4 py-3 border-b border-white/5 w-48">File</th>
            <th className="px-4 py-3 border-b border-white/5 w-24 text-right">Line</th>
          </tr>
        </thead>
        <tbody className="text-[11px]">
          {problems.map((p) => (
            <tr 
              key={p.id}
              onClick={() => handleProblemClick(p)}
              className={cn(
                "cursor-pointer transition-colors group border-b border-white/[0.03]",
                theme === 'dark' ? "hover:bg-white/[0.03] text-zinc-300" : "hover:bg-zinc-50 text-zinc-700"
              )}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {p.severity === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  {p.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  {p.severity === 'info' && <Info className="w-3.5 h-3.5 text-blue-500" />}
                  <span className="capitalize font-medium">{p.severity}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 font-medium group-hover:text-emerald-400 transition-colors line-clamp-1">{p.message}</td>
              <td className="px-4 py-2.5 text-zinc-500 italic text-[10px]">{p.fileName}</td>
              <td className="px-4 py-2.5 text-zinc-500 text-right font-mono text-[10px]">{p.line}:{p.column}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [isReady, setIsReady] = useState(false);

  const inputHandlerRef = useRef<((data: string) => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Handle outside commands (only if active and ready)
  useEffect(() => {
    if (isActive && isReady && terminalCommand && inputHandlerRef.current) {
      // Send command directly
      inputHandlerRef.current(terminalCommand + '\r');
      setTerminalCommand(null);
    }
  }, [terminalCommand, setTerminalCommand, isActive, isReady]);

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
        green: '#107c10',
        yellow: '#856a00',
        blue: '#005fb8',
        magenta: '#af00db',
        cyan: '#005b70',
        white: '#333333',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#107c10',
        brightYellow: '#856a00',
        brightBlue: '#005fb8',
        brightMagenta: '#d670d6',
        brightCyan: '#005b70',
        brightWhite: '#1a1a1a',
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
    } catch (e) { }

    fitAddon.fit();
    xtermRef.current = term;

    const resizeObserver = new ResizeObserver(() => {
      if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(terminalRef.current);

    if (type === 'server') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const folderParam = activeProject?.folderName ? `&folder=${activeProject.folderName}` : '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/terminal?userId=${userId}${folderParam}`);

      ws.onopen = () => {
        const { cols, rows } = term;
        ws.send(`__resize__:${JSON.stringify({ cols, rows })}`);
        term.write('\r\n\x1b[32mConnected to terminal server\x1b[0m\r\n');
        setIsReady(true);
        fitAddon.fit();
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
          setIsReady(true);
          proc.output.pipeTo(new WritableStream({ write(data) { term.write(data); } }));
          const onDataDisposable = term.onData((data) => inputHandlerRef.current?.(data));

          cleanupRef.current = () => {
            isCancelled = true;
            proc.kill();
            onDataDisposable.dispose();
          };
        } catch (err: any) {
          setIsBooting(false);
          term.write(`\r\n\x1b[31mFailed: ${err.message}\x1b[0m\r\n`);
        }
      };
      boot();
    }

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [id, type, userId, theme, activeProject]);

  useEffect(() => {
    if (isActive && xtermRef.current) {
      setTimeout(() => xtermRef.current?.focus(), 100);
    }
  }, [isActive]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <div ref={terminalRef} className="h-full w-full" />
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
    theme, bottomPanelTab, setBottomPanelTab, problems
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
        <div className="flex items-center h-full border-r border-white/5 shrink-0">
          <button
            onClick={() => setBottomPanelTab('terminal')}
            className={cn(
              "h-full px-4 flex items-center gap-2 transition-all relative text-[10px] font-black uppercase tracking-widest",
              bottomPanelTab === 'terminal' 
                ? (theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-white text-zinc-900")
                : (theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600")
            )}
          >
            Terminal
            {bottomPanelTab === 'terminal' && (
              <motion.div layoutId="panel-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setBottomPanelTab('problems')}
            className={cn(
              "h-full px-4 flex items-center gap-2 transition-all relative text-[10px] font-black uppercase tracking-widest border-r border-white/5",
              bottomPanelTab === 'problems'
                ? (theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-white text-zinc-900")
                : (theme === 'dark' ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600")
            )}
          >
            Problems
            {problems.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold leading-none min-w-[14px] text-center">
                {problems.length}
              </span>
            )}
            {bottomPanelTab === 'problems' && (
              <motion.div layoutId="panel-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
            )}
          </button>
        </div>

        <div className="flex-1 flex items-center h-full overflow-x-auto no-scrollbar">
          {bottomPanelTab === 'terminal' && (
            <>
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
            </>
          )}
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
        {bottomPanelTab === 'terminal' ? (
          <>
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
          </>
        ) : (
          <ProblemsView />
        )}
      </div>
    </div>
  );
}
