import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useStore } from './store';
import { Editor } from './components/Editor';
import { FileExplorer } from './components/FileExplorer';
import { TabBar } from './components/TabBar';
import { TopBar } from './components/TopBar';
import { Terminal } from './components/Terminal';
import { Dashboard } from './components/Dashboard';
import { completeExternalSignIn, signIn, auth, googleProvider } from './firebase';
import { useFirebase } from './components/FirebaseProvider';
import { Toaster, toast } from 'sonner';
import { LearaLogo } from './components/LearaLogo';
import { Terminal as TerminalIcon, PanelRight, Minimize2, Loader2, Info, Settings, Zap, Sparkles, Sun, Moon, Code, Github, ListChecks, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Lazy load components that aren't immediately visible
const CodeSearch = lazy(() => import('./components/CodeSearch').then(m => ({ default: m.CodeSearch })));
const SourceControlPanel = lazy(() => import('./components/SourceControlPanel').then(m => ({ default: m.SourceControlPanel })));
const WorkspaceOpsPanel = lazy(() => import('./components/WorkspaceOpsPanel').then(m => ({ default: m.WorkspaceOpsPanel })));
const CopilotPanel = lazy(() => import('./components/CopilotPanel').then(m => ({ default: m.CopilotPanel })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const HelpModal = lazy(() => import('./components/HelpModal').then(m => ({ default: m.HelpModal })));
const LearningMode = lazy(() => import('./components/LearningMode').then(m => ({ default: m.LearningMode })));
const PinSystem = lazy(() => import('./components/PinSystem').then(m => ({ default: m.PinSystem })));
const Preview = lazy(() => import('./components/Preview').then(m => ({ default: m.Preview })));

// Loading fallback for lazy components
function LazyComponentFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        <span className="text-xs text-zinc-400">Loading...</span>
      </div>
    </div>
  );
}

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
    previewUrl, setUser,
    sidebarTab, setSidebarTab,
    terminalType, setTerminalType, isTerminalOpen, setIsTerminalOpen,
    scmChangedFiles, modifiedFiles
  } = useStore();

  const totalChangeCount = Array.from(new Set([
    ...scmChangedFiles,
    ...Array.from(modifiedFiles)
  ])).length;

  const { isAuthReady } = useFirebase();

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
  }, [theme]);

  // Warm up heavier panels for faster menu actions
  useEffect(() => {
    const warm = () => {
      import('./components/CodeSearch');
      import('./components/SourceControlPanel');
      import('./components/WorkspaceOpsPanel');
    };
    if (typeof (window as any).requestIdleCallback === 'function') {
      (window as any).requestIdleCallback(warm, { timeout: 1200 });
    } else {
      setTimeout(warm, 300);
    }
  }, []);
  
  const [terminalHeight, setTerminalHeight] = useState(160);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isPreviewResizing, setIsPreviewResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(400);
  const [showEnterPin, setShowEnterPin] = useState(false);
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(320);
  const [isResizingAI, setIsResizingAI] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<'ai' | 'scm' | 'ops'>('ai');

  useEffect(() => {
    const onRightPanel = (ev: Event) => {
      const detail = (ev as CustomEvent<'ai' | 'scm' | 'ops'>).detail;
      if (!detail) return;
      if (detail === 'ai' || detail === 'scm' || detail === 'ops') {
        setRightPanelView(detail);
        setIsAIPanelOpen(true);
      }
    };
    window.addEventListener('leara:right-panel', onRightPanel as EventListener);
    return () => window.removeEventListener('leara:right-panel', onRightPanel as EventListener);
  }, [setIsAIPanelOpen]);

  // Smooth Theme Switch Overlay
  useEffect(() => {
    setIsThemeTransitioning(true);
    const timer = setTimeout(() => setIsThemeTransitioning(false), 500);
    return () => clearTimeout(timer);
  }, [theme]);

  // Handle External Auth Callback (Electron side)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const electron = (window as any).electron;
      
      if (electron?.ipcRenderer) {
        const unsubscribe = electron.ipcRenderer.on('auth-callback', async (url: string) => {
          console.log('App: Received auth-callback:', url);
          try {
            const urlObj = new URL(url);
            const data = urlObj.searchParams.get('data');
            if (data) {
              const result = await completeExternalSignIn(data);
              if (result.user) {
                setUser(result.user);
                toast.success('Successfully signed in from browser!');
              }
            }
          } catch (err) {
            console.error('App: Auth callback error:', err);
            toast.error('External sign in failed');
          }
        });
        return () => unsubscribe && unsubscribe();
      } else {
        // Fallback for legacy environment
        try {
          const { ipcRenderer } = (window as any).require('electron');
          const handleAuth = async (_event: any, url: string) => {
            // ... same logic ...
          };
          ipcRenderer.on('auth-callback', handleAuth);
          return () => ipcRenderer.removeListener('auth-callback', handleAuth);
        } catch (e) {}
      }
    }
  }, [setUser]);

  // Check if we are in Auth Bridge mode (Browser side)
  const [isAuthBridge, setIsAuthBridge] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'auth-bridge') {
      setIsAuthBridge(true);
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + P: Quick File Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setSidebarTab('explorer');
        toast.info('Quick open: Type to search files');
      }
      // Cmd/Ctrl + Shift + F: Global Search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setSidebarTab('search');
        toast.info('Global search: Search across all files');
      }
      // Cmd/Ctrl + Shift + P: Command Palette (Settings)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
      // Cmd/Ctrl + ,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
      // Cmd/Ctrl + S: Save File (prevent default, file save handled in Editor)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Editor component already handles Ctrl+S
        toast.success('File saved');
      }
      // Cmd/Ctrl + `: Toggle Terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsTerminalOpen(!isTerminalOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSidebarTab, setIsSettingsModalOpen, isTerminalOpen, setIsTerminalOpen]);

  const handleBridgeLogin = async () => {
    try {
      console.log('AuthBridge: Starting popup login...');
      const statusEl = document.getElementById('auth-status');
      if (statusEl) statusEl.innerText = 'Opening Google login...';

      if (!auth || !googleProvider) throw new Error('Firebase auth not initialized');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential) {
        console.log('AuthBridge: Success, redirecting to app...');
        if (statusEl) statusEl.innerText = 'Success! Returning to Leara...';

        const data = encodeURIComponent(JSON.stringify({
          idToken: credential.idToken,
          accessToken: (credential as any).accessToken
        }));
        
        // Redirect using custom protocol
        window.location.href = `leara-auth://callback?data=${data}`;
        
        // Fallback: If protocol handler fails, show a button
        setTimeout(() => {
          if (statusEl) statusEl.innerHTML = `
            <div class="space-y-4">
              <p>Login complete! If the app didn't open automatically, click the button below:</p>
              <a href="leara-auth://callback?data=${data}" class="inline-block px-6 py-3 bg-emerald-600 rounded-lg font-bold">Open Leara</a>
            </div>
          `;
        }, 3000);
      } else {
        throw new Error('No credential received from Google.');
      }
    } catch (err: any) {
      console.error('AuthBridge: Login failed:', err);
      const statusEl = document.getElementById('auth-status');
      if (statusEl) {
        statusEl.innerHTML = `
          <div class="text-red-400">
            <p>Login failed: ${err.message}</p>
            <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold uppercase tracking-widest">Try Again</button>
          </div>
        `;
      }
    }
  };

  // AI Sidebar Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingAI) return;
      const newWidth = window.innerWidth - e.clientX - 48; // 48 is right toggle bar
      if (newWidth > 310 && newWidth < 800) {
        setAiSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingAI(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingAI) {
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAI]);

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
    const isElectron = typeof window !== 'undefined' && 
      (window.navigator.userAgent.toLowerCase().includes('electron') || 
       (window as any).require && (window as any).require('electron'));
    
    console.log(`App: handleSignIn clicked. useRedirect=${useRedirect}, isElectron=${isElectron}`);
    setIsSigningIn(true);
    try {
      console.log('App: Starting Sign In process (useRedirect:', useRedirect, ')');
      const result = await signIn(useRedirect);
      
      if (result) {
        console.log('App: Sign In successful', result.user?.email);
        setUser(result.user);
        toast.success('Successfully signed in!');
      } else if (!useRedirect && !isElectron) {
        // Only show "cancelled" if we're NOT in Electron. 
        // In Electron, we expect result to be null because login happens in the external browser.
        console.log('App: Sign In cancelled or failed');
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
      console.log('App: handleSignIn finished');
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

  if (isAuthBridge) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
        <LearaLogo size="lg" className="mb-8" />
        <div className="relative z-10 text-center space-y-6">
          <h2 className="text-xl font-bold tracking-tight">Connect with Leara</h2>
          <p id="auth-status" className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">
            To use your existing session, please click the button below to sign in with Google.
          </p>
          <div className="flex justify-center pt-2">
            <button 
              onClick={handleBridgeLogin}
              className="flex items-center gap-3 px-8 py-4 bg-white text-black hover:bg-zinc-100 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
              </svg>
              Sign In with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          
          <LearaLogo size="lg" showText={false} className="relative z-10" />
          
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
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-noise" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] overflow-hidden font-sans">
      <Toaster position="top-center" richColors />
      <TopBar onEnterLearnMode={handleEnterLearnMode} />

      {!user ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-4 relative">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-sm w-full space-y-12"
          >
            <div className="flex flex-col items-center gap-6">
              <LearaLogo size="lg" className="flex-col gap-6" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] -mt-1">Desktop Edition</p>
            </div>

            <div className="space-y-4">
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
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
                    </svg>
                  )}
                  {isSigningIn ? 'Connecting...' : 'Sign in with Google'}
                </button>

                <div className="flex items-center gap-4 w-full px-2">
                  <div className="h-px bg-zinc-800 flex-1" />
                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">or</span>
                  <div className="h-px bg-zinc-800 flex-1" />
                </div>

                <button 
                  onClick={() => {
                    console.log('App: Transitioning to Local Mode...');
                    setUser({
                      uid: 'local-desktop-user',
                      displayName: 'Desktop User',
                      email: 'offline@local',
                      photoURL: null
                    } as any);
                    toast.success('Welcome to Local Desktop Mode!');
                  }}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all border border-zinc-800 shadow-sm active:scale-[0.98]"
                >
                  <Code className="w-4 h-4" />
                  Continue in Local Mode
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-zinc-900">
              <div className="space-y-1">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Local FS</h3>
                <p className="text-[9px] text-zinc-600 leading-tight">Direct access to your computer's files.</p>
              </div>
              <div className="space-y-1 text-right">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Privacy</h3>
                <p className="text-[9px] text-zinc-600 leading-tight">Your code never leaves your drive.</p>
              </div>
            </div>
          </motion.div>

          <div className="absolute bottom-8 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.4em]">
            Leara Desktop v1.0
          </div>
        </div>
      ) : currentView === 'dashboard' ? (
        <Dashboard />
      ) : (
        <>
          <AnimatePresence>
            {isThemeTransitioning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none backdrop-blur-sm",
                  theme === 'dark' ? "bg-black" : "bg-white"
                )}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  {theme === 'dark' ? <Moon className="w-8 h-8 text-white" /> : <Sun className="w-8 h-8 text-black" />}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {showEnterPin && (
              <Suspense fallback={<LazyComponentFallback />}>
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
              </Suspense>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isLearningActive && (
              <Suspense fallback={<LazyComponentFallback />}>
                <LearningMode 
                  activeFile={activeFile as any} 
                  onClose={stopLearning}
                  onOpenSettings={() => setIsSettingsModalOpen(true)}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <Suspense fallback={<LazyComponentFallback />}>
            <SettingsModal 
              isOpen={isSettingsModalOpen} 
              onClose={() => setIsSettingsModalOpen(false)} 
            />
          </Suspense>

          <Suspense fallback={<LazyComponentFallback />}>
            <HelpModal 
              isOpen={isHelpModalOpen} 
              onClose={() => setIsHelpModalOpen(false)} 
            />
          </Suspense>
          
          <main className="flex-1 flex overflow-hidden relative">
            {/* Main Side + Editor Area */}
            <div className={cn(
              "flex-1 flex overflow-hidden",
              sidebarPosition === 'right' ? "flex-row-reverse" : "flex-row"
            )}>
              {/* Sidebar Area */}
              <aside 
                style={{ width: sidebarWidth }}
                className={cn(
                  "border-white/5 flex flex-col bg-[#1e1e1e] relative shrink-0 overflow-hidden",
                  sidebarPosition === 'left' ? "border-r" : "border-l"
                )}
              >
                <Suspense fallback={<LazyComponentFallback />}>
                  {sidebarTab === 'search' ? <CodeSearch /> : <FileExplorer />}
                </Suspense>
                
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

              {/* Right Area (Editor & Terminal) */}
              <section className="flex-1 flex flex-col overflow-hidden relative bg-[#1e1e1e]">
                {/* Tab Bar */}
                <TabBar />
                
                <div className="flex-1 overflow-hidden flex">
                  <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
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
                        <Suspense fallback={<LazyComponentFallback />}>
                          <Preview />
                        </Suspense>
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

            {/* Right Sidebar: AI Copilot - Now Integrated into Flex flow to push content */}
            <AnimatePresence initial={false}>
              {isAIPanelOpen && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: aiSidebarWidth, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.75 }}
                  className="border-l border-white/5 bg-[#1e1e1e] flex flex-col relative shrink-0 overflow-hidden"
                  style={{ willChange: 'width, opacity' }}
                >
                  {/* Resize Handle */}
                  <div
                    className="absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize bg-transparent hover:bg-emerald-500/50 transition-colors z-30"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizingAI(true);
                    }}
                  />
                  <Suspense fallback={<LazyComponentFallback />}>
                    {rightPanelView === 'ai' && <CopilotPanel />}
                    {rightPanelView === 'scm' && <SourceControlPanel />}
                    {rightPanelView === 'ops' && <WorkspaceOpsPanel />}
                  </Suspense>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Sidebar Toggle Bar - Hyper Minimal */}
            <div className="w-11 bg-[#1e1e1e] border-l border-white/5 flex flex-col items-center py-4 gap-3.5 shrink-0">
              <button 
                onClick={() => {
                  if (isAIPanelOpen && rightPanelView === 'ai') {
                    setIsAIPanelOpen(false);
                  } else {
                    setRightPanelView('ai');
                    setIsAIPanelOpen(true);
                  }
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  isAIPanelOpen && rightPanelView === 'ai'
                    ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20"
                    : "text-zinc-600 hover:text-white hover:bg-white/5"
                )}
                title="Toggle AI Panel"
              >
                <PanelRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (isAIPanelOpen && rightPanelView === 'scm') {
                    setIsAIPanelOpen(false);
                  } else {
                    setRightPanelView('scm');
                    setIsAIPanelOpen(true);
                  }
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  isAIPanelOpen && rightPanelView === 'scm'
                    ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20"
                    : "text-zinc-600 hover:text-white hover:bg-white/5"
                )}
                title="Source Control"
              >
                <div className="relative">
                  <Github className="w-4 h-4" />
                  {totalChangeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-emerald-500 text-black text-[8px] font-black rounded-full px-0.5 border border-[#1e1e1e] shadow-sm">
                      {totalChangeCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  if (isAIPanelOpen && rightPanelView === 'ops') {
                    setIsAIPanelOpen(false);
                  } else {
                    setRightPanelView('ops');
                    setIsAIPanelOpen(true);
                  }
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  isAIPanelOpen && rightPanelView === 'ops'
                    ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20"
                    : "text-zinc-600 hover:text-white hover:bg-white/5"
                )}
                title="Workspace Ops"
              >
                <ListChecks className="w-4 h-4" />
              </button>
              <div className="mt-auto flex flex-col gap-2.5">
                <button 
                  onClick={() => setIsHelpModalOpen(true)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    isHelpModalOpen ? "bg-emerald-600/20 text-emerald-500 border border-emerald-500/20" : "text-zinc-600 hover:text-white hover:bg-white/5"
                  )}
                  title="Help"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>
          </main>
        </>
      )}

      {/* Status Bar - High Density */}
      <footer className="h-5 bg-[#0a0a0a] border-t border-white/5 text-zinc-600 flex items-center justify-between px-4 text-[8px] font-bold uppercase tracking-widest shrink-0 select-none">
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
