import React, { useState, useRef, useEffect } from 'react';
import { useStore, FileNode } from '../store';
import { cn, smartMergeCode } from '../lib/utils';
import axios from 'axios';
import { Send, Sparkles, Bug, Zap, PlusCircle, Loader2, User, Bot, X, LayoutDashboard, Plus, Mic, ArrowUp, ChevronDown, Cpu, Globe, Monitor, Link, Check, GraduationCap, BrainCircuit, Terminal, Play, Copy, FileCode, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'ask' | 'fix' | 'improve' | 'generate' | 'build' | 'tests';
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'powershell', 'ps1', 'cmd', 'zsh', 'fish']);
const SHELL_CMD_RE = /^(npm|npx|node|python3?|pip3?|git|cd|ls|dir|mkdir|rm|mv|cp|yarn|pnpm|cargo|go run|make|tsc|dotnet|java|mvn)\b/;
const CODE_LANGS = new Set(['js', 'javascript', 'ts', 'typescript', 'tsx', 'jsx', 'py', 'python', 'json', 'html', 'css', 'scss', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rust', 'rb', 'ruby', 'php', 'swift', 'kt', 'sql', 'yaml', 'yml', 'toml', 'md', 'sh']);

const SLASH_COMMANDS = [
  { id: 'explain', label: 'Explain', description: 'Understand how this code works', icon: GraduationCap },
  { id: 'fix', label: 'Fix', description: 'Find and fix bugs in this file', icon: Bug },
  { id: 'tests', label: 'Tests', description: 'Generate unit tests for this code', icon: BrainCircuit },
  { id: 'clear', label: 'Clear', description: 'Reset chat history', icon: X },
];

// Shell command block → shows Run in Terminal + live output
function ShellBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const { theme, setIsTerminalOpen, setTerminalCommand, addTerminal, terminals } = useStore();

  const run = () => {
    setIsTerminalOpen(true);
    if (terminals.length === 0) {
      addTerminal('server');
    }
    setTerminalCommand(code.trim());
    toast.success('Command sent to terminal');

    // Trigger file refreshes to catch disk changes (e.g. npm install)
    const { triggerRefreshFiles } = useStore.getState();
    setTimeout(triggerRefreshFiles, 2000);
    setTimeout(triggerRefreshFiles, 5000);
    setTimeout(triggerRefreshFiles, 10000);
  };

  const copy = () => { navigator.clipboard.writeText(code.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className={cn(
      "my-1 rounded-lg overflow-hidden border font-mono text-[11px] transition-colors",
      theme === 'dark' ? "border-white/[0.08] bg-[#0d0d0d]" : "border-zinc-200 bg-white"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-2.5 py-1 transition-colors border-b",
        theme === 'dark' ? "bg-[#161616] border-white/[0.05]" : "bg-zinc-100 border-zinc-200"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-500 truncate">Terminal</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button onClick={copy} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
          
          <button
            onClick={run}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all text-[8px] font-bold uppercase tracking-tight"
            title="Run in Terminal"
          >
            <Play className="w-2.5 h-2.5" />
            Run in Terminal
          </button>
        </div>
      </div>

      {/* Command Body */}
      <pre className={cn(
        "px-3 py-3 overflow-x-auto max-h-[100px] overflow-y-auto leading-relaxed transition-colors m-0 border-none bg-transparent whitespace-pre",
        theme === 'dark' ? "text-zinc-300" : "text-zinc-800"
      )}>
        <code className="bg-transparent p-0 m-0 border-none">{code.trim()}</code>
      </pre>

    </div>
  );
}

// Code block → shows syntax-highlighted with Copy + Apply to Editor
function CodeBlock({ code, lang, onApply }: { code: string; lang?: string; onApply?: (code: string) => void }) {
  const { theme } = useStore();
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const apply = () => {
    if (onApply) { onApply(code); setApplied(true); setTimeout(() => setApplied(false), 2000); }
  };

  return (
    <div className={cn(
      "my-1 rounded-lg overflow-hidden border font-mono text-[11px] transition-colors",
      theme === 'dark' ? "border-white/[0.08]" : "border-zinc-200"
    )}>
      <div className={cn(
        "flex items-center justify-between px-2.5 py-1 transition-colors",
        theme === 'dark' ? "bg-[#161616]" : "bg-zinc-100"
      )}>
        <span className="text-zinc-500 text-[8px] uppercase tracking-widest font-bold">{lang || 'code'}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={copy} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors" title="Copy">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
          {onApply && (
            <button
              onClick={apply}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all text-[8px] font-bold uppercase tracking-tight"
            >
              <Zap className="w-2.5 h-2.5" />
              {applied ? 'Done' : 'Apply'}
            </button>
          )}
        </div>
      </div>
      <pre className={cn(
        "px-3 py-3 overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed transition-colors whitespace-pre",
        theme === 'dark' ? "bg-[#0d0d0d] text-zinc-300" : "bg-white text-zinc-800"
      )}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Smart renderer — decides which block to use based on language/content  
function SmartCodeRenderer({ lang, code, onApply }: { lang: string; code: string; onApply?: (code: string) => void }) {
  const isShell = SHELL_LANGS.has(lang?.toLowerCase()) || (!CODE_LANGS.has(lang?.toLowerCase()) && SHELL_CMD_RE.test(code.trim()));
  if (isShell) return <ShellBlock code={code} />;
  return <CodeBlock code={code} lang={lang} onApply={onApply} />;
}

export function CopilotPanel() {
  const {
    activeFile, aiMode, setAiMode, aiProvider, setAiProvider,
    userApiKey, userId, setCurrentView, aiModel, theme, providerKeys,
    setIsApiKeyModalOpen, setIsAIPanelOpen, aiPresets, applyPreset, activePresetId, 
    user, activeProject, chatHistories, setProjectMessages
  } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentState, setAgentState] = useState<{
    pendingTool: any | null;
    history: any[];
    initialSteps: string[];
    task: string;
  } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync with project-specific history
  useEffect(() => {
    if (activeProject?.id) {
      setMessages(chatHistories[activeProject.id] || []);
    } else {
      setMessages([]);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (activeProject?.id) {
      setProjectMessages(activeProject.id, messages);
    }
  }, [messages, activeProject?.id, setProjectMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowCommands(val === '/');
  };

  const selectCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
    if (cmd.id === 'clear') {
      setMessages([]);
      setInput('');
      setShowCommands(false);
      return;
    }

    if (cmd.id === 'explain') setAiMode('explain');
    else if (cmd.id === 'fix') setAiMode('build');
    else if (cmd.id === 'tests') setAiMode('build');

    setInput(`/${cmd.id} `);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const providers = [
    { id: 'gemini', label: 'Gemini AI', icon: Globe },
    { id: 'openai', label: 'OpenAI', icon: Cpu },
    { id: 'ollama', label: 'Ollama', icon: Monitor },
    { id: 'custom', label: 'Custom SDK', icon: Link },
  ] as const;

  const modes: { id: typeof aiMode; label: string; icon: any }[] = [
    { id: 'explain', label: 'Explain', icon: Sparkles },
    { id: 'practice', label: 'Practice', icon: GraduationCap },
    { id: 'build', label: 'Build', icon: Zap },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (type: Message['type'] = 'ask') => {
    if (!input.trim() && type === 'ask') return;

    const resolvedKey = providerKeys[aiProvider] || userApiKey || '';

    if (!resolvedKey && aiProvider !== 'ollama') {
      toast.error('No API key configured — open AI Settings to add one.');
      setIsApiKeyModalOpen(true);
      return;
    }

    const userMessage: Message = { role: 'user', content: input || `Please ${type} this code.`, type };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const allFiles = useStore.getState().files;
      const getFileNames = (nodes: any[], indent = ''): string => {
        return nodes.map(n => `${indent}${n.type === 'directory' ? '📁' : '📄'} ${n.name}${n.children ? '\n' + getFileNames(n.children, indent + '  ') : ''}`).join('\n');
      };

      const projectContext = `Project Structure:\n${getFileNames(allFiles).slice(0, 1000)}\n\n`;

      const fileContext = activeFile
        ? `Active File: ${activeFile.name} (${activeFile.language || 'unknown'})\nContent:\n\`\`\`${activeFile.language || ''}\n${(activeFile.content || '').slice(0, 5000)}\n\`\`\``
        : 'No file active.';

      const commonRules = `- You are Leara Core, a world-class AI developer assistant for the Leara IDE. 
- You have the same intelligence and helpfulness as VS Code Copilot or better.
- PLATFORM: You are running on Windows. Use Windows-compatible shell commands (e.g., use 'type' instead of 'cat', 'dir' instead of 'ls').
- TERMINAL: Your shell is PowerShell/CMD.
- TOOL USE: DO NOT use XML tags like <tool_call>. Only output standard Markdown code blocks. 
- If you need to run a command, use a shell block. The user can run it directly.
- Always check for errors in the user's logic and proactively offer fixes.
- Be concise but conversational. Briefly explain your reasoning.
- You can see the whole project structure and the active file. Use this to provide deep context.
`;

      const systemInstructions = {
        build: `You are Leara Core, a world-class autonomous AI engineer.
- MODE: BUILD & OPERATE (Agentic Reasoning).
- PLATFORM: Windows. Use Windows-compatible commands.
- CONTRACT: You MUST output a JSON object following the tool contract.
- TOOL USE: When you want to act, you must output the exact JSON structure: { "thought": "...", "action": { "type": "tool", "tool": { "name": "...", "args": {} } } }.
- PROPER IDE LOGIC: When generating or fixing a project, always ensure a professional, logical structure (e.g. 'src' folder, 'public' folder).
- SCRIPT STANDARDS: Every Node.js project MUST include standard scripts in package.json: "dev", "start", and "build".
- FAST TOOLS: Prefer modern, high-performance tools (like Vite for web, Vitest for testing, or pnpm for installs) to ensure the user gets a fast, VS Code-like experience.
- If a project is missing a 'dev' script, you must proactively offer to add it.
- NEVER leave a project in an un-runnable state. Always provide the necessary config files.

${projectContext}
${fileContext}`,

        practice: `${commonRules}
- Mode: MENTOR & TEACH.
- Guide the user to learn by explaining patterns and principles.
- Use analogies and clear documentation references.
- Help them debug by pointing them to where the error is first, then showing the fix.

${projectContext}
${fileContext}`,

        explain: `${commonRules}
- Mode: EXPLAIN & ANALYZE.
- Provide deep architectural and logical breakdowns of the code.
- Reference specific lines and functions in the active file.

${projectContext}
${fileContext}`,
      };

      if (aiMode === 'build' || type === 'build' || type === 'tests') {
        const agentRes = await fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: currentInput || type,
            context: {
              projectContext,
              fileContext,
              activeFileId: activeFile?.id || null,
              activeFileName: activeFile?.name || null,
              aiMode,
            },
            userId: useStore.getState().userId,
            folder: activeProject?.folderName,
            provider: aiProvider,
            apiKey: resolvedKey,
            model: aiModel,
            endpoint: useStore.getState().aiEndpoint,
            systemInstruction: systemInstructions.build,
            maxIterations: 15,
            interactive: true,
            history: agentState?.history || [],
            initialSteps: agentState?.initialSteps || [],
          })
        });

        const agentData = await agentRes.json();
        if (agentData.error) throw new Error(agentData.error);

        // Update agent state for next turn
        setAgentState({
          pendingTool: agentData.pendingTool,
          history: agentData.logs || [],
          initialSteps: agentData.initialSteps || [],
          task: currentInput || type,
        });

        let combinedContent = "";
        for (const log of agentData.logs || []) {
          if (log.tool?.name) {
            combinedContent += `**Action:** ${log.tool.name}\n`;
          }
          if (log.output) {
            combinedContent += `\`\`\`terminal\n${String(log.output).slice(0, 1000)}\n\`\`\`\n`;
          }
        }

        if (agentData.pendingTool) {
          combinedContent += `\n**Proposed:** ${agentData.pendingTool.name} (${JSON.stringify(agentData.pendingTool.args)})\n*Waiting for approval...*`;
        } else {
          combinedContent += `\n---\n**Summary:** ${agentData.summary}\n*Completed in ${agentData.iterations} iterations.*`;
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'build',
          content: combinedContent
        }]);
      } else {
        const res = await fetch('/api/ai/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: currentInput || type,
            provider: aiProvider,
            apiKey: resolvedKey,
            model: aiModel,
            endpoint: useStore.getState().aiEndpoint,
            systemInstruction: systemInstructions[aiMode]
          })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteTool = async () => {
    if (!agentState?.pendingTool) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: agentState.pendingTool,
          userId,
          folder: activeProject?.folderName,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Append tool output to the history
      const lastLog = agentState.history[agentState.history.length - 1];
      if (lastLog) {
        lastLog.output = data.output;
        lastLog.status = "ok";
      }

      setAgentState(prev => prev ? { ...prev, pendingTool: null } : null);
      
      // Auto-trigger next step
      handleSend(agentState.task as any);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full transition-colors duration-300",
      theme === 'dark' ? "bg-[#1e1e1e] text-[#cccccc]" : "bg-white text-zinc-800"
    )}>
      <div className={cn(
        "h-10 border-b flex items-center justify-between px-3 shrink-0 transition-colors",
        theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-zinc-50 border-zinc-200"
      )}>
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-emerald-500" />
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.16em]",
            theme === 'dark' ? "text-white" : "text-zinc-900"
          )}>Leara Core</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => toast.info('History coming soon')}
            className={cn(
              "p-1.5 rounded-lg transition-all btn-tactile",
              theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5"
            )}
            title="Chat History"
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMessages([])}
            className={cn(
              "p-1.5 rounded-lg transition-all btn-tactile",
              theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-zinc-500 hover:text-zinc-900 hover:bg-black/5"
            )}
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className={cn("w-px h-4 mx-1", theme === 'dark' ? "bg-white/5" : "bg-zinc-200")} />
          <button
            onClick={() => setIsAIPanelOpen(false)}
            className={cn(
              "p-1.5 rounded-lg transition-all btn-tactile",
              theme === 'dark' ? "text-zinc-500 hover:text-red-400 hover:bg-red-400/5" : "text-zinc-500 hover:text-red-600 hover:bg-red-50/50"
            )}
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Professional Chat Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scroll-smooth" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Bot className="w-10 h-10" />
            <p className="text-xs font-medium max-w-[200px] uppercase tracking-widest leading-relaxed">
              Ask me to explain, fix, or generate code.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex items-start gap-2 py-1",
            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
          )}>
            <div className="shrink-0 mt-0.5">
              {msg.role === 'user' ? (
                user?.photoURL ? (
                  <img src={user.photoURL} alt="you" className="w-6 h-6 rounded-md object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[9px] font-black uppercase">
                    {user?.email?.[0] || 'U'}
                  </div>
                )
              ) : (
                <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center text-black">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className={cn(
              "flex-1 text-[12px] leading-relaxed min-w-0",
              msg.role === 'user'
                ? "flex justify-end"
                : cn("prose prose-invert max-w-none", theme === 'dark' ? "text-zinc-300" : "text-zinc-700 prose-zinc prose-sm")
            )}>
              {msg.role === 'user' ? (
                <span className={cn(
                  "inline-block px-3 py-1.5 rounded-2xl text-left transition-all max-w-[95%] break-all",
                  theme === 'dark'
                    ? "bg-white/[0.08] text-zinc-200 border border-white/5"
                    : "bg-zinc-100 text-zinc-900 border border-zinc-200 shadow-sm"
                )}>
                  {msg.content}
                </span>
              ) : (
                <div className="space-y-3">
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }: any) {
                        const lang = (className || '').replace('language-', '');
                        const codeStr = String(children).replace(/\n$/, '');
                        if (!props.inline && (codeStr.includes('\n') || lang)) {
                          return (
                            <SmartCodeRenderer
                              lang={lang}
                              code={codeStr}
                              onApply={async (code) => {
                                if (activeFile) {
                                  const currentContent = activeFile.content || '';
                                  const updated = smartMergeCode(currentContent, code);
                                  
                                  if (updated === currentContent) {
                                     toast.info('No changes needed (code already exists)');
                                     return;
                                  }

                                  useStore.getState().updateFileContent(activeFile.id, updated);
                                  toast.success('Code applied to ' + activeFile.name);

                                  // Heuristic: try to highlight/scroll to the change
                                  const lines = code.split('\n').filter(l => l.trim().length > 3);
                                  if (lines.length > 0) {
                                     const firstLine = lines[0].trim();
                                     const newLines = updated.split('\n');
                                     const lineIdx = newLines.findIndex(l => l.includes(firstLine));
                                     if (lineIdx !== -1) {
                                        useStore.getState().setEditorScrollLine(lineIdx + 1);
                                        useStore.getState().setEditorHighlightQuery(firstLine);
                                     }
                                  }
                                } else {
                                  // SMART FILE DISCOVERY: If no file is open, try to find one mentioned in the message
                                  const allFiles = useStore.getState().files;
                                  const fileRegex = /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/g;
                                  const matches = msg.content.match(fileRegex);
                                  
                                  const findNode = (nodes: FileNode[], targetName: string): FileNode | null => {
                                    for (const node of nodes) {
                                      if (node.type === 'file' && (node.name === targetName || node.id.endsWith(targetName))) return node;
                                      if (node.type === 'directory' && node.children) {
                                        const found = findNode(node.children, targetName);
                                        if (found) return found;
                                      }
                                    }
                                    return null;
                                  };

                                  let discoveredFile: FileNode | null = null;
                                  if (matches) {
                                    for (const match of matches) {
                                      const fileName = match.split('/').pop() || match;
                                      const node = findNode(allFiles, fileName);
                                      if (node) { discoveredFile = node; break; }
                                    }
                                  }

                                  if (discoveredFile) {
                                    try {
                                      // 1. Fetch content if missing
                                      let content = discoveredFile.content;
                                      if (!content) {
                                        const res = await axios.get(`/api/files/content?userId=${userId}&path=${discoveredFile.id}`);
                                        content = res.data.content;
                                      }
                                      
                                      // 2. Open and set as active
                                      const ext = discoveredFile.name.split('.').pop()?.toLowerCase();
                                      const languageMap: Record<string, string> = {
                                        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                                        'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown'
                                      };
                                      const language = languageMap[ext || ''] || 'javascript';
                                      
                                      const fullNode = { ...discoveredFile, content, language };
                                      useStore.getState().addOpenFile(fullNode);
                                      useStore.getState().setActiveFile(fullNode);
                                      
                                      // 3. Apply the patch
                                      const updated = smartMergeCode(content || '', code);
                                      if (updated === content) {
                                        toast.info('No changes needed (already exists)');
                                      } else {
                                        useStore.getState().updateFileContent(discoveredFile.id, updated);
                                        toast.success('Discovered and applied to ' + discoveredFile.name);
                                      }
                                    } catch (err) {
                                      toast.error('Failed to auto-apply: ' + discoveredFile.name);
                                    }
                                  } else {
                                    toast.error('No file open and none detected in message');
                                  }
                                }
                              }}
                            />
                          );
                        }
                        return <code className="bg-white/[0.08] px-1 py-0.5 rounded text-emerald-400 text-[10px] font-mono" {...props}>{children}</code>;
                      },
                      pre({ children }) {
                        return <>{children}</>;
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Quick Reactions / Follow-ups */}
                  {i === messages.length - 1 && !isLoading && (
                    <div className="flex flex-wrap gap-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      {['Explain this', 'Fix bugs', 'Add tests'].map((text) => (
                        <button
                          key={text}
                          onClick={() => {
                            setInput(text);
                            handleSend(text.includes('Fix') ? 'build' : (text.includes('tests') ? 'tests' : 'ask'));
                          }}
                          className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/5 hover:border-emerald-400/20 transition-all font-medium"
                        >
                          {text}
                        </button>
                      ))}

                      {agentState?.pendingTool && i === messages.length - 1 && (
                        <button
                          onClick={handleExecuteTool}
                          className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          Run in Terminal: {agentState.pendingTool.name}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2.5 py-1">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500/50 shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:240ms]" />
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "p-4 border-t relative transition-colors",
        theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-zinc-50 border-zinc-200"
      )}>
        <AnimatePresence>
          {showCommands && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "absolute bottom-full left-4 right-4 mb-2 border rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 overflow-hidden",
                theme === 'dark' ? "bg-[#1c1c1c] border-white/10" : "bg-white border-zinc-200"
              )}
            >
              <div className={cn(
                "px-3 py-2 border-b mb-1 flex items-center justify-between",
                theme === 'dark' ? "border-white/5" : "border-zinc-100"
              )}>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Commands</span>
                <span className="text-[8px] text-zinc-400">Type command or select</span>
              </div>
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => selectCommand(cmd)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all group",
                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors px-1",
                    theme === 'dark' ? "bg-white/5 text-zinc-400 group-hover:text-emerald-500" : "bg-zinc-100 text-zinc-500 group-hover:text-emerald-600"
                  )}>
                    <cmd.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[11px] font-bold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>/{cmd.id}</p>
                    <p className="text-[9px] text-zinc-500 truncate">{cmd.description}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>

          {attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {attachments.map((file, idx) => (
                <div key={idx} className={cn(
                  "flex items-center gap-2 px-2 py-1 border rounded-lg group transition-colors",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-zinc-100 border-zinc-200"
                )}>
                  <span className={cn("text-[9px] font-bold truncate max-w-[100px]", theme === 'dark' ? "text-zinc-400" : "text-zinc-600")}>{file.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="p-0.5 hover:bg-white/10 rounded-md text-zinc-600 hover:text-red-400"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          "relative flex flex-col border transition-all duration-200 group-within:border-emerald-500/30 overflow-hidden",
          theme === 'dark' ? "bg-white/[0.03] border-white/10 rounded-xl shadow-2xl" : "bg-zinc-50 border-zinc-200 rounded-xl"
        )}>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask anything, @ to mention, / for workflows"
            className={cn(
              "w-full bg-transparent px-4 pt-2.5 pb-1 text-[12px] focus:outline-none transition-all resize-none min-h-[50px] max-h-[180px]",
              theme === 'dark' ? "text-white placeholder:text-zinc-600" : "text-zinc-800 placeholder:text-zinc-400"
            )}
          />

          {/* Bottom Action Bar */}
          <div className="px-2 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all outline-none"
                title="Attach files or context"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <div className={cn("h-4 w-[1px] mx-0.5", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

              {/* Mode Switcher */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all group/btn outline-none">
                    <Zap className={cn("w-3 h-3 transition-colors", aiMode === 'build' ? "text-amber-500" : "text-zinc-600 group-hover/btn:text-amber-500/70")} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{aiMode === 'build' ? 'Fast' : aiMode}</span>
                    <ChevronDown className="w-2 h-2 text-zinc-600" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="min-w-[140px] bg-[#1e1e1e] border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" align="start">
                    {modes.map((m) => (
                      <DropdownMenu.Item
                        key={m.id}
                        onClick={() => setAiMode(m.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer outline-none transition-all",
                          aiMode === m.id ? "bg-emerald-500 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <m.icon className="w-3.5 h-3.5" /> {m.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              {/* Provider Switcher */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all group/btn outline-none border",
                    (!providerKeys[aiProvider] && aiProvider !== 'ollama')
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
                      : "text-zinc-500 hover:text-white hover:bg-white/5 border-transparent"
                  )}>
                    <Cpu className={cn(
                      "w-3 h-3 transition-colors",
                      (providerKeys[aiProvider] || aiProvider === 'ollama') ? "text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "text-amber-500/50 animate-pulse"
                    )} />
                    <span className="text-[9px] font-black uppercase tracking-tighter truncate max-w-[100px]">
                      {(!providerKeys[aiProvider] && aiProvider !== 'ollama')
                        ? "Connect AI"
                        : (aiModel ? aiModel.split('/').pop()?.split(':')[0] : aiProvider)}
                    </span>
                    <ChevronDown className="w-2 h-2 text-zinc-600" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="min-w-[150px] bg-[#0f0f0f] border border-white/5 rounded-xl p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200" align="start">
                    {/* Saved Presets - model-level switching */}
                    {aiPresets.length > 0 && (
                      <>
                        <div className="px-2 pt-1 pb-0.5">
                          <p className="text-[7px] font-bold uppercase tracking-widest text-zinc-600">Saved Profiles</p>
                        </div>
                        {aiPresets.map((preset) => {
                          const pIcon = providers.find(p => p.id === preset.provider);
                          const isActive = activePresetId === preset.id;
                          return (
                            <DropdownMenu.Item
                              key={preset.id}
                              onClick={() => applyPreset(preset.id)}
                              className={cn(
                                "flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer outline-none transition-all group",
                                isActive ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-500 hover:text-white hover:bg-white/5"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {pIcon && <pIcon.icon className={cn("w-3 h-3", isActive ? "text-emerald-500" : "text-zinc-600 group-hover:text-emerald-400")} />}
                                <div>
                                  <p className="text-[9px] font-bold uppercase tracking-tighter truncate max-w-[90px]">{preset.model.split('/').pop()?.split(':')[0]}</p>
                                </div>
                              </div>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            </DropdownMenu.Item>
                          );
                        })}
                        <div className="my-1 border-t border-white/5" />
                      </>
                    )}

                    {/* Fallback: configured providers if no presets */}
                    {aiPresets.length === 0 && providers.filter(p => providerKeys[p.id] || p.id === 'ollama').map((p) => (
                      <DropdownMenu.Item
                        key={p.id}
                        onClick={() => setAiProvider(p.id)}
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer outline-none transition-all group",
                          aiProvider === p.id ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-500 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <p.icon className={cn("w-3 h-3", aiProvider === p.id ? "text-emerald-500" : "text-zinc-600 group-hover:text-emerald-400")} />
                          <span className="text-[9px] font-bold uppercase tracking-tighter">{p.label}</span>
                        </div>
                        {aiProvider === p.id && <div className="w-1 h-1 rounded-full bg-emerald-500" />}
                      </DropdownMenu.Item>
                    ))}

                    {aiPresets.length === 0 && providers.filter(p => providerKeys[p.id] || p.id === 'ollama').length === 0 && (
                      <div className="px-2 py-3 text-center">
                        <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">No AI Connected</p>
                      </div>
                    )}

                    <DropdownMenu.Item
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-tighter text-zinc-600 hover:text-emerald-500 hover:bg-emerald-500/5 cursor-pointer outline-none transition-all"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Configure</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 shrink-0 transition-all",
                  (!input.trim() && attachments.length === 0)
                    ? (theme === 'dark' ? "bg-white/5 text-zinc-600" : "bg-zinc-100 text-zinc-400 cursor-not-allowed")
                    : (theme === 'dark' ? "bg-white text-black hover:bg-zinc-200 shadow-sm" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm")
                )}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5 stroke-[2.5px]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
