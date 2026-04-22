import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Key, ShieldCheck, Eye, EyeOff, Check, Cpu, Globe, Monitor, Settings2, Command, Link } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const { 
    userApiKey, setUserApiKey, 
    providerKeys, setProviderKey,
    aiProvider, setAiProvider,
    aiModel, setAiModel,
    aiEndpoint, setAiEndpoint,
    theme 
  } = useStore();

  const [tempKey, setTempKey] = useState(providerKeys[aiProvider] || userApiKey || '');
  const [provider, setProvider] = useState(aiProvider);
  const [model, setModel] = useState(aiModel);
  const [endpoint, setEndpoint] = useState(aiEndpoint || '');
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(aiProvider);
      setTempKey(providerKeys[aiProvider] || userApiKey || '');
      setModel(aiModel);
      setEndpoint(aiEndpoint || '');
      setIsSaved(false);
      setTestResult(null);
    }
  }, [isOpen, userApiKey, aiProvider, aiModel, aiEndpoint, providerKeys]);

  // Update tempKey when provider selector changes locally
  useEffect(() => {
    setTempKey(providerKeys[provider] || '');
    setTestResult(null);
  }, [provider, providerKeys]);

  const handleSave = () => {
    setProviderKey(provider, tempKey);
    setAiProvider(provider);
    setAiModel(model);
    setAiEndpoint(endpoint);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const testConnection = async () => {
    if (!tempKey && provider !== 'ollama') return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'Respond with "OK" if alive.', 
          context: { fileName: 'test.js', content: '' }, 
          provider: provider, 
          apiKey: tempKey,
          model: model,
          endpoint: endpoint,
          systemInstruction: 'Test connection'
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTestResult('success');
    } catch (err) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const providers = [
    { id: 'gemini', label: 'Gemini AI', icon: Globe, desc: 'Google Generative AI' },
    { id: 'openai', label: 'OpenAI', icon: Cpu, desc: 'GPT-4 & GPT-3.5 API' },
    { id: 'ollama', label: 'Ollama', icon: Monitor, desc: 'Local LLM Server' },
    { id: 'custom', label: 'Custom SDK', icon: Link, desc: 'OpenAI-Compatible proxy' },
  ];

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[600px] border shadow-2xl z-[101] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 outline-none",
          theme === 'dark' ? "bg-[#0c0c0c] border-white/10 rounded-2xl" : "bg-white border-zinc-200 rounded-2xl"
        )}>
          <div className="flex h-full">
            {/* Left Sidebar */}
            <div className={cn(
               "w-[240px] border-r flex flex-col px-4 py-8 shrink-0",
               theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-zinc-50 border-zinc-100"
            )}>
              <div className="flex items-center gap-3 px-2 mb-8">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500",
                  theme === 'dark' ? "bg-emerald-500/10" : "bg-emerald-50"
                )}>
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={cn("text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-zinc-900")}>Config</h2>
                </div>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-4 px-2">AI Providers</p>
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id as any)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group active:scale-95",
                      provider === p.id 
                        ? (theme === 'dark' ? "bg-white/10 text-white shadow-lg" : "bg-white text-zinc-900 shadow-md border border-zinc-200")
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                    )}
                  >
                    <p.icon className={cn("w-4 h-4", provider === p.id ? "text-emerald-400" : "text-zinc-600 transition-colors group-hover:text-zinc-400")} />
                    <div className="text-left">
                      <p className="text-[11px] font-bold tracking-tight">{p.label}</p>
                      <p className="text-[9px] text-zinc-500 font-medium leading-none mt-0.5">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className={cn(
                  "p-3 rounded-xl border flex items-center gap-3",
                  theme === 'dark' ? "bg-emerald-500/[0.03] border-emerald-500/10" : "bg-emerald-50 border-emerald-100"
                )}>
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-[9px] text-zinc-500 font-bold leading-tight uppercase">Encryption: AES-256</p>
                </div>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-transparent">
              <div className="px-8 py-8 flex-1 overflow-y-auto space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn("text-lg font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {providers.find(p => p.id === provider)?.label} Settings
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">Configure your {provider} endpoint and credentials</p>
                  </div>
                  <Dialog.Close className="p-2 rounded-xl text-zinc-500 hover:bg-white/5 transition-all">
                    <X className="w-5 h-5" />
                  </Dialog.Close>
                </div>

                <div className="space-y-6">
                  {/* Universal Advanced Settings Toggle */}
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-2 px-1"
                  >
                    {showAdvanced ? 'Hide Advanced Config' : 'Show Advanced Config (Model/Endpoint)'}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">Base URL Endpoint</label>
                          {provider === 'custom' && <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">OpenAI-Compatible</span>}
                        </div>
                        <div className={cn(
                          "flex items-center border transition-all h-11",
                          theme === 'dark' ? "bg-white/[0.03] border-white/5 rounded-xl focus-within:border-emerald-500/50" : "bg-zinc-50 border-zinc-200 rounded-xl focus-within:border-emerald-500/50"
                        )}>
                          <Link className="ml-4 w-4 h-4 text-zinc-600" />
                          <input 
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            className="w-full px-4 outline-none bg-transparent text-[11px] font-bold tracking-wide"
                            placeholder="https://api.openai.com/v1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 ml-1 tracking-widest uppercase">Target Model</label>
                          <div className={cn(
                             "flex items-center border h-11",
                             theme === 'dark' ? "bg-white/[0.03] border-white/5 rounded-xl" : "bg-zinc-50 border-zinc-200 rounded-xl"
                           )}>
                            <Monitor className="ml-4 w-4 h-4 text-zinc-600" />
                            <input 
                              value={model}
                              onChange={(e) => setModel(e.target.value)}
                              className="w-full px-4 outline-none bg-transparent text-[11px] font-bold tracking-wide"
                              placeholder="e.g. gpt-4-turbo"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 ml-1 tracking-widest uppercase">Connection Test</label>
                          <button 
                            onClick={testConnection}
                            disabled={isTesting}
                            className={cn(
                              "w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                              testResult === 'success' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                              testResult === 'error' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                              (theme === 'dark' ? "bg-white/5 text-zinc-400 hover:bg-white/10" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
                            )}
                          >
                             {isTesting ? 'Testing...' : testResult === 'success' ? 'Connected' : testResult === 'error' ? 'Failed' : 'Ping Endpoint'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">API Access Key</label>
                      {!showAdvanced && (
                        <button 
                          onClick={testConnection}
                          disabled={isTesting || (!tempKey && provider !== 'ollama')}
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-all",
                            testResult === 'success' ? "text-emerald-500 bg-emerald-500/10" :
                            testResult === 'error' ? "text-red-500 bg-red-500/10" :
                            "text-zinc-500 hover:text-white"
                          )}
                        >
                          {isTesting ? 'Testing...' : testResult === 'success' ? 'Connected' : testResult === 'error' ? 'Failed' : 'Quick Test'}
                        </button>
                      )}
                    </div>
                    <div className={cn(
                      "relative flex items-center border h-11",
                      theme === 'dark' ? "bg-white/[0.03] border-white/5 rounded-xl focus-within:border-emerald-500/50" : "bg-zinc-50 border-zinc-200 rounded-xl focus-within:border-emerald-500/50"
                    )}>
                      <Key className="ml-4 w-4 h-4 text-zinc-600" />
                      <input
                        type={showKey ? "text" : "password"}
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                        className="w-full px-4 text-[11px] font-mono outline-none bg-transparent"
                        placeholder={provider === 'ollama' ? 'Optional for local' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'}
                      />
                      <button onClick={() => setShowKey(!showKey)} className="mr-3 p-1.5 rounded-lg text-zinc-600 hover:text-white transition-all">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Saved Credentials</p>
                    <span className="text-[10px] text-zinc-600 font-bold tracking-tighter uppercase px-2 py-0.5 bg-white/5 rounded">Local Storage</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {providers.map((p) => {
                      const hasKey = providerKeys[p.id];
                      return (
                        <div 
                          key={p.id} 
                          role="button"
                          onClick={() => setProvider(p.id as any)}
                          className={cn(
                            "px-4 py-3 rounded-xl border flex items-center justify-between group cursor-pointer h-[50px] transition-all active:scale-[0.98]",
                            provider === p.id 
                              ? (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/50" : "bg-emerald-50 border-emerald-200")
                              : (theme === 'dark' ? "bg-white/[0.01] border-white/5 hover:border-white/10" : "bg-zinc-50 border-zinc-100 hover:border-zinc-200")
                          )}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <p.icon className={cn("w-3.5 h-3.5 shrink-0", hasKey ? "text-emerald-500" : "text-zinc-700")} />
                            <div className="overflow-hidden">
                              <p className={cn(
                                "text-[10px] font-bold leading-none truncate uppercase tracking-tight",
                                provider === p.id ? "text-emerald-500" : (theme === 'dark' ? "text-white" : "text-zinc-900")
                              )}>{p.label}</p>
                              <p className="text-[9px] text-zinc-600 font-medium leading-none mt-1 truncate">
                                {hasKey ? `••••${providerKeys[p.id].slice(-4)}` : 'Not Configured'}
                              </p>
                            </div>
                          </div>
                          {hasKey && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-white/[0.05] flex items-center justify-end gap-3 bg-white/[0.005]">
                <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">Discard</button>
                <button
                   onClick={handleSave}
                   disabled={isSaved}
                   className={cn(
                     "px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg",
                     isSaved ? "bg-emerald-500 text-white" : (theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-black")
                   )}
                 >
                   {isSaved ? 'Synchronized' : 'Apply Settings'}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
