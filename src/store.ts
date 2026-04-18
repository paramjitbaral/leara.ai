import { create } from 'zustand';
import { User } from 'firebase/auth';

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
  
  aiMode: AIMode;
  setAiMode: (mode: AIMode) => void;
  
  isAIPanelOpen: boolean;
  setIsAIPanelOpen: (open: boolean) => void;
  
  usageLimit: number;
  currentUsage: number;
  setUsage: (usage: number) => void;
  
  userApiKey: string | null;
  setUserApiKey: (key: string | null) => void;
  
  aiProvider: 'gemini' | 'openai' | 'ollama';
  setAiProvider: (provider: 'gemini' | 'openai' | 'ollama') => void;
  
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
  setActiveFile: (file) => set({ activeFile: file }),
  
  aiMode: 'explain',
  setAiMode: (mode) => set({ aiMode: mode }),
  
  isAIPanelOpen: true,
  setIsAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  
  usageLimit: 100,
  currentUsage: 0,
  setUsage: (usage) => set({ currentUsage: usage }),
  
  userApiKey: null,
  setUserApiKey: (key) => set({ userApiKey: key }),
  
  aiProvider: 'gemini',
  setAiProvider: (provider) => set({ aiProvider: provider }),

  isLearningModalOpen: false,
  setIsLearningModalOpen: (open) => set({ isLearningModalOpen: open }),

  isLearningActive: false,
  setIsLearningActive: (active) => set({ isLearningActive: active }),

  aiModel: 'gemini-3.1-flash-preview',
  setAiModel: (model) => set({ aiModel: model }),

  isApiKeyModalOpen: false,
  setIsApiKeyModalOpen: (open) => set({ isApiKeyModalOpen: open }),

  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  isHelpModalOpen: false,
  setIsHelpModalOpen: (open) => set({ isHelpModalOpen: open }),

  sidebarWidth: 260,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  sidebarPosition: 'left',
  setSidebarPosition: (position) => set({ sidebarPosition: position }),

  terminalType: 'server',
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
  // When setting active project, we also want to ensure we're in editor view
  setActiveProject: (project) => set({ activeProject: project, currentView: project ? 'editor' : 'dashboard' }),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('app-theme', theme);
    set({ theme });
  },
}));
