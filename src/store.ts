import { create } from 'zustand';
import { User } from 'firebase/auth';
import { storageService } from './lib/storageService';
import { toast } from 'sonner';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  language?: string;
}

export interface Problem {
  id: string;
  fileId: string;
  fileName: string;
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
}

export type AIMode = 'explain' | 'practice' | 'build';

export interface AIPreset {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'ollama' | 'custom';
  apiKey: string;
  model: string;
  endpoint?: string;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;

  userId: string;
  setUserId: (id: string) => void;

  files: FileNode[];
  setFiles: (files: FileNode[]) => void;

  activeFile: FileNode | null;
  setActiveFile: (file: FileNode | null) => void;

  openFiles: FileNode[];
  addOpenFile: (file: FileNode) => void;
  removeOpenFile: (fileId: string) => void;
  closeAllFiles: () => void;
  saveFile: (fileId: string, content: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;

  modifiedFiles: Set<string>;
  originalContents: Record<string, string>;
  setModified: (fileId: string, modified: boolean) => void;
  updateOriginalContent: (fileId: string, content: string) => void;

  aiMode: AIMode;
  setAiMode: (mode: AIMode) => void;

  isAIPanelOpen: boolean;
  setIsAIPanelOpen: (open: boolean) => void;

  usageLimit: number;
  currentUsage: number;
  setUsage: (usage: number) => void;

  userApiKey: string | null;
  setUserApiKey: (key: string | null) => void;

  providerKeys: Record<string, string>;
  setProviderKey: (provider: string, key: string) => void;

  aiProvider: 'gemini' | 'openai' | 'ollama' | 'custom';
  setAiProvider: (provider: 'gemini' | 'openai' | 'ollama' | 'custom') => void;

  aiEndpoint: string;
  setAiEndpoint: (endpoint: string) => void;

  isLearningModalOpen: boolean;
  setIsLearningModalOpen: (open: boolean) => void;

  isLearningActive: boolean;
  setIsLearningActive: (active: boolean) => void;

  aiModel: string;
  setAiModel: (model: string) => void;

  isApiKeyModalOpen: boolean;
  setIsApiKeyModalOpen: (open: boolean) => void;

  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (open: boolean) => void;

  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  sidebarPosition: 'left' | 'right';
  setSidebarPosition: (position: 'left' | 'right') => void;

  terminalType: 'server' | 'browser';
  setTerminalType: (type: 'server' | 'browser') => void;

  lastStatusUpdateTime: number;
  triggerStatusUpdate: () => void;

  scmChangedFiles: string[];
  setScmChangedFiles: (files: string[]) => void;

  isPreviewOpen: boolean;
  setIsPreviewOpen: (open: boolean) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;

  currentView: 'dashboard' | 'editor';
  setCurrentView: (view: 'dashboard' | 'editor') => void;

  learningPasscode: string;
  setLearningPasscode: (code: string) => void;

  aiPresets: AIPreset[];
  setAiPresets: (presets: AIPreset[]) => void;
  activePresetId: string | null;
  setActivePresetId: (id: string | null) => void;
  applyPreset: (presetId: string) => void;

  activeProject: any | null;
  setActiveProject: (project: any | null) => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  editorHighlightQuery: string;
  setEditorHighlightQuery: (query: string) => void;

  sidebarTab: 'explorer' | 'search' | 'scm' | 'ops';
  setSidebarTab: (tab: 'explorer' | 'search' | 'scm' | 'ops') => void;

  editorScrollLine: number | null;
  setEditorScrollLine: (line: number | null) => void;

  chatHistories: Record<string, any[]>;
  setProjectMessages: (projectId: string, messages: any[]) => void;
  clearProjectMessages: (projectId: string) => void;
  
  refreshFiles: number;
  triggerRefreshFiles: () => void;

  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  terminalCommand: string | null;
  setTerminalCommand: (command: string | null) => void;
  
  terminals: { id: string; type: 'server' | 'browser'; name: string }[];
  activeTerminalId: string | null;
  addTerminal: (type?: 'server' | 'browser', name?: string) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminalId: (id: string) => void;

  updateFileContent: (fileId: string, content: string) => void;

  problems: Problem[];
  setProblems: (problems: Problem[]) => void;
  bottomPanelTab: 'terminal' | 'problems';
  setBottomPanelTab: (tab: 'terminal' | 'problems') => void;
}

const getInitialTheme = (): 'dark' | 'light' => {
  const savedTheme = localStorage.getItem('app-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }
  return 'light'; // Default to light
};

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user, userId: user?.uid || 'default-user' }),

  userId: 'default-user',
  setUserId: (id) => set({ userId: id }),

  files: [],
  setFiles: (files) => set({ files }),

  activeFile: null,
  setActiveFile: (file) => set((state) => {
    if (!file) return { activeFile: null };
    const newOpenFiles = state.openFiles.map((f) =>
      f.id === file.id ? file : f
    );
    return {
      activeFile: file,
      openFiles: newOpenFiles
    };
  }),

  openFiles: [],
  addOpenFile: (file) => set((state) => {
    const isAlreadyOpen = state.openFiles.find((f) => f.id === file.id);
    if (isAlreadyOpen) {
      return { activeFile: isAlreadyOpen };
    }
    return {
      openFiles: [...state.openFiles, file],
      activeFile: file,
      originalContents: { ...state.originalContents, [file.id]: file.content || '' }
    };
  }),
  removeOpenFile: (fileId) => set((state) => {
    const newOpenFiles = state.openFiles.filter((f) => f.id !== fileId);
    let newActiveFile = state.activeFile;
    if (state.activeFile?.id === fileId) {
      newActiveFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
    }
    const newOriginals = { ...state.originalContents };
    delete newOriginals[fileId];
    return {
      openFiles: newOpenFiles,
      activeFile: newActiveFile,
      originalContents: newOriginals
    };
  }),
  closeAllFiles: () => set({ openFiles: [], activeFile: null, modifiedFiles: new Set(), originalContents: {} }),

  modifiedFiles: new Set(),
  originalContents: {},
  setModified: (fileId, modified) => set((state) => {
    const newSet = new Set(state.modifiedFiles);
    if (modified) newSet.add(fileId);
    else newSet.delete(fileId);
    return { modifiedFiles: newSet };
  }),
  updateOriginalContent: (fileId, content) => set((state) => ({
    originalContents: { ...state.originalContents, [fileId]: content }
  })),

  saveFile: async (fileId, content) => {
    const state = useStore.getState();
    if (!state.activeProject) return;

    try {
      const file = state.openFiles.find(f => f.id === fileId);
      await storageService.saveFile(
        state.userId,
        state.activeProject.id,
        fileId,
        content,
        file?.language || 'javascript'
      );
      state.updateOriginalContent(fileId, content);
      state.setModified(fileId, false);
      state.triggerStatusUpdate();
    } catch (err) {
      console.error('Failed to save file:', err);
      toast.error(`Failed to save ${fileId}`);
      throw err;
    }
  },

  saveAllFiles: async () => {
    const state = useStore.getState();
    const savePromises = state.openFiles.map(file =>
      state.saveFile(file.id, file.content || '')
    );
    await Promise.all(savePromises);
    toast.success('All files saved');
  },

  aiMode: 'explain',
  setAiMode: (mode) => set({ aiMode: mode }),

  isAIPanelOpen: true,
  setIsAIPanelOpen: (open) => set({ isAIPanelOpen: open }),

  usageLimit: 100,
  currentUsage: 0,
  setUsage: (usage) => set({ currentUsage: usage }),

  userApiKey: localStorage.getItem('ai-api-key') || null,
  setUserApiKey: (key) => {
    if (key) localStorage.setItem('ai-api-key', key);
    else localStorage.removeItem('ai-api-key');
    set({ userApiKey: key });
  },

  providerKeys: JSON.parse(localStorage.getItem('ai-provider-keys') || '{}'),
  setProviderKey: (provider, key) => set((state) => {
    const newKeys = { ...state.providerKeys, [provider]: key };
    localStorage.setItem('ai-provider-keys', JSON.stringify(newKeys));
    return { providerKeys: newKeys };
  }),

  aiProvider: (localStorage.getItem('ai-provider') as any) || 'gemini',
  setAiProvider: (provider) => {
    localStorage.setItem('ai-provider', provider);
    set((state) => ({
      aiProvider: provider,
      userApiKey: state.providerKeys[provider] || null
    }));
  },

  aiEndpoint: localStorage.getItem('ai-endpoint') || '',
  setAiEndpoint: (endpoint) => {
    localStorage.setItem('ai-endpoint', endpoint);
    set({ aiEndpoint: endpoint });
  },

  isLearningModalOpen: false,
  setIsLearningModalOpen: (open) => set({ isLearningModalOpen: open }),

  isLearningActive: false,
  setIsLearningActive: (active) => set({ isLearningActive: active }),

  aiModel: localStorage.getItem('ai-model') || 'gemini-2.0-flash',
  setAiModel: (model) => {
    localStorage.setItem('ai-model', model);
    set({ aiModel: model });
  },

  lastStatusUpdateTime: Date.now(),
  triggerStatusUpdate: () => set({ lastStatusUpdateTime: Date.now() }),

  scmChangedFiles: [],
  setScmChangedFiles: (files: string[]) => set({ scmChangedFiles: files }),

  isApiKeyModalOpen: false,
  setIsApiKeyModalOpen: (open) => set({ isApiKeyModalOpen: open }),

  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  isHelpModalOpen: false,
  setIsHelpModalOpen: (open) => set({ isHelpModalOpen: open }),

  sidebarWidth: 220,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  sidebarPosition: 'left',
  setSidebarPosition: (position) => set({ sidebarPosition: position }),

  terminalType: typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'browser' : 'server',
  setTerminalType: (type) => set({ terminalType: type }),

  isPreviewOpen: false,
  setIsPreviewOpen: (open) => set({ isPreviewOpen: open }),
  previewUrl: null,
  setPreviewUrl: (url) => set({ previewUrl: url }),

  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),

  learningPasscode: '1234', // Default passcode
  setLearningPasscode: (code) => set({ learningPasscode: code }),

  aiPresets: JSON.parse(localStorage.getItem('ai-presets') || '[]'),
  setAiPresets: (presets) => {
    localStorage.setItem('ai-presets', JSON.stringify(presets));
    set({ aiPresets: presets });
  },
  activePresetId: localStorage.getItem('ai-active-preset-id') || null,
  setActivePresetId: (id) => {
    if (id) localStorage.setItem('ai-active-preset-id', id);
    else localStorage.removeItem('ai-active-preset-id');
    set({ activePresetId: id });
  },
  applyPreset: (presetId) => {
    const state = useStore.getState();
    const preset = state.aiPresets.find(p => p.id === presetId);
    if (preset) {
      state.setAiProvider(preset.provider);
      state.setAiModel(preset.model);
      if (preset.endpoint) state.setAiEndpoint(preset.endpoint);
      state.setProviderKey(preset.provider, preset.apiKey);
      state.setUserApiKey(preset.apiKey); // keep userApiKey in sync
      state.setActivePresetId(presetId);
      toast.success(`Active Profile: ${preset.name}`);
    }
  },


  activeProject: null,
  setActiveProject: (project) => set({ activeProject: project, currentView: project ? 'editor' : 'dashboard' }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('app-theme', theme);
    set({ theme });
  },

  editorHighlightQuery: '',
  setEditorHighlightQuery: (query) => set({ editorHighlightQuery: query }),

  sidebarTab: 'explorer',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  editorScrollLine: null,
  setEditorScrollLine: (line) => set({ editorScrollLine: line }),

  updateFileContent: (fileId, content) => set((state) => {
    const updatedFiles = state.files.map(f => f.id === fileId ? { ...f, content } : f);
    const updatedOpenFiles = state.openFiles.map(f => f.id === fileId ? { ...f, content } : f);
    return {
      files: updatedFiles,
      openFiles: updatedOpenFiles,
      activeFile: state.activeFile?.id === fileId ? { ...state.activeFile, content } : state.activeFile,
      modifiedFiles: new Set([...state.modifiedFiles, fileId])
    };
  }),

  chatHistories: {},
  setProjectMessages: (projectId, messages) => set((state) => ({
    chatHistories: { ...state.chatHistories, [projectId]: messages }
  })),
  clearProjectMessages: (projectId) => set((state) => ({
    chatHistories: { ...state.chatHistories, [projectId]: [] }
  })),

  refreshFiles: 0,
  triggerRefreshFiles: () => set((state) => ({ refreshFiles: state.refreshFiles + 1 })),

  isTerminalOpen: true,
  setIsTerminalOpen: (open) => set({ isTerminalOpen: open }),
  terminalCommand: null,
  setTerminalCommand: (command) => set({ terminalCommand: command }),

  terminals: [{ id: 'term-1', type: 'server', name: 'bash' }],
  activeTerminalId: 'term-1',
  addTerminal: (type = 'server', name) => set((state) => {
    const id = `term-${Date.now()}`;
    const newTerminal = { id, type, name: name || (type === 'server' ? 'bash' : 'jsh') };
    return {
      terminals: [...state.terminals, newTerminal],
      activeTerminalId: id,
      isTerminalOpen: true
    };
  }),
  removeTerminal: (id) => set((state) => {
    const newTerminals = state.terminals.filter(t => t.id !== id);
    let newActiveId = state.activeTerminalId;
    if (newActiveId === id) {
      newActiveId = newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : null;
    }
    return {
      terminals: newTerminals,
      activeTerminalId: newActiveId,
      isTerminalOpen: newTerminals.length > 0
    };
  }),
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),

  problems: [],
  setProblems: (problems) => set({ problems }),
  bottomPanelTab: 'terminal',
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
}));
