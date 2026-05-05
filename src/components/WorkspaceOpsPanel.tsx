import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store';
import { toast } from 'sonner';
import { AlertTriangle, FlaskConical, Play, ListChecks, History, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export function WorkspaceOpsPanel() {
  const { userId, activeProject } = useStore();
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [tests, setTests] = useState<string[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const folder = activeProject?.folderName;

  const refreshJobsAndLogs = async () => {
    if (!folder) return;
    try {
      const [jobsRes, logsRes] = await Promise.all([
        axios.get('/api/terminals'),
        axios.get(`/api/actions/logs?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}&limit=100`),
      ]);
      setJobs(jobsRes.data?.jobs || []);
      setLogs(logsRes.data?.logs || []);
    } catch {
      // silent refresh
    }
  };

  useEffect(() => {
    refreshJobsAndLogs();
  }, [folder, userId]);

  const loadProblems = async () => {
    if (!folder) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/problems?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
      setDiagnostics(res.data?.diagnostics || []);
      toast.success('Problems refreshed');
    } catch (err: any) {
      toast.error('Problems failed', { description: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const discoverTestsNow = async () => {
    if (!folder) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/tests/discover?userId=${encodeURIComponent(userId)}&folder=${encodeURIComponent(folder)}`);
      setTests(res.data?.tests || []);
      toast.success('Test discovery complete');
    } catch (err: any) {
      toast.error('Test discovery failed', { description: err?.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const runTask = async (taskName: string) => {
    if (!folder) return;
    try {
      await axios.post('/api/tasks/run', { userId, folder, taskName, approved: true });
      toast.success(`Task started: ${taskName}`);
      refreshJobsAndLogs();
    } catch (err: any) {
      toast.error('Task failed', { description: err?.response?.data?.error || err.message });
    }
  };

  const runAllTests = async () => {
    if (!folder) return;
    try {
      await axios.post('/api/tests/run', { userId, folder });
      toast.success('Test run started');
      refreshJobsAndLogs();
    } catch (err: any) {
      toast.error('Run tests failed', { description: err?.response?.data?.error || err.message });
    }
  };

  if (!activeProject) {
    return <div className="p-4 text-[10px] text-zinc-500 uppercase tracking-wider">Open a project to use Workspace Ops.</div>;
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#cccccc]">
      <div className="h-9 border-b border-white/5 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Workspace Ops</span>
        </div>
        <button onClick={refreshJobsAndLogs} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-white" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 border-b border-white/5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={loadProblems} className="text-[9px] px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 uppercase font-black tracking-wider">Problems</button>
          <button onClick={discoverTestsNow} className="text-[9px] px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 uppercase font-black tracking-wider">Discover Tests</button>
          <button onClick={() => runTask('lint')} className="text-[9px] px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 uppercase font-black tracking-wider">Run Lint</button>
          <button onClick={() => runTask('build')} className="text-[9px] px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 uppercase font-black tracking-wider">Run Build</button>
          <button onClick={() => runTask('test')} className="text-[9px] px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 uppercase font-black tracking-wider">Run Task Test</button>
          <button onClick={runAllTests} className="text-[9px] px-2 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 uppercase font-black tracking-wider">Run Tests API</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="border-b border-white/5">
          <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" /> Problems ({diagnostics.length})
          </div>
          {diagnostics.slice(0, 20).map((d, i) => (
            <div key={i} className="px-3 py-2 border-t border-white/5 text-[10px]">
              <p className={cn('font-bold', d.severity === 'warning' ? 'text-amber-400' : 'text-red-400')}>{d.source} {d.severity}</p>
              <p className="text-zinc-500">{d.file ? `${d.file}:${d.line || 1}:${d.column || 1}` : 'general'}</p>
              <p className="text-zinc-300 mt-1">{d.message}</p>
            </div>
          ))}
        </section>

        <section className="border-b border-white/5">
          <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
            <FlaskConical className="w-3 h-3" /> Tests ({tests.length})
          </div>
          {tests.slice(0, 30).map((t, i) => (
            <div key={i} className="px-3 py-1.5 border-t border-white/5 text-[10px] text-zinc-300">{t}</div>
          ))}
        </section>

        <section className="border-b border-white/5">
          <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
            <Play className="w-3 h-3" /> Jobs ({jobs.length})
          </div>
          {jobs.slice(-20).reverse().map((j) => (
            <div key={j.id} className="px-3 py-2 border-t border-white/5 text-[10px]">
              <p className="text-zinc-300 truncate">{j.command}</p>
              <p className={cn('uppercase text-[9px] font-bold', j.status === 'completed' ? 'text-emerald-400' : j.status === 'running' ? 'text-blue-400' : 'text-red-400')}>{j.status}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="px-3 py-2 text-[9px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
            <History className="w-3 h-3" /> Action Logs ({logs.length})
          </div>
          {logs.slice(-20).reverse().map((l, i) => (
            <div key={i} className="px-3 py-2 border-t border-white/5 text-[10px]">
              <p className="text-zinc-300 uppercase">{l.scope} · {l.action}</p>
              <p className={cn('text-[9px] uppercase font-bold', l.status === 'ok' ? 'text-emerald-400' : 'text-red-400')}>{l.status}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
