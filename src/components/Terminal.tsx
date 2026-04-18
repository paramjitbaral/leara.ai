import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal as TerminalIcon, Trash2, Search, Maximize2, Minimize2, X, Globe, Server, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { getWebContainer, spawnTerminal } from '../services/webcontainer';
import { cn } from '../lib/utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onClose?: () => void;
}

export function Terminal({ onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const { 
    userId, theme, activeProject, 
    terminalType, setTerminalType,
    setPreviewUrl, setIsPreviewOpen 
  } = useStore();
  const [isBooting, setIsBooting] = useState(false);

  const shellProcessRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Clear existing cleanup
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
      fontSize: 12,
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
    term.focus();
    
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon could not be loaded, falling back to canvas renderer');
    }

    fitAddon.fit();

    xtermRef.current = term;

    if (terminalType === 'server') {
      // Connect to WebSocket (Server Shell)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const folderParam = activeProject?.folderName ? `&folder=${activeProject.folderName}` : '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/terminal?userId=${userId}${folderParam}`);

      ws.onopen = () => {
        term.write('\r\n\x1b[32mConnected to terminal server\x1b[0m\r\n');
        term.write('\x1b[33mNote: Port 3000 is reserved for the AI Code Mentor app itself.\x1b[0m\r\n');
        term.write('\x1b[33mTo run your own code, use other ports or non-server commands.\x1b[0m\r\n');
        term.write('\x1b[33mThis is a real shell in your workspace container.\x1b[0m\r\n\r\n');
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        term.write('\r\n\x1b[31mTerminal connection closed\x1b[0m\r\n');
      };

      const onDataDisposable = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      cleanupRef.current = () => {
        ws.close();
        onDataDisposable.dispose();
      };
    } else {
      // Connect to WebContainer (Browser Shell)
      setIsBooting(true);
      term.write('\r\n\x1b[32mBooting WebContainer...\x1b[0m\r\n');
      
      let isCancelled = false;

      const bootWebContainer = async () => {
        try {
          const wc = await getWebContainer();
          if (isCancelled) return;

          setIsBooting(false);
          term.write('\x1b[32mWebContainer booted successfully!\x1b[0m\r\n');
          term.write('\x1b[33mThis shell runs entirely in your browser memory.\x1b[0m\r\n');
          term.write('\x1b[33mIt supports offline execution once loaded.\x1b[0m\r\n\r\n');

          const shellProcess = await wc.spawn('jsh', {
            terminal: {
              cols: term.cols,
              rows: term.rows,
            },
          });
          
          if (isCancelled) {
            shellProcess.kill();
            return;
          }

          shellProcessRef.current = shellProcess;

          const writer = shellProcess.input.getWriter();
          
          shellProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                term.write(data);
              },
            })
          );

          const onDataDisposable = term.onData((data) => {
            writer.write(data);
          });

          const onServerReady = (port: number, url: string) => {
            term.write(`\r\n\x1b[32mServer ready on port ${port}: ${url}\x1b[0m\r\n`);
            setPreviewUrl(url);
            setIsPreviewOpen(true);
          };

          wc.on('server-ready', onServerReady);

          cleanupRef.current = () => {
            shellProcess.kill();
            onDataDisposable.dispose();
            // Note: we don't remove the listener easily here without a ref, but it's okay for now
          };
        } catch (err: any) {
          if (isCancelled) return;
          setIsBooting(false);
          term.write(`\r\n\x1b[31mFailed to boot WebContainer: ${err.message}\x1b[0m\r\n`);
        }
      };

      bootWebContainer();
      
      const originalCleanup = cleanupRef.current;
      cleanupRef.current = () => {
        isCancelled = true;
        if (originalCleanup) originalCleanup();
      };
    }

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      term.dispose();
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [userId, theme, activeProject, terminalType, setPreviewUrl, setIsPreviewOpen]);

  return (
    <div className="h-full flex flex-col font-mono text-sm overflow-hidden bg-[#1e1e1e]">
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="font-bold uppercase text-[10px] tracking-wider text-zinc-400">Terminal</span>
          </div>

          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => setTerminalType('server')}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-all uppercase tracking-tight",
                terminalType === 'server' 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Server className="w-3 h-3" />
              Server Shell
            </button>
            <button
              onClick={() => setTerminalType('browser')}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-all uppercase tracking-tight",
                terminalType === 'browser' 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Globe className="w-3 h-3" />
              Browser Shell (WebContainer)
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBooting && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
          <button 
            onClick={() => xtermRef.current?.clear()} 
            className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
            title="Clear Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
              title="Close Terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 bg-[#1e1e1e] p-2 overflow-hidden">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
