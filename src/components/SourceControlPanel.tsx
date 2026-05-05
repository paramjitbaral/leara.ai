import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Github, RefreshCw, Upload, Download, Plus, Check, FileCode2, Link, LogOut, Layers, ChevronDown, ChevronRight, X, Undo2, Minus } from 'lucide-react';

interface GitStatusFile {
  path: string;
  index: string;
  working_dir: string;
}

interface GitStatus {
  current: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
}

interface GitHubAuthState {
  connected: boolean;
  login: string | null;
}

interface RemoteInfo {
  name: string;
  fetch: string;
  push: string;
}

export function SourceControlPanel() {
  const { userId, activeProject, theme, lastStatusUpdateTime, modifiedFiles } = useStore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [diffFile, setDiffFile] = useState('');
  const [diffText, setDiffText] = useState('');
  const [auth, setAuth] = useState<GitHubAuthState>({ connected: false, login: null });
  const [showConnect, setShowConnect] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [remoteUrl, setRemoteUrl] = useState('');

  const folder = activeProject?.folderName;

  const fetchStatus = async () => {
    if (!folder) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/scm/status?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
      setStatus(res.data);
      
      // Update global change list
      const allFiles = res.data?.files || [];
      const filtered = allFiles.filter((f: any) => {
        const p = f.path.toLowerCase();
        return !p.includes('.leara/') && !p.includes('microsoft/windows/') && !p.includes('node_modules/') && !p.includes('.ds_store');
      });
      const paths = filtered.map((f: any) => f.path);
      useStore.getState().setScmChangedFiles(paths);
      
    } catch (err: any) {
      toast.error('SCM status failed', { description: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAuth();
    fetchRemotes();
  }, [folder, userId, lastStatusUpdateTime]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'leara-github-auth') return;
      if (!oauthState || data.state !== oauthState) return;

      setOauthConnecting(false);
      setOauthState(null);
      if (data.success) {
        setAuth({ connected: true, login: data.login || null });
        toast.success(`Connected GitHub: ${data.login || 'account'}`);
      } else {
        toast.error('GitHub connect failed', { description: data.error || 'Unknown OAuth error' });
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [oauthState]);

  const fetchAuth = async () => {
    if (!folder) return;
    try {
      const res = await axios.get(`/api/github/auth/status?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
      setAuth(res.data || { connected: false, login: null });
    } catch {
      setAuth({ connected: false, login: null });
    }
  };

  const fetchRemotes = async () => {
    if (!folder) return;
    try {
      const res = await axios.get(`/api/scm/remotes?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
      setRemotes(res.data?.remotes || []);
    } catch {
      setRemotes([]);
    }
  };

  const connectGitHubWithPat = async () => {
    if (!tokenInput.trim()) {
      toast.error('GitHub token required');
      return;
    }
    try {
      const res = await axios.post('/api/github/auth/connect', {
        userId,
        folder,
        token: tokenInput.trim(),
      });
      setAuth({ connected: true, login: res.data?.login || null });
      setTokenInput('');
      setShowConnect(false);
      toast.success(`Connected GitHub: ${res.data?.login || 'account'}`);
    } catch (err: any) {
      toast.error('GitHub connect failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const connectGitHub = async () => {
    if (!folder) return;
    setOauthConnecting(true);
    try {
      const res = await axios.post('/api/github/auth/oauth/start', { userId, folder });
      const state = res.data?.state;
      const authUrl = res.data?.authUrl;
      if (!state || !authUrl) {
        throw new Error('OAuth start response missing fields');
      }

      setOauthState(state);
      const popup = window.open(authUrl, 'leara-github-auth', 'width=700,height=780');
      if (!popup) {
        // Popup blocked; use polling fallback.
        const poll = async () => {
          for (let i = 0; i < 120; i += 1) {
            const check = await axios.get(`/api/github/auth/oauth/result?state=${encodeURIComponent(state)}`);
            if (check.data?.completed) {
              setOauthConnecting(false);
              setOauthState(null);
              if (check.data?.success) {
                setAuth({ connected: true, login: check.data?.login || null });
                toast.success(`Connected GitHub: ${check.data?.login || 'account'}`);
              } else {
                toast.error('GitHub connect failed', { description: check.data?.error || 'OAuth error' });
              }
              return;
            }
            await new Promise((r) => setTimeout(r, 1000));
          }
          setOauthConnecting(false);
          toast.error('GitHub login timed out');
        };
        poll();
        window.open(authUrl, '_blank');
      }
    } catch (err: any) {
      setOauthConnecting(false);
      toast.error('GitHub OAuth start failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const disconnectGitHub = async () => {
    try {
      await axios.post('/api/github/auth/disconnect', { userId, folder });
      setAuth({ connected: false, login: null });
      toast.success('GitHub disconnected');
    } catch (err: any) {
      toast.error('Disconnect failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const setOrigin = async () => {
    if (!remoteUrl.trim()) {
      toast.error('Remote URL required');
      return;
    }
    try {
      await axios.post('/api/scm/remotes/set', {
        userId,
        folder,
        name: 'origin',
        url: remoteUrl.trim(),
      });
      toast.success('Origin updated');
      setRemoteUrl('');
      fetchRemotes();
    } catch (err: any) {
      toast.error('Set remote failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const stageAll = async () => {
    try {
      await axios.post('/api/scm/stage', { userId, folder, paths: [] });
      toast.success('Staged changes');
      fetchStatus();
    } catch (err: any) {
      toast.error('Stage failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const handleStage = async (path: string) => {
    try {
      await axios.post('/api/scm/stage', { userId, folder, paths: [path] });
      toast.success(`Staged ${path}`);
      fetchStatus();
    } catch (err: any) {
      toast.error('Stage failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const handleUnstage = async (path: string) => {
    try {
      await axios.post('/api/scm/unstage', { userId, folder, paths: [path] });
      toast.success(`Unstaged ${path}`);
      fetchStatus();
    } catch (err: any) {
      toast.error('Unstage failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const handleDiscard = async (path: string) => {
    // 1. If it's an in-memory modification, we just reset the memory state
    if (modifiedFiles.has(path)) {
      const original = useStore.getState().originalContents[path];
      if (original !== undefined) {
        // Revert in-memory state
        useStore.getState().setModified(path, false);
        // If this is the active file, we might want to update the editor, 
        // but the setModified and store update should trigger a re-sync or the user can just see the M go away.
        // Actually, to be 'Elite', we should update the active file content too.
        const active = useStore.getState().activeFile;
        if (active && active.id === path) {
           useStore.getState().setActiveFile({ ...active, content: original });
        }
        toast.success(`Reverted ${path} to original state`);
        return;
      }
    }

    // 2. Otherwise, perform a Git discard (revert to last commit)
    if (!confirm(`Are you sure you want to discard all changes in ${path}? This cannot be undone.`)) return;
    try {
      await axios.post('/api/scm/discard', { userId, folder, paths: [path] });
      toast.success(`Discarded ${path}`);
      fetchStatus();
    } catch (err: any) {
      // If Git fails (e.g. untracked file), try to just reset memory as a fallback
      console.warn('Git discard failed, falling back to memory reset');
      useStore.getState().setModified(path, false);
      fetchStatus();
    }
  };

  const doCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Commit message required');
      return;
    }

    try {
      await axios.post('/api/scm/commit', { userId, folder, message: commitMessage.trim() });
      toast.success('Commit created');
      setCommitMessage('');
      fetchStatus();
    } catch (err: any) {
      toast.error('Commit failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const pull = async () => {
    if (!auth.connected) {
      toast.error('Connect GitHub first');
      setShowConnect(true);
      return;
    }
    try {
      await axios.post('/api/scm/pull', { userId, folder });
      toast.success('Pulled latest changes');
      fetchStatus();
    } catch (err: any) {
      toast.error('Pull failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const push = async () => {
    if (!auth.connected) {
      toast.error('Connect GitHub first');
      setShowConnect(true);
      return;
    }
    try {
      await axios.post('/api/scm/push', { userId, folder, approved: true });
      toast.success('Pushed changes');
      fetchStatus();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message;
      toast.error('Push failed', { description: msg });
    }
  };

  const loadDiff = async (filePath?: string) => {
    if (!folder) return;
    try {
      const suffix = filePath ? `&file=${encodeURIComponent(filePath)}` : '';
      const res = await axios.get(`/api/scm/diff?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}${suffix}`);
      setDiffFile(filePath || 'all');
      setDiffText(res.data?.diff || 'No diff output');
    } catch (err: any) {
      toast.error('Diff failed', { description: err?.response?.data?.error || err.message });
    }
  };

  if (!activeProject) {
    return <div className="p-4 text-[10px] text-zinc-500 uppercase tracking-wider font-sans">Open a project to use Source Control.</div>;
  }

  const filteredFiles = (status?.files || []).filter(f => {
    const p = f.path.toLowerCase();
    return !(p.includes('.leara/') || p.includes('microsoft/windows/') || p.includes('node_modules/') || p.includes('.ds_store'));
  });

  const stagedFiles = filteredFiles.filter(f => f.index !== ' ' && f.index !== '?');
  const gitModifiedPaths = new Set(filteredFiles.map(f => f.path));
  const changesFiles = [...filteredFiles.filter(f => f.working_dir !== ' ')];
  
  Array.from(modifiedFiles).forEach(path => {
    if (!gitModifiedPaths.has(path)) {
      const p = path.toLowerCase();
      if (!(p.includes('.leara/') || p.includes('microsoft/windows/') || p.includes('node_modules/') || p.includes('.ds_store'))) {
        changesFiles.push({
          path,
          index: ' ',
          working_dir: 'M'
        });
      }
    }
  });

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden">
      {/* Header */}
      <div className="h-9 border-b border-white/5 px-3 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-white" />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-300">GitHub SCM</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={fetchStatus} className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Auth status - Integrated into the top flow */}
        {!auth.connected ? (
          <div className="p-4 bg-emerald-500/[0.03] border-b border-white/5">
            <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
              Connect your GitHub account to sync changes, push to branches, and collaborate.
            </p>
            <button
              onClick={connectGitHub}
              disabled={oauthConnecting}
              className="w-full py-2.5 rounded-md bg-white text-black text-[10px] font-black uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <Github className="w-3.5 h-3.5" />
              {oauthConnecting ? 'Authorizing...' : 'Connect GitHub'}
            </button>
          </div>
        ) : (
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2 min-w-0">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
               <span className="text-[10px] font-bold text-zinc-400 truncate tracking-tight">{auth.login}</span>
            </div>
            <button onClick={disconnectGitHub} className="text-zinc-600 hover:text-red-400 p-1 transition-colors" title="Logout">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Commit Input Area */}
        <div className="p-3 space-y-2.5">
          <div className="relative group">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-white/5 rounded-md px-3 py-2 text-xs outline-none focus:border-emerald-500/40 resize-none placeholder:text-zinc-700 font-mono"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={doCommit}
              className="flex-1 py-1.5 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider rounded-md hover:bg-emerald-400 shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Commit
            </button>
            <button onClick={pull} className="p-2 rounded-md bg-[#252526] border border-white/5 text-zinc-400 hover:text-white transition-colors" title="Sync (Pull)"><Download className="w-3.5 h-3.5" /></button>
            <button onClick={push} className="p-2 rounded-md bg-[#252526] border border-white/5 text-zinc-400 hover:text-white transition-colors" title="Push Changes"><Upload className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Staged Changes Section */}
        {stagedFiles.length > 0 && (
          <div className="mt-2">
            <div className="px-3 py-1.5 flex items-center justify-between bg-emerald-500/[0.03] border-y border-white/5">
              <div className="flex items-center gap-2">
                 <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Staged Changes</span>
                 <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[9px] text-emerald-500 font-bold">{stagedFiles.length}</span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {stagedFiles.map((f) => (
                <FileRow 
                  key={f.path} 
                  file={f} 
                  loadDiff={loadDiff} 
                  onUnstage={handleUnstage} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Changes Section */}
        <div className="mt-2">
          <div className="px-3 py-1.5 flex items-center justify-between bg-white/[0.02] border-y border-white/5">
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Changes</span>
               <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-[9px] text-zinc-400 font-bold">{changesFiles.length}</span>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={stageAll} className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter">Stage All</button>
            </div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {changesFiles.length === 0 ? (
               <p className="p-4 text-[10px] text-zinc-600 italic text-center">No local changes.</p>
            ) : (
              changesFiles.map((f) => (
                <FileRow 
                  key={f.path} 
                  file={f} 
                  loadDiff={loadDiff} 
                  onStage={handleStage} 
                  onDiscard={handleDiscard}
                />
              ))
            )}
          </div>
        </div>

        {diffText && (
          <div className="m-3 border border-emerald-500/10 rounded-lg overflow-hidden bg-[#0a0a0a]">
            <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-emerald-500/[0.02] border-b border-white/5 flex items-center justify-between">
              <span className="truncate flex-1 mr-4">Diff: {diffFile}</span>
              <button onClick={() => setDiffText('')} className="hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
            </div>
            <pre className="p-3 text-[10px] overflow-x-auto max-h-[350px] whitespace-pre-wrap text-zinc-400 leading-relaxed no-scrollbar font-mono">
              {diffText}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info - Branch Status */}
      <div className="p-2 px-3 border-t border-white/5 flex items-center justify-between shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-3 text-[9px] font-bold text-zinc-500">
           <span className="flex items-center gap-1.5"><Download className="w-3 h-3 text-emerald-500/50"/> {status?.behind || 0}</span>
           <span className="flex items-center gap-1.5"><Upload className="w-3 h-3 text-emerald-500/50"/> {status?.ahead || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-tight">
            {status?.current || 'main'}
          </span>
        </div>
      </div>
    </div>
  );
}

function FileRow({ 
  file, 
  loadDiff, 
  onStage, 
  onUnstage, 
  onDiscard 
}: { 
  file: GitStatusFile, 
  loadDiff: (p: string) => void, 
  onStage?: (p: string) => void,
  onUnstage?: (p: string) => void,
  onDiscard?: (p: string) => void
}) {
  const statusChar = file.working_dir === 'A' ? 'A' : file.working_dir === 'M' ? 'M' : file.working_dir === 'D' ? 'D' : file.index !== ' ' ? file.index : '?';
  const statusColor = statusChar === 'A' ? 'text-emerald-400' : statusChar === 'M' ? 'text-amber-400' : statusChar === 'D' ? 'text-red-400' : 'text-zinc-500';

  return (
    <div className="group px-3 py-2 hover:bg-white/[0.02] transition-all flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <FileCode2 className="w-4 h-4 text-zinc-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] truncate text-zinc-300 font-bold tracking-tight">{file.path.split('/').pop()}</p>
          <p className="text-[9px] truncate text-zinc-600 font-mono tracking-tighter opacity-80">{file.path}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cn("text-[10px] font-black w-4 text-center select-none", statusColor)}>{statusChar}</span>
        <div className="flex items-center transition-opacity gap-1">
          {onUnstage && (
            <button onClick={() => onUnstage(file.path)} className="p-1 text-zinc-400 hover:text-white" title="Unstage Changes">
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
          {onDiscard && (
            <button onClick={() => onDiscard(file.path)} className="p-1 text-zinc-400 hover:text-red-400" title="Discard Changes">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onStage && (
            <button onClick={() => onStage(file.path)} className="p-1 text-emerald-500 hover:text-emerald-400" title="Stage File">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => loadDiff(file.path)} className="p-1 text-zinc-400 hover:text-white" title="View Changes">
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
