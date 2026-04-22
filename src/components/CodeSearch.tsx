import React, { useState } from 'react';
import { useStore } from '../store';
import { Search, Replace, ChevronRight, ChevronDown, File, CaseSensitive, WholeWord, Regex, X, ArrowRight, Check, Layout, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

export function CodeSearch() {
  const { userId, activeProject, theme, setActiveFile, setEditorHighlightQuery, setSidebarTab } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [options, setOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    regex: false
  });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeProject) return;
    setLoading(true);
    setResults([]); // Clear results immediately to show loading state
    try {
      const res = await axios.post('/api/search/content', {
        userId,
        path: activeProject.folderName,
        query: searchQuery,
        options
      });
      setResults(res.data);
      // Automatically expand first 5 files
      setExpandedFiles(new Set(res.data.slice(0, 5).map((f: any) => f.file)));
      
      if (res.data.length === 0) {
        toast.info('No results found', {
          description: 'Try disabling Case Sensitive or Whole Word toggles.'
        });
      }
    } catch (err) {
      toast.error('Search failed', {
        description: 'The server encountered an error while scanning files.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceAll = async () => {
    if (!searchQuery.trim() || !activeProject || results.length === 0) return;
    setLoading(true);
    try {
      await axios.post('/api/replace/content', {
        userId,
        path: activeProject.folderName,
        query: searchQuery,
        replace: replaceQuery,
        options,
        files: results.map(r => r.file)
      });
      toast.success(`Replaced matches in ${results.length} files`);
      handleSearch(); // Refresh search
    } catch (err) {
      toast.error('Replace failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) newExpanded.delete(file);
    else newExpanded.add(file);
    setExpandedFiles(newExpanded);
  };

  const openMatch = async (file: string, match: any) => {
    try {
      const res = await axios.get(`/api/files/content?userId=${userId}&path=${file}`);
      const ext = file.split('.').pop()?.toLowerCase() || 'js';
      setActiveFile({
        id: file,
        name: file.split('/').pop() || '',
        type: 'file',
        content: res.data.content,
        language: ext === 'ts' || ext === 'tsx' ? 'typescript' : 'javascript'
      });
      setEditorHighlightQuery(searchQuery);
    } catch (err) {
      toast.error('Could not open file');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] select-none">
      <div className="p-4 space-y-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarTab('explorer')}
              className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-white transition-colors"
              title="Back to Explorer"
            >
              <Layout className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Global Search</span>
          </div>
          <div className="flex items-center gap-1">
             <button 
              onClick={() => setIsReplaceOpen(!isReplaceOpen)}
              className={cn(
                "p-1 rounded transition-all active:scale-90",
                isReplaceOpen ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-white"
              )}
              title="Toggle Replace"
            >
              <Replace className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {/* Search Input Area */}
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center">
                 <Search className={cn("w-3.5 h-3.5 transition-colors", loading ? "text-emerald-500 animate-pulse" : "text-zinc-500")} />
              </div>
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search files..."
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-md py-1.5 pl-8 pr-20 text-xs outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button 
                  onClick={() => setOptions({...options, caseSensitive: !options.caseSensitive})}
                  className={cn("p-1 rounded hover:bg-white/5 transition-colors", options.caseSensitive ? "text-emerald-400" : "text-zinc-600")}
                  title="Match Case"
                >
                  <CaseSensitive className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setOptions({...options, wholeWord: !options.wholeWord})}
                  className={cn("p-1 rounded hover:bg-white/5 transition-colors", options.wholeWord ? "text-emerald-400" : "text-zinc-600")}
                  title="Match Whole Word"
                >
                  <WholeWord className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setOptions({...options, regex: !options.regex})}
                  className={cn("p-1 rounded hover:bg-white/5 transition-colors", options.regex ? "text-emerald-400" : "text-zinc-600")}
                  title="Use Regular Expression"
                >
                  <Regex className="w-3 h-3" />
                </button>
              </div>
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-1 active:scale-95 shadow-lg"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Find'}
            </button>
          </div>

          {/* Replace Input */}
          {isReplaceOpen && (
            <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
              <div className="relative flex-1">
                <input 
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace"
                  className="w-full bg-[#0a0a0a] border border-white/5 rounded-md py-1.5 px-3 text-xs outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                />
              </div>
              <button 
                onClick={handleReplaceAll}
                disabled={loading || results.length === 0}
                className="px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
              >
                <Replace className="w-3 h-3" /> All
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="p-8 text-center space-y-3">
             <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
             <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Scanning Codebase...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-1 px-2">
            <p className="px-2 pb-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              Found {results.reduce((acc, curr) => acc + curr.matches.length, 0)} results in {results.length} files
            </p>
            {results.map((fileRes) => (
              <div key={fileRes.file} className="space-y-0.5">
                <div 
                  onClick={() => toggleFile(fileRes.file)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-md cursor-pointer group transition-colors"
                >
                  <ChevronRight className={cn("w-3 h-3 text-zinc-600 transition-transform", expandedFiles.has(fileRes.file) && "rotate-90")} />
                  <File className="w-3.5 h-3.5 text-emerald-500/70" />
                  <span className="text-[11px] font-bold truncate flex-1">{fileRes.file.split('/').pop()}</span>
                  <span className="text-[9px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{fileRes.matches.length}</span>
                </div>
                {expandedFiles.has(fileRes.file) && (
                  <div className="ml-5 space-y-0.5 border-l border-white/5">
                    {fileRes.matches.map((match: any, mIdx: number) => (
                      <div 
                        key={mIdx}
                        onClick={() => openMatch(fileRes.file, match)}
                        className="group flex flex-col gap-0.5 px-3 py-1.5 hover:bg-emerald-500/5 cursor-pointer transition-all border-l-2 border-transparent hover:border-emerald-500"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-600 font-mono">Line {match.line}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono truncate opacity-60 group-hover:opacity-100 transition-opacity">
                          {match.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : searchQuery && (
          <div className="p-8 text-center text-zinc-600">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]">No matches found</p>
          </div>
        )}
      </div>
    </div>
  );
}
