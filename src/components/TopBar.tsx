import React from 'react';
import { useStore, AIMode } from '../store';
import { logOut, signIn } from '../firebase';
import { Sparkles, BrainCircuit, Zap, Settings, User, LogOut, LogIn, ChevronDown, Cpu, Globe, Key, GraduationCap, Sun, Moon, ShieldCheck, Plus, Check, X, Minus, Square, Copy } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils';
import { ApiKeyModal } from './ApiKeyModal';
import { LearaLogo } from './LearaLogo';
import { motion, AnimatePresence } from 'motion/react';

interface TopBarProps {
  onEnterLearnMode: () => void;
}

export function TopBar({ onEnterLearnMode }: TopBarProps) {
  const { aiMode, setAiMode, aiProvider, setAiProvider, currentUsage, usageLimit, user, setIsLearningModalOpen, isLearningActive, theme, setTheme, providerKeys, setUserApiKey, setCurrentView, userApiKey, isApiKeyModalOpen, setIsApiKeyModalOpen } = useStore();

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

  const handleWindowAction = (action: string) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send(`window-${action}`);
    } catch (e) {
      console.warn('Window actions only available in Desktop mode');
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
                onOpenChange={(open) => !open && setOpenMenu(null)}
                modal={false}
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    onPointerEnter={() => setOpenMenu(menu)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-150 ease-out outline-none",
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
                    onMouseLeave={() => setOpenMenu(null)}
                    align="start"
                    sideOffset={4}
                    className={cn(
                      "min-w-[160px] border rounded-md py-1 shadow-2xl z-[100] outline-none animate-in fade-in zoom-in-95 duration-75",
                      theme === 'dark' ? "bg-[#252526] border-white/10" : "bg-white border-zinc-200"
                    )}
                  >
                    {menuItems[menu].map((item) => (
                      <DropdownMenu.Item
                        key={item}
                        onClick={() => setOpenMenu(null)}
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



        <div className="flex items-stretch gap-4 pr-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "p-1 rounded-lg transition-all duration-200 ease-in-out hover:scale-110 active:scale-95",
              theme === 'dark' ? "hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400" : "hover:bg-emerald-500/5 text-zinc-500 hover:text-emerald-600"
            )}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>


          <div className={cn("h-4 w-[1px]", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest leading-none",
                theme === 'dark' ? "text-white" : "text-zinc-900"
              )}>{user?.uid === 'local-desktop-user' ? 'Local Desktop' : (user?.displayName || 'User')}</span>
              <span className="text-[9px] text-zinc-500 font-bold leading-none mt-1.5">
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

          <div className="flex items-stretch h-[36px]">
            <button
              onClick={() => handleWindowAction('minimize')}
              className={cn(
                "w-[46px] h-full flex items-center justify-center transition-colors duration-75",
                theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-black/5 text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleWindowAction('maximize')}
              className={cn(
                "w-[46px] h-full flex items-center justify-center transition-colors duration-75",
                theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-black/5 text-zinc-600 hover:text-zinc-900"
              )}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleWindowAction('close')}
              className="w-[46px] h-full flex items-center justify-center transition-colors duration-75 hover:bg-[#e81123] text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
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
