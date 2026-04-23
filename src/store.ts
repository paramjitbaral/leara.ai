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

export type AIMode = 'explain' | 'practice' | 'build';

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

  isPreviewOpen: boolean;
  setIsPreviewOpen: (open: boolean) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;

  currentView: 'dashboard' | 'editor';
  setCurrentView: (view: 'dashboard' | 'editor') => void;
  
  learningPasscode: string;
  setLearningPasscode: (code: string) => void;

  activeProject: any | null;
  setActiveProject: (project: any | null) => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  editorHighlightQuery: string;
  setEditorHighlightQuery: (query: string) => void;

  sidebarTab: 'explorer' | 'search';
  setSidebarTab: (tab: 'explorer' | 'search') => void;

  editorScrollLine: number | null;
  setEditorScrollLine: (line: number | null) => void;
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

  aiModel: localStorage.getItem('ai-model') || 'gemini-3.1-flash-preview',
  setAiModel: (model) => {
    localStorage.setItem('ai-model', model);
    set({ aiModel: model });
  },

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
}));
