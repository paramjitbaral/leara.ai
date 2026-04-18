import React from 'react';
import { Globe, RotateCcw, ExternalLink, X, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../lib/utils';

export function Preview() {
  const { previewUrl, setPreviewUrl, setIsPreviewOpen, theme } = useStore();

  if (!previewUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-zinc-500 gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <Globe className="w-6 h-6 opacity-20" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">No active preview</p>
          <p className="text-xs opacity-60">Run a dev server in the Browser Shell to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded border border-white/5 max-w-[300px]">
            <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="text-[10px] font-mono text-zinc-400 truncate">{previewUrl}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
              if (iframe) iframe.src = previewUrl;
            }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
            title="Reload Preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <a 
            href={previewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button 
            onClick={() => {
              setIsPreviewOpen(false);
              setPreviewUrl(null);
            }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
            title="Close Preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Iframe */}
      <div className="flex-1 bg-white relative">
        <iframe 
          id="preview-iframe"
          src={previewUrl} 
          className="w-full h-full border-none"
          title="WebContainer Preview"
        />
      </div>
    </div>
  );
}
