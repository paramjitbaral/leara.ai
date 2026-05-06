import React from 'react';
import { useStore, AIMode, FileNode } from '../store';
import { logOut, signIn } from '../firebase';
import { Sparkles, BrainCircuit, Zap, Settings, User, LogOut, LogIn, ChevronDown, Cpu, Globe, Key, GraduationCap, Sun, Moon, ShieldCheck, Plus, Check, X, Minus, Square, Copy } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils';
import { ApiKeyModal } from './ApiKeyModal';
import { LearaLogo } from './LearaLogo';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { storageService } from '../lib/storageService';

interface TopBarProps {
  onEnterLearnMode: () => void;
}

export function TopBar({ onEnterLearnMode }: TopBarProps) {
  const {
    aiMode, setAiMode, aiProvider, setAiProvider, currentUsage, usageLimit, user,
    setIsLearningModalOpen, isLearningActive, theme, setTheme, providerKeys,
    setUserApiKey, setCurrentView, userApiKey, isApiKeyModalOpen, setIsApiKeyModalOpen,
    activeProject, userId, files, activeFile, addOpenFile, setActiveFile,
    saveFile, saveAllFiles, setSidebarTab, setIsTerminalOpen, setBottomPanelTab,
    addTerminal, setIsSettingsModalOpen, setIsHelpModalOpen, triggerRefreshFiles
  } = useStore();

  const menuItems: Record<string, string[]> = {
    'File': ['New File', 'New Window', 'Open...', 'Save', 'Save As...', 'Preferences', 'Exit'],
    'Edit': ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Find', 'Replace'],
    'View': ['Command Palette', 'Explorer', 'Search', 'Source Control', 'Terminal', 'Output'],
    'Go': ['Go to File...', 'Go to Symbol...', 'Go to Line...', 'Switch Window'],
    'Run': ['Start Debugging', 'Run Without Debugging', 'Stop Debugging'],
    'Terminal': ['New Terminal', 'Split Terminal', 'Run Task...'],
    'Help': ['Documentation', 'Release Notes', 'Keyboard Shortcuts', 'About Leara']
  };

  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const [menuMode, setMenuMode] = React.useState(false);

  // Close open menu when clicking outside any topbar menu/trigger or pressing Escape
  React.useEffect(() => {
    if (!openMenu) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-topbar-menu]') || target.closest('[data-topbar-trigger]')) return;
      setOpenMenu(null);
      setMenuMode(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpenMenu(null);
        setMenuMode(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const handleWindowAction = (action: string) => {
    try {
      const electron = (window as any).electron;
      if (electron?.ipcRenderer) {
        electron.ipcRenderer.send(`window-${action}`);
      } else {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send(`window-${action}`);
      }
    } catch (e) {
      console.warn('Window actions only available in Desktop mode');
    }
  };

  const emitEditorCommand = (command: string) => {
    window.dispatchEvent(new CustomEvent('leara:editor-command', { detail: command }));
  };

  const emitRightPanel = (panel: 'ai' | 'scm' | 'ops') => {
    window.dispatchEvent(new CustomEvent('leara:right-panel', { detail: panel }));
  };

  const ensureProject = () => {
    if (!activeProject) {
      toast.error('Open a project first');
      return false;
    }
    return true;
  };

  const collectPaths = (nodes: FileNode[], acc: Set<string>) => {
    nodes.forEach((n) => {
      acc.add(n.id);
      if (n.children) collectPaths(n.children, acc);
    });
  };

  const getLanguageFromName = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      json: 'json', css: 'css', scss: 'scss', html: 'html', md: 'markdown',
      py: 'python', java: 'java', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp'
    };
    return map[ext] || 'plaintext';
  };

  const getUniqueName = (baseName: string, parent: string, existing: Set<string>) => {
    const dot = baseName.lastIndexOf('.');
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    const ext = dot > 0 ? baseName.slice(dot) : '';
    let name = baseName;
    let i = 1;
    let fullPath = parent ? `${parent}/${name}` : name;
    while (existing.has(fullPath)) {
      name = `${stem}-${i}${ext}`;
      fullPath = parent ? `${parent}/${name}` : name;
      i += 1;
    }
    return name;
  };

  const createFileInProject = (baseName: string, content = '') => {
    if (!ensureProject()) return;
    const parent = activeProject?.folderName || '';
    const existing = new Set<string>();
    collectPaths(files, existing);
    const uniqueName = getUniqueName(baseName, parent, existing);
    const fullPath = parent ? `${parent}/${uniqueName}` : uniqueName;
    const language = getLanguageFromName(uniqueName);

    // Optimistically open the file immediately for snappy UX
    const newNode: FileNode = { id: fullPath, name: uniqueName, type: 'file', content, language };
    addOpenFile(newNode);
    setActiveFile(newNode);

    // Persist in background
    void (async () => {
      try {
        await storageService.createNode(userId, activeProject.id, parent, uniqueName, 'file');
        if (content) {
          await storageService.saveFile(userId, activeProject.id, fullPath, uniqueName, content, language);
        }
        triggerRefreshFiles();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to create file');
      }
    })();
  };

  const openFilePicker = async () => {
    if (!ensureProject()) return;
    const pickFile = async (): Promise<File | null> => {
      if ('showOpenFilePicker' in window) {
        const handles = await (window as any).showOpenFilePicker({ multiple: false });
        const file = await handles?.[0]?.getFile?.();
        return file || null;
      }
      return await new Promise<File | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = () => {
          resolve(input.files && input.files[0] ? input.files[0] : null);
        };
        input.click();
      });
    };

    const file = await pickFile();
    if (!file) return;
    const text = await file.text();
    createFileInProject(file.name, text);
  };

  const saveActiveFile = async () => {
    if (!activeFile) {
      toast.info('No active file to save');
      return;
    }
    await saveFile(activeFile.id, activeFile.content || '');
    toast.success('File saved');
  };

  const saveAs = async () => {
    if (!activeFile) {
      toast.info('No active file to save');
      return;
    }
    const name = window.prompt('Save as', activeFile.name || 'untitled.txt');
    if (!name) return;
    createFileInProject(name, activeFile.content || '');
  };

  const openNewWindow = () => {
    try {
      const electron = (window as any).electron;
      if (electron?.ipcRenderer) {
        electron.ipcRenderer.send('window-new');
        return;
      }
    } catch {}
    window.open(window.location.href, '_blank');
  };

  const handleMenuAction = async (menu: string, item: string) => {
    const key = `${menu}:${item}`;
    try {
      switch (key) {
        case 'File:New File':
          createFileInProject('untitled.txt', '');
          break;
        case 'File:New Window':
          openNewWindow();
          break;
        case 'File:Open...':
          await openFilePicker();
          break;
        case 'File:Save':
          await saveActiveFile();
          break;
        case 'File:Save As...':
          await saveAs();
          break;
        case 'File:Preferences':
          setIsSettingsModalOpen(true);
          break;
        case 'File:Exit':
          handleWindowAction('close');
          break;

        case 'Edit:Undo':
          emitEditorCommand('undo');
          break;
        case 'Edit:Redo':
          emitEditorCommand('redo');
          break;
        case 'Edit:Cut':
          emitEditorCommand('cut');
          break;
        case 'Edit:Copy':
          emitEditorCommand('copy');
          break;
        case 'Edit:Paste':
          emitEditorCommand('paste');
          break;
        case 'Edit:Find':
          emitEditorCommand('find');
          break;
        case 'Edit:Replace':
          emitEditorCommand('replace');
          break;

        case 'View:Command Palette':
          toast.info('Command Palette coming soon');
          break;
        case 'View:Explorer':
          setSidebarTab('explorer');
          break;
        case 'View:Search':
          setSidebarTab('search');
          break;
        case 'View:Source Control':
          emitRightPanel('scm');
          break;
        case 'View:Terminal':
          setIsTerminalOpen(true);
          setBottomPanelTab('terminal');
          break;
        case 'View:Output':
          setIsTerminalOpen(true);
          setBottomPanelTab('problems');
          break;

        case 'Go:Go to File...':
          setSidebarTab('search');
          toast.info('Quick file open coming soon');
          break;
        case 'Go:Go to Symbol...':
          emitEditorCommand('quickOutline');
          break;
        case 'Go:Go to Line...':
          emitEditorCommand('gotoLine');
          break;
        case 'Go:Switch Window':
          openNewWindow();
          break;

        case 'Run:Start Debugging':
        case 'Run:Run Without Debugging':
        case 'Run:Stop Debugging':
          toast.info('Debugging is not configured yet');
          break;

        case 'Terminal:New Terminal':
          setIsTerminalOpen(true);
          setBottomPanelTab('terminal');
          addTerminal('server');
          break;
        case 'Terminal:Split Terminal':
          setIsTerminalOpen(true);
          setBottomPanelTab('terminal');
          addTerminal('server');
          toast.info('Split not available yet. Opened a new terminal tab.');
          break;
        case 'Terminal:Run Task...':
          emitRightPanel('ops');
          break;

        case 'Help:Documentation':
        case 'Help:Keyboard Shortcuts':
        case 'Help:About Leara':
          setIsHelpModalOpen(true);
          break;
        case 'Help:Release Notes':
          setIsHelpModalOpen(true);
          toast.info('Release notes coming soon');
          break;
        default:
          toast.info('Action not implemented yet');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Action failed');
    }
  };

  return (
    <>
      <header 
        style={{ 
          WebkitAppRegion: 'drag',
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff'
        } as any}
        className={cn(
          "h-[36px] flex items-stretch justify-between pl-4 pr-0 shrink-0 z-50 transition-colors select-none relative",
          theme === 'dark' ? "text-zinc-400 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]" : "text-zinc-600 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]"
        )}
      >
        <div className="flex items-center gap-6 h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="cursor-pointer scale-[0.8] origin-left hover:opacity-80 transition-opacity" role="button" onClick={() => setCurrentView('dashboard')}>
            <LearaLogo size="sm" showText={false} />
          </div>

          <div className="flex items-center gap-0.5 -ml-5">
            {Object.keys(menuItems).map((menu) => (
              <DropdownMenu.Root
                key={menu}
                open={openMenu === menu}
                modal={false}
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    data-topbar-trigger
                    onClick={(e) => {
                      e.stopPropagation();
                      if (openMenu === menu) {
                        setOpenMenu(null);
                        setMenuMode(false);
                      } else {
                        setMenuMode(true);
                        setOpenMenu(menu);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (menuMode && openMenu !== menu) {
                        setOpenMenu(menu);
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-colors duration-75 ease-out outline-none",
                      theme === 'dark'
                        ? "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                        : "text-zinc-600 hover:text-emerald-600 hover:bg-emerald-500/5",
                      openMenu === menu && (theme === 'dark' ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-600")
                    )}
                  >
                    {menu}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    data-topbar-menu
                    align="start"
                    sideOffset={6}
                    className={cn(
                      "min-w-[160px] border rounded-md py-1 shadow-2xl z-[100] outline-none animate-in fade-in zoom-in-95 duration-75",
                      theme === 'dark' ? "bg-[#252526] border-white/10" : "bg-white border-zinc-200"
                    )}
                  >
                    {menuItems[menu].map((item) => (
                      <DropdownMenu.Item
                        key={item}
                        onClick={() => {
                          setOpenMenu(null);
                          setMenuMode(false);
                          // Run action asynchronously to keep UI snappy
                          queueMicrotask(() => {
                            void handleMenuAction(menu, item);
                          });
                        }}
                        className={cn(
                          "flex items-center px-3 py-1.5 text-[11px] cursor-pointer outline-none transition-colors",
                          theme === 'dark' ? "text-zinc-300 hover:bg-emerald-500 hover:text-white" : "text-zinc-700 hover:bg-emerald-500 hover:text-white"
                        )}
                      >
                        {item}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ))}

            <div className={cn("h-3.5 w-[1px] mx-1", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

            <button
              onClick={onEnterLearnMode}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95",
                isLearningActive
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                  : theme === 'dark' ? "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
              )}
            >
              {isLearningActive ? (
                <>
                  <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
                  Active
                </>
              ) : (
                <>
                  <GraduationCap className="w-3.5 h-3.5" />
                  Learn Mode
                </>
              )}
            </button>
          </div>
        </div>



        <div className="flex items-center gap-4 pr-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out active:scale-95 self-center",
              theme === 'dark' ? "hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400" : "hover:bg-emerald-500/5 text-zinc-500 hover:text-emerald-600"
            )}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>


          <div className={cn("h-4 w-[1px] self-center", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.18em] leading-none",
                theme === 'dark' ? "text-white" : "text-zinc-900"
              )}>{user?.uid === 'local-desktop-user' ? 'Local Desktop' : (user?.displayName || 'User')}</span>
              <span className="text-[9px] text-zinc-500 font-medium leading-none mt-1.5">
                {user?.uid === 'local-desktop-user' ? 'Working Offline' : user?.email}
              </span>
            </div>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 overflow-hidden transition-all hover:border-emerald-500/50 active:scale-95",
                  theme === 'dark' ? "bg-zinc-800 border border-white/5" : "bg-zinc-100 border border-zinc-200"
                )}>
                  {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5" />}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={cn(
                    "min-w-[200px] border rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200",
                    theme === 'dark' ? "bg-[#1e1e1e] border-white/10" : "bg-white border-zinc-200"
                  )}
                  align="end"
                  sideOffset={8}
                >
                  <div className={cn("px-3 py-3 border-b mb-2", theme === 'dark' ? "border-white/5" : "border-zinc-100")}>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-zinc-900")}>
                      {user?.uid === 'local-desktop-user' ? 'Local Desktop Mode' : user?.displayName}
                    </p>
                    <p className="text-[9px] text-zinc-500 font-bold mt-1">
                      {user?.uid === 'local-desktop-user' ? 'Sync Disabled' : user?.email}
                    </p>
                  </div>

                  {user?.uid === 'local-desktop-user' ? (
                    <DropdownMenu.Item
                      onClick={() => signIn(true)}
                      className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-emerald-500 hover:bg-emerald-500/10 rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest"
                    >
                      <LogIn className="w-4 h-4" /> Sign In to Cloud
                    </DropdownMenu.Item>
                  ) : (
                    <>
                      <DropdownMenu.Item className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest",
                        theme === 'dark' ? "text-zinc-400 hover:bg-white/5 hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                      )}>
                        <Settings className="w-4 h-4" /> Settings
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onClick={() => {
                          logOut();
                          if (user?.uid === 'local-desktop-user') {
                            useStore.getState().setUser(null);
                            window.location.reload();
                          }
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded-xl cursor-pointer outline-none transition-all uppercase tracking-widest active:scale-95"
                      >
                        <LogOut className="w-4 h-4" /> Log Out
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <div className="flex items-stretch h-[36px] overflow-hidden">
            <div
              style={{ WebkitAppRegion: 'no-drag' } as any}
              className={cn("flex items-center relative z-20")}
              onPointerUp={(e) => {
                try {
                  const el = e.target as HTMLElement;
                  // If clicked directly on a button, let its click handler handle it
                  if (el.closest('button[data-action]')) return;

                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const closeThreshold = 80; // px from right edge considered 'close area'
                  if (rect.width - x <= closeThreshold) {
                    handleWindowAction('close');
                    return;
                  }

                  // Otherwise map to minimize/maximize depending on horizontal region
                  const third = rect.width / 3;
                  if (x < third) handleWindowAction('minimize');
                  else if (x < third * 2) handleWindowAction('maximize');
                } catch (err) {
                  // ignore
                }
              }}
            >
              <button
                data-action="minimize"
                onClick={() => handleWindowAction('minimize')}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "w-[46px] h-full flex items-center justify-center transition-colors duration-75 outline-none relative z-10",
                  theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-black/5 text-zinc-600 hover:text-zinc-900"
                )}
              >
                <Minus className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              <button
                data-action="maximize"
                onClick={() => handleWindowAction('maximize')}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "w-[46px] h-full flex items-center justify-center transition-colors duration-75 outline-none relative z-10",
                  theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-black/5 text-zinc-600 hover:text-zinc-900"
                )}
              >
                <Square className="w-3 h-3 pointer-events-none" />
              </button>
              <button
                data-action="close"
                onClick={() => handleWindowAction('close')}
                onMouseDown={(e) => e.preventDefault()}
                className="w-[46px] h-full flex items-center justify-center transition-colors duration-75 hover:bg-[#e81123] text-zinc-400 hover:text-white outline-none relative z-10 group"
                title="Close"
              >
                <X className="w-4 h-4 pointer-events-none group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </>
  );
}
