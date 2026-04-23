import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Key, ShieldCheck, Eye, EyeOff, Cpu, Globe, Monitor, Settings2, Link, Trash2, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore, AIPreset } from '../store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const {
    userApiKey,
    providerKeys, setProviderKey,
    aiProvider, setAiProvider,
    aiModel, setAiModel,
    aiEndpoint, setAiEndpoint,
    aiPresets, setAiPresets,
    activePresetId, setActivePresetId,
    applyPreset,
    theme,
  } = useStore();

  const [tempKey, setTempKey] = useState(providerKeys[aiProvider] || userApiKey || '');
  const [provider, setProvider] = useState(aiProvider);
  const [model, setModel] = useState(aiModel);
  const [endpoint, setEndpoint] = useState(aiEndpoint || '');
  const [presetName, setPresetName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const DEFAULT_MODELS: Record<string, string> = {
    gemini: 'gemini-2.0-flash',
    openai: 'gpt-4o',
    ollama: 'codellama',
    custom: 'openrouter/free',
  };

  useEffect(() => {
    if (isOpen) {
      setProvider(aiProvider);
      setTempKey(providerKeys[aiProvider] || userApiKey || '');
      setModel(aiModel);
      setEndpoint(aiEndpoint || '');
      setIsSaved(false);
      setTestResult(null);
      setTestError(null);
    }
  }, [isOpen]);

  const handleKeyChange = (val: string) => {
    setTempKey(val);
    setTestResult(null);
    if (provider === 'custom' && val.startsWith('sk-or-v1')) {
      if (!endpoint) setEndpoint('https://openrouter.ai/api/v1');
      if (!model || !model.includes('free')) setModel('openrouter/free');
    }
  };

  const savePreset = () => {
    if (!tempKey && provider !== 'ollama') { toast.error('Enter an API key first'); return; }
    const activeModel = model || DEFAULT_MODELS[provider];
    const name = presetName.trim() || `${providers.find(p => p.id === provider)?.label} · ${activeModel.split('/').pop()}`;
    const newPreset: AIPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name, provider, apiKey: tempKey, model: activeModel, endpoint,
    };
    setAiPresets([...aiPresets, newPreset]);
    setPresetName('');
    toast.success(`"${name}" saved`);
  };

  const deletePreset = (id: string) => {
    setAiPresets(aiPresets.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleApply = () => {
    setProviderKey(provider, tempKey);
    setAiProvider(provider);
    setAiModel(model || DEFAULT_MODELS[provider]);
    setAiEndpoint(endpoint);
    setIsSaved(true);
    setTimeout(() => { setIsSaved(false); onClose(); }, 700);
  };

  const testConnection = async () => {
    if (!tempKey && provider !== 'ollama') return;
    setIsTesting(true); setTestResult(null); setTestError(null);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping', context: { fileName: '', content: '' }, provider, apiKey: tempKey, model: model || DEFAULT_MODELS[provider], endpoint, systemInstruction: 'Reply OK' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTestResult('success');
      // Auto-save on successful test
      savePreset();
    } catch (err: any) {
      setTestResult('error');
      setTestError(err.message);
    } finally { setIsTesting(false); }
  };

  const providers = [
    { id: 'gemini', label: 'Gemini AI', icon: Globe },
    { id: 'openai', label: 'OpenAI', icon: Cpu },
    { id: 'ollama', label: 'Ollama', icon: Monitor },
    { id: 'custom', label: 'Custom SDK', icon: Link },
  ];

  const activeProvider = providers.find(p => p.id === provider);
  const isDark = theme === 'dark';

  // Matching the dashboard container style: dark bg, subtle border, rounded-2xl
  const cardCls = isDark
    ? "bg-[#111111] border border-white/[0.07]"
    : "bg-white border border-zinc-200";

  const inputCls = isDark
    ? "bg-white/[0.04] border border-white/[0.07] text-zinc-200 placeholder:text-zinc-600 focus:border-white/20"
    : "bg-zinc-50 border border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300";

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
        <Dialog.Content className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[820px] h-[580px] z-[101] flex overflow-hidden outline-none animate-in zoom-in-95 duration-200",
          "rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
          cardCls
        )}>

          {/* ─── LEFT SIDEBAR ─── */}
          <div className={cn(
            "w-[210px] shrink-0 flex flex-col border-r",
            isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"
          )}>
            {/* Header */}
            <div className={cn("px-5 h-[56px] flex items-center gap-3 border-b", isDark ? "border-white/[0.06]" : "border-zinc-200")}>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Settings2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className={cn("text-[12px] font-semibold", isDark ? "text-white" : "text-zinc-800")}>AI Settings</span>
            </div>

            {/* Provider Nav */}
            <div className="flex-1 px-3 py-4 space-y-0.5">
              <p className={cn("text-[9px] font-bold uppercase tracking-widest px-2 mb-3", isDark ? "text-zinc-600" : "text-zinc-400")}>Providers</p>
              {providers.map(p => {
                const active = provider === p.id;
                const hasKey = !!providerKeys[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { setProvider(p.id as any); setTempKey(providerKeys[p.id] || ''); setModel(DEFAULT_MODELS[p.id]); setTestResult(null); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                      active
                        ? isDark ? "bg-white/[0.06] text-white" : "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                        : isDark ? "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    )}
                  >
                    <p.icon className={cn("w-4 h-4 shrink-0 transition-colors", active ? "text-emerald-500" : isDark ? "text-zinc-600" : "text-zinc-400")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[11px] font-semibold", active ? (isDark ? "text-white" : "text-zinc-900") : "")}>{p.label}</p>
                      <p className={cn("text-[9px] font-medium mt-0.5", hasKey ? "text-emerald-500" : isDark ? "text-zinc-700" : "text-zinc-400")}>{hasKey ? "Configured" : "Not set"}</p>
                    </div>
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Vault Badge */}
            <div className={cn("px-4 py-4 border-t", isDark ? "border-white/[0.06]" : "border-zinc-200")}>
              <div className={cn("px-3 py-2.5 rounded-xl flex items-center gap-2.5 border", isDark ? "bg-emerald-500/[0.04] border-emerald-500/10" : "bg-emerald-50 border-emerald-100")}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none">Encrypted</p>
                  <p className={cn("text-[8px] font-medium mt-1", isDark ? "text-zinc-600" : "text-zinc-400")}>Local storage only</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT PANEL ─── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Right Header */}
            <div className={cn("px-7 h-[56px] flex items-center justify-between border-b shrink-0", isDark ? "border-white/[0.06]" : "border-zinc-200")}>
              <div>
                <h3 className={cn("text-[13px] font-semibold", isDark ? "text-white" : "text-zinc-900")}>{activeProvider?.label} Configuration</h3>
                <p className={cn("text-[9px] font-medium mt-0.5 uppercase tracking-widest", isDark ? "text-zinc-600" : "text-zinc-400")}>API key and model settings</p>
              </div>
              <Dialog.Close className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all", isDark ? "text-zinc-500 hover:bg-white/[0.06] hover:text-white" : "text-zinc-400 hover:bg-zinc-100")}>
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-7 py-7 space-y-6">

              {/* API Key */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className={cn("text-[9px] font-bold uppercase tracking-widest", isDark ? "text-zinc-500" : "text-zinc-400")}>API Access Key</label>
                  <button
                    onClick={testConnection}
                    disabled={isTesting || (!tempKey && provider !== 'ollama')}
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all disabled:opacity-30",
                      testResult === 'success' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                      testResult === 'error' ? "text-red-400 bg-red-500/10 border-red-500/20" :
                      isDark ? "text-zinc-400 bg-white/[0.04] border-white/[0.08] hover:text-white hover:bg-white/[0.08]" : "text-zinc-500 bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
                    )}
                  >
                    {isTesting ? 'Testing…' : testResult === 'success' ? '✓ Connected' : testResult === 'error' ? '✗ Failed' : 'Test Connection'}
                  </button>
                </div>

                <div className={cn("flex items-center h-11 rounded-xl px-4 gap-3 transition-all", inputCls)}>
                  <Key className={cn("w-3.5 h-3.5 shrink-0", isDark ? "text-zinc-600" : "text-zinc-400")} />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={tempKey}
                    onChange={e => handleKeyChange(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 bg-transparent text-[11px] font-mono outline-none"
                  />
                  <button onClick={() => setShowKey(v => !v)} className={isDark ? "text-zinc-600 hover:text-zinc-300 transition-colors" : "text-zinc-400 hover:text-zinc-600"}>
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {testError && <p className="text-[9px] font-medium text-red-400">{testError}</p>}
              </div>

              {/* Advanced Toggle */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className={cn("flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest transition-colors", isDark ? "text-zinc-600 hover:text-emerald-500" : "text-zinc-400 hover:text-emerald-600")}
                >
                  <ChevronRight className={cn("w-3 h-3 transition-transform", showAdvanced ? "rotate-90" : "")} />
                  Custom Model / Endpoint
                </button>
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {[
                          { label: 'Model ID', value: model, onChange: setModel, placeholder: DEFAULT_MODELS[provider] },
                          { label: 'Base URL', value: endpoint, onChange: setEndpoint, placeholder: 'https://openrouter.ai/api/v1' },
                        ].map(field => (
                          <div key={field.label} className="space-y-1.5">
                            <label className={cn("text-[9px] font-bold uppercase tracking-widest", isDark ? "text-zinc-600" : "text-zinc-400")}>{field.label}</label>
                            <input value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder}
                              className={cn("w-full h-9 rounded-xl px-3 text-[10px] font-mono outline-none transition-all", inputCls)} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div className={cn("border-t", isDark ? "border-white/[0.06]" : "border-zinc-100")} />

              {/* Saved Credentials */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={cn("text-[9px] font-bold uppercase tracking-widest", isDark ? "text-zinc-500" : "text-zinc-400")}>Saved Credentials</label>
                  <span className={cn("text-[8px] font-medium px-2 py-0.5 rounded-lg border", isDark ? "text-zinc-600 bg-white/[0.03] border-white/[0.06]" : "text-zinc-400 bg-zinc-50 border-zinc-200")}>Vault · Local</span>
                </div>

                {/* Save Row */}
                <div className="flex items-center gap-2">
                  <input
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePreset()}
                    placeholder="Name this preset… (or leave blank for auto-name)"
                    className={cn("flex-1 h-10 rounded-xl px-4 text-[10px] font-medium outline-none transition-all", inputCls)}
                  />
                  <button onClick={savePreset}
                    className="h-10 px-5 bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] font-bold uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-md shadow-emerald-500/20">
                    Save
                  </button>
                </div>

                {/* Preset List — only user-saved presets */}
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-0.5">
                  <AnimatePresence>
                    {aiPresets.length === 0 ? (
                      <div className={cn("flex items-center justify-center py-6 rounded-xl border border-dashed", isDark ? "border-white/[0.06] text-zinc-700" : "border-zinc-200 text-zinc-300")}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest">No saved credentials yet</p>
                      </div>
                    ) : (
                      aiPresets.map((preset, i) => {
                        const pIcon = providers.find(p => p.id === preset.provider);
                        const isActive = activePresetId === preset.id;
                        return (
                          <motion.div
                            key={preset.id}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ delay: i * 0.03 }}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl border group transition-all",
                              isActive
                                ? isDark ? "bg-emerald-500/[0.06] border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                                : isDark ? "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.10]" : "bg-zinc-50 border-zinc-100 hover:border-zinc-200"
                            )}
                          >
                            <button onClick={() => applyPreset(preset.id)} className="flex-1 flex items-center gap-3 outline-none text-left">
                              <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                                isActive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : isDark ? "bg-white/[0.04] border-white/[0.06] text-zinc-600" : "bg-white border-zinc-200 text-zinc-400"
                              )}>
                                {pIcon && <pIcon.icon className="w-4 h-4" />}
                              </div>
                              <div className="overflow-hidden">
                                <p className={cn("text-[11px] font-semibold truncate", isActive ? "text-emerald-500" : isDark ? "text-zinc-200" : "text-zinc-700")}>{preset.name}</p>
                                <p className={cn("text-[9px] font-mono mt-0.5 truncate", isDark ? "text-zinc-600" : "text-zinc-400")}>{preset.model}</p>
                              </div>
                            </button>
                            {isActive && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                            <button onClick={() => deletePreset(preset.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-700 hover:text-red-400 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={cn("px-7 py-4 border-t flex items-center justify-end gap-3 shrink-0", isDark ? "border-white/[0.06]" : "border-zinc-200")}>
              <button onClick={onClose} className={cn("px-4 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-xl transition-colors", isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-700")}>
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isSaved}
                className={cn(
                  "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95",
                  isSaved ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-black"
                )}
              >
                {isSaved ? '✓ Saved' : 'Apply & Save'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
