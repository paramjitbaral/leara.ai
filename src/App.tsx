import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Editor } from './components/Editor';
import { FileExplorer } from './components/FileExplorer';
import { CopilotPanel } from './components/CopilotPanel';
import { TopBar } from './components/TopBar';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { LearningMode } from './components/LearningMode';
import { PinSystem } from './components/PinSystem';
import { Terminal } from './components/Terminal';
import { Preview } from './components/Preview';
import { Dashboard } from './components/Dashboard';
import { signIn } from './firebase';
import { useFirebase } from './components/FirebaseProvider';
import { Terminal as TerminalIcon, Layout, PanelRight, Minimize2, Loader2, Info, Settings, Zap, Sparkles, LogIn, BookOpen, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';

export default function App() {
  const { 
    user, isAIPanelOpen, setIsAIPanelOpen, aiMode, activeFile,
    isLearningActive, setIsLearningActive, isLearningModalOpen, setIsLearningModalOpen,
    currentView, setCurrentView, theme, activeProject,
    isSettingsModalOpen, setIsSettingsModalOpen,
    isHelpModalOpen, setIsHelpModalOpen,
    sidebarWidth, setSidebarWidth,
    sidebarPosition, setSidebarPosition,
    isPreviewOpen, setIsPreviewOpen,
    previewUrl
  } = useStore();

  const { isAuthReady } = useFirebase();

  useEffect(() => {
    console.log('App State Check - User:', user ? user.email : 'NULL', 'Ready:', isAuthReady);
  }, [user, isAuthReady]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
  }, [theme]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isPreviewResizing, setIsPreviewResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(400);
  const [showEnterPin, setShowEnterPin] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setIsTerminalOpen(true);
    }
  }, [activeProject]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newHeight = window.innerHeight - e.clientY - 24; // 24 is footer height
      if (newHeight > 100 && newHeight < window.innerHeight * 0.7) {
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      document.body.style.cursor = 'ns-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSidebarResizing) return;
      
      let newWidth;
      if (sidebarPosition === 'left') {
        newWidth = e.clientX;
      } else {
        newWidth = window.innerWidth - e.clientX - 48; // 48 is activity bar width
      }

      if (newWidth > 150 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsSidebarResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isSidebarResizing) {
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSidebarResizing, sidebarPosition, setSidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPreviewResizing) return;
      
      const newWidth = window.innerWidth - e.clientX - 48; // 48 is activity bar width
      if (newWidth > 200 && newWidth < 800) {
        setPreviewWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsPreviewResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isPreviewResizing) {
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPreviewResizing]);

  const handleEnterLearnMode = () => {
    if (!activeFile) {
      toast.error('Please select a file first to enter Learn Mode.', {
        description: 'You need an active file to start the learning session.',
        duration: 4000,
      });
      return;
    }
    
    setShowEnterPin(true);
  };

  const startLearning = () => {
    setShowEnterPin(false);
    setIsLearningActive(true);
  };

  const stopLearning = () => {
    setIsLearningActive(false);
  };

  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async (useRedirect = false) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const result = await signIn(useRedirect);
      if (result) {
        toast.success('Successfully signed in!');
      } else if (!useRedirect) {
        // This handles the case where signIn returned null (popup-closed-by-user)
        toast.error('Sign in cancelled', {
          description: 'The login window was closed. Please try again and keep the window open.',
        });
        setShowRedirectOption(true);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      let errorMessage = error.message || 'An unexpected error occurred.';
      
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'Domain not authorized. Please add this URL to your Firebase Console.';
      }

      toast.error('Sign in failed', {
        description: errorMessage,
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const [showRedirectOption, setShowRedirectOption] = useState(false);

  useEffect(() => {
    // If popup fails, show redirect option after a short delay
    const timer = setTimeout(() => {
      setShowRedirectOption(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!isAuthReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#fafafa]">
        {/* Soft Ambient Depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0%,transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center"
        >
          {/* Suble Light Glow */}
          <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-[40px] animate-pulse" />
          
          <img 
            src="/logo.png" 
            className="w-20 h-20 object-contain relative z-10" 
            alt="Leara.ai" 
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-8 flex flex-col items-center gap-4"
          >
            <p className="text-zinc-400 text-[11px] font-semibold uppercase tracking-[0.6em] ml-[0.6em]">
              Initializing Workspace
            </p>
            
            {/* Ultra-Light Progress Loader */}
            <div className="w-32 h-[1px] bg-zinc-200 overflow-hidden relative">
              <motion.div 
                className="absolute inset-0 bg-emerald-500/30"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Global Texture */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-4 relative">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-sm w-full space-y-12"
        >
          <div className="flex flex-col items-center gap-6">
            <img 
              src="/logo.png" 
              className="w-20 h-20 object-contain drop-shadow-2xl" 
              alt="Leara.ai" 
            />
            <div className="text-center space-y-1">
              <h1 className="text-4xl font-bold tracking-tighter text-white">
                <span className="text-sky-500">Leara</span><span className="text-emerald-500">.ai</span>
              </h1>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">Professional AI Workspace</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <button 
                onClick={() => handleSignIn(false)}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm active:scale-[0.98]"
              >
                {isSigningIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                    />
                  </svg>
                )}
                {isSigningIn ? 'Signing in...' : 'Continue with Google'}
              </button>

              {showRedirectOption && (
                <button
                  onClick={() => handleSignIn(true)}
                  disabled={isSigningIn}
                  className="text-[9px] text-zinc-500 hover:text-zinc-400 underline underline-offset-4 transition-colors font-bold uppercase tracking-widest"
                >
                  Trouble logging in? Try Redirect Mode
                </button>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Secure Cloud Environment</p>
              <div className="h-px w-8 bg-zinc-800" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-zinc-900">
            <div className="space-y-1">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Adaptive</h3>
              <p className="text-[9px] text-zinc-600 leading-tight">AI that learns your coding patterns.</p>
            </div>
            <div className="space-y-1 text-right">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cloud</h3>
              <p className="text-[9px] text-zinc-600 leading-tight">Professional IDE in your browser.</p>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-8 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.4em]">
          Leara.ai v1.0
        </div>
      </div>
    );
  }

  if (currentView === 'dashboard') {
    return <Dashboard />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden font-sans">
      <Toaster position="top-center" richColors />
      <TopBar onEnterLearnMode={handleEnterLearnMode} />
      
      <AnimatePresence>
        {showEnterPin && (
          <PinSystem 
            mode={localStorage.getItem('learning_pin') ? "verify" : "create"} 
            onSuccess={(pin) => {
              if (!localStorage.getItem('learning_pin')) {
                localStorage.setItem('learning_pin', pin);
              }
              startLearning();
            }}
            onCancel={() => setShowEnterPin(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLearningActive && (
          <LearningMode 
            activeFile={activeFile as any} 
            onClose={stopLearning}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
      />

      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar and Editor Area */}
        <div className={cn(
          "flex-1 flex overflow-hidden",
          sidebarPosition === 'right' ? "flex-row-reverse" : "flex-row"
        )}>
          {/* Sidebar: File Explorer */}
          <aside 
            style={{ width: sidebarWidth }}
            className={cn(
              "border-white/5 flex flex-col bg-[#1e1e1e] relative shrink-0",
              sidebarPosition === 'left' ? "border-r" : "border-l"
            )}
          >
            <FileExplorer />
            {/* Sidebar Resize Handle */}
            <div 
              className={cn(
                "absolute top-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-emerald-500/50 transition-colors z-30",
                sidebarPosition === 'left' ? "-right-0.5" : "-left-0.5"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsSidebarResizing(true);
              }}
            />
          </aside>

          {/* Center: Editor & Terminal */}
          <section className="flex-1 flex flex-col overflow-hidden relative bg-[#1e1e1e]">
            <div className="flex-1 overflow-hidden flex">
              <div className="flex-1 overflow-hidden">
                <Editor />
              </div>

              {/* Preview Panel */}
              <AnimatePresence>
                {isPreviewOpen && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: previewWidth }}
                    exit={{ width: 0 }}
                    className="border-l border-white/5 bg-[#1e1e1e] flex flex-col relative shrink-0 z-20"
                  >
                    {/* Resize Handle */}
                    <div 
                      className="absolute top-0 bottom-0 -left-0.5 w-1 cursor-ew-resize bg-transparent hover:bg-emerald-500/50 transition-colors z-30"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsPreviewResizing(true);
                      }}
                    />
                    <Preview />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Terminal */}
            <AnimatePresence>
              {isTerminalOpen && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: terminalHeight }}
                  exit={{ height: 0 }}
                  className="border-t border-white/5 bg-[#1e1e1e] flex flex-col relative z-10"
                >
                  {/* Resize Handle */}
                  <div 
                    className="absolute -top-0.5 left-0 right-0 h-1 cursor-ns-resize bg-transparent hover:bg-emerald-500/50 transition-colors z-20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizing(true);
                    }}
                  />
                  <Terminal onClose={() => setIsTerminalOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            {!isTerminalOpen && (
              <button 
                onClick={() => setIsTerminalOpen(true)}
                className="absolute bottom-4 left-4 p-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/20 rounded-md text-emerald-500 transition-all z-10 backdrop-blur-sm"
                title="Open Terminal"
              >
                <TerminalIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </section>
        </div>

        {/* Right Sidebar: AI Copilot */}
        <AnimatePresence>
          {isAIPanelOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/5 bg-[#1e1e1e] flex flex-col z-20"
            >
              <CopilotPanel />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar Toggle Bar - More Minimal */}
        <div className="w-12 bg-[#111] border-l border-white/5 flex flex-col items-center py-4 gap-4 shrink-0">
          <button 
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={cn(
              "p-2 rounded-lg transition-all",
              isAIPanelOpen ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20" : "text-zinc-600 hover:text-white hover:bg-white/5"
            )}
            title="Toggle AI Panel"
          >
            <PanelRight className="w-5 h-5" />
          </button>
          <button className="p-2 text-zinc-600 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Extensions">
            <Layout className="w-5 h-5" />
          </button>
          <div className="mt-auto flex flex-col gap-4">
            <button 
              onClick={() => setIsHelpModalOpen(true)}
              className={cn(
                "p-2 rounded-lg transition-all",
                isHelpModalOpen ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20" : "text-zinc-600 hover:text-white hover:bg-white/5"
              )}
              title="Help"
            >
              <Info className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className={cn(
                "p-2 rounded-lg transition-all",
                isSettingsModalOpen ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20" : "text-zinc-600 hover:text-white hover:bg-white/5"
              )}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      {/* Status Bar - Ultra Minimal */}
      <footer className="h-6 bg-[#111] border-t border-white/5 text-zinc-600 flex items-center justify-between px-4 text-[9px] font-bold uppercase tracking-widest shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-emerald-500 cursor-pointer transition-colors">
            <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
            <span>Ready</span>
          </div>
          <div className="w-px h-3 bg-white/5" />
          <div className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
            <span>main</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
            <span>UTF-8</span>
          </div>
          <div className="w-px h-3 bg-white/5" />
          <div className="flex items-center gap-1.5 text-emerald-500 cursor-pointer transition-colors">
            <Sparkles className="w-3 h-3" />
            <span>AI Powered</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
