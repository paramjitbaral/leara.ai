import React, { useEffect, useState } from 'react';
import {
  Home,
  LayoutDashboard,
  Star,
  Clock,
  Plus,
  Github,
  User,
  Settings,
  Search,
  MoreVertical,
  ExternalLink,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  History,
  Terminal,
  Code2,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
  LogOut,
  Sun,
  Moon,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  LogIn,
  ShieldCheck,
  Info,
  Archive,
  ArchiveRestore,
  Monitor,
  Check,
  Globe,
  Cpu
} from 'lucide-react';
import { LearaLogo } from './LearaLogo';
import { useStore } from '../store';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db, logOut, signIn, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { localStore } from '../lib/storage';
import { storageService } from '../lib/storageService';
import * as Dialog from '@radix-ui/react-dialog';
import { ApiKeyModal } from './ApiKeyModal';
import axios from 'axios';
import { toast } from 'sonner';

const ProjectSkeleton: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => (
  <div className={cn(
    "border rounded-xl p-4 flex items-center gap-6 animate-pulse",
    theme === 'dark' ? "bg-white/5 border-white/5" : "bg-white border-zinc-100 shadow-sm"
  )}>
    <div className={cn("w-12 h-12 rounded-xl shrink-0", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
    <div className="flex-1 space-y-2">
      <div className={cn("h-4 w-1/4 rounded", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
      <div className={cn("h-3 w-1/2 rounded", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
    </div>
    <div className="hidden md:flex flex-col items-end gap-2 px-6 border-l border-zinc-100 dark:border-white/5">
      <div className={cn("h-2 w-16 rounded", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
      <div className={cn("h-3 w-20 rounded", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
    </div>
  </div>
);

const StatSkeleton: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => (
  <div className={cn(
    "border rounded-2xl p-6 animate-pulse",
    theme === 'dark' ? "bg-[#111] border-white/5" : "bg-white border-zinc-100 shadow-sm"
  )}>
    <div className={cn("w-10 h-10 rounded-xl mb-4", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
    <div className={cn("h-3 w-20 rounded mb-2", theme === 'dark' ? "bg-white/5" : "bg-zinc-100")} />
    <div className={cn("h-6 w-12 rounded", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />
  </div>
);

export const Dashboard: React.FC = () => {
  const {
    setCurrentView,
    user,
    theme,
    setTheme,
    setActiveProject,
    userId,
    isApiKeyModalOpen,
    setIsApiKeyModalOpen,
    userApiKey,
    setUserApiKey
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'projects' | 'favorites' | 'settings'>('dashboard');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string, folderName: string } | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [projectSubFilter, setProjectSubFilter] = useState<'all' | 'archived'>('all');
  const [storageUsed, setStorageUsed] = useState('Calculating...');
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'appearance' | 'editor' | 'ai' | 'account'>('general');

  const handleProjectClick = (project: any) => {
    setActiveProject(project);
    setCurrentView('editor');
  };

  const fetchStorageStats = async () => {
    try {
      const res = await axios.get(`/api/workspace/stats?userId=${user?.uid || 'local-desktop-user'}`);
      if (res.data && res.data.formatted) {
        setStorageUsed(res.data.formatted);
      } else {
        setStorageUsed('Restart Server!');
      }
    } catch (e) {
      console.warn('Could not fetch storage stats', e);
      setStorageUsed('Unknown');
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;

      // Local Mode: Fetch projects from server filesystem
      if (user.uid === 'local-desktop-user' || !db) {
        try {
          const res = await axios.get(`/api/files?userId=${user.uid}`);
          // On the server, /api/files returns the tree. 
          // For the dashboard, we just want the top-level directories as projects.
          setProjects(res.data.map((p: any) => ({
            id: p.name,
            name: p.name,
            folderName: p.name,
            updatedAt: { toDate: () => new Date() },
            isStarred: false
          })));
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to fetch local projects:', error);
          setIsLoading(false);
        }
        return;
      }

      // Cloud Mode: Fetch projects from Firestore
      try {
        const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const projectsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setProjects(projectsData);
          setIsLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'projects');
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (e) {
        console.error('Firestore subscription failed:', e);
        setIsLoading(false);
      }
    };

    fetchProjects();
    fetchStorageStats();
  }, [user]);

  const backupFilesToFirestore = async (projectId: string, files: any[]) => {
    try {
      await storageService.batchBackup(projectId, files);
    } catch (error) {
      console.error('Failed to backup files:', error);
      toast.error('Sync failed, but project is available locally.');
    }
  };

  const createNewProject = async () => {
    if (!user || !newProjectName.trim()) return;
    setIsSubmitting(true);
    try {
      // 1. Create folder on server
      const folderName = newProjectName.toLowerCase().replace(/\s+/g, '-');
      await axios.post('/api/files/create', {
        userId,
        path: '',
        type: 'directory',
        name: folderName
      });

      // 2. Add starter file
      const readmePath = `${folderName}/README.md`;
      const readmeContent = `# ${newProjectName}\n\n${newProjectDesc || 'A fresh new coding environment'}`;
      await axios.post('/api/files/create', {
        userId,
        path: folderName,
        type: 'file',
        name: 'README.md'
      });
      await axios.post('/api/files/save', {
        userId,
        path: readmePath,
        content: readmeContent
      });

      // 3. Add to Firestore (Optional Cloud registration)
      let projectId = folderName;
      if (user.uid !== 'local-desktop-user' && db) {
        try {
          const docRef = await addDoc(collection(db, 'projects'), {
            name: newProjectName,
            description: newProjectDesc || 'A fresh new coding environment',
            folderName: folderName,
            template: 'React',
            status: 'Active',
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isStarred: false,
            user: {
              name: user.displayName,
              avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/32/32`
            }
          });
          projectId = docRef.id;

          // 4. Backup starter files to Firestore
          await backupFilesToFirestore(projectId, [
            { id: folderName, name: folderName, type: 'directory' },
            { id: readmePath, name: 'README.md', type: 'file', content: readmeContent }
          ]);
        } catch (err) {
          console.warn('Firestore project registration skipped:', err);
        }
      }

      toast.success('Project created successfully!');
      setIsCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      fetchStorageStats();
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const importRepo = async () => {
    if (!user || !githubUrl.trim()) return;
    setIsSubmitting(true);
    setImportProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.floor(Math.random() * 10);
      });
    }, 400);

    try {
      const res = await axios.post('/api/github/import', {
        userId,
        repoUrl: githubUrl
      });

      const repoName = res.data.folder;
      const fileTree = res.data.fileTree;

      let newProject: any = null;

      // 3. Add to Firestore (Optional Cloud registration)
      if (user.uid !== 'local-desktop-user' && db) {
        try {
          const docRef = await addDoc(collection(db, 'projects'), {
            name: repoName,
            description: `Imported from ${githubUrl}`,
            folderName: repoName,
            template: 'GitHub',
            status: 'Active',
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isStarred: false,
            user: {
              name: user.displayName,
              avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/32/32`
            }
          });

          const projectId = docRef.id;
          newProject = {
            id: projectId,
            name: repoName,
            description: `Imported from ${githubUrl}`,
            folderName: repoName,
            template: 'GitHub',
            status: 'Active',
            ownerId: user.uid,
            user: {
              name: user.displayName,
              avatar: user.photoURL || `https://picsum.photos/seed/${user.uid}/32/32`
            }
          };

          // Backup all imported files to Firestore
          if (fileTree) {
            toast.info('Indexing files...', { duration: 5000 });
            await backupFilesToFirestore(projectId, fileTree);
          }
        } catch (err) {
          console.warn('Firestore import registration skipped:', err);
        }
      } else {
        // Local only newProject for redirection
        newProject = {
          id: repoName,
          name: repoName,
          folderName: repoName,
          ownerId: user.uid
        };
      }

      setImportProgress(100);
      setTimeout(() => {
        toast.success('Repository imported successfully!');
        setIsImportDialogOpen(false);
        setGithubUrl('');
        setImportProgress(0);
        fetchStorageStats();
        // Automatically open the project
        if (newProject) {
          handleProjectClick(newProject);
        }
      }, 500);

    } catch (error: any) {
      console.error("Error importing repo:", error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to import repository';
      const errorDetails = error.response?.data?.details;

      toast.error('Import Failed', {
        description: errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage,
      });
    } finally {
      clearInterval(progressInterval);
      setIsSubmitting(false);
    }
  };

  const deleteProject = async () => {
    if (!projectToDelete) return;
    const { id: projectId, folderName } = projectToDelete;

    try {
      await storageService.deleteProject(userId, projectId, folderName);

      // Remove from local state immediately in case Firestore isn't connected
      setProjects(prev => prev.filter(p => p.id !== projectId));

      toast.success('Project deleted');
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
      fetchStorageStats();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error('Failed to delete project');
    }
  };

  const toggleStar = async (projectId: string, currentStarred: boolean) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        isStarred: !currentStarred
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const toggleArchive = async (projectId: string, currentStatus: string) => {
    if (!user) return;

    const newStatus = currentStatus === 'Archived' ? 'Active' : 'Archived';

    // Cloud Mode
    if (user.uid !== 'local-desktop-user' && db) {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        toast.success(newStatus === 'Archived' ? 'Project archived' : 'Project restored');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
      }
      return;
    }

    // Local Mode: Fallback to local state if no DB
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, status: newStatus } : p
    ));
    toast.success(newStatus === 'Archived' ? 'Project archived' : 'Project restored');
  };

  const filteredProjects = projects
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const isArchived = p.status === 'Archived';

      if (activeTab === 'favorites') return matchesSearch && p.isStarred;
      if (projectSubFilter === 'archived') return matchesSearch && isArchived;
      if (projectSubFilter === 'all') return matchesSearch && !isArchived;

      return matchesSearch;
    })
    .sort((a, b) => {
      const timeA = a.updatedAt?.seconds || a.updatedAt?.toDate?.()?.getTime() || 0;
      const timeB = b.updatedAt?.seconds || b.updatedAt?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });

  return (
    <div className={cn(
      "flex h-screen w-screen font-sans overflow-hidden transition-colors duration-300",
      theme === 'dark' ? "bg-[#080808] text-[#e1e1e1]" : "bg-[#f8f9fa] text-zinc-900"
    )}>
      {/* Sidebar - Minimalist & Sleek */}
      <aside className={cn(
        "w-20 lg:w-52 border-r flex flex-col shrink-0 transition-all duration-300 h-full overflow-hidden",
        theme === 'dark' ? "bg-[#0a0a0a] border-white/5" : "bg-white border-zinc-100"
      )}>
        {/* Header - Fixed */}
        <div className="p-6 cursor-pointer" onClick={() => setActiveTab('home')}>
          <LearaLogo size="md" />
        </div>

        <nav className="flex-1 px-4 space-y-4 mt-4 flex flex-col min-h-0 overflow-hidden">
          {/* Sidebar Nav Buttons */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('home')}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group",
                activeTab === 'home' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <Home className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:block text-[13px] font-medium tracking-tight">Home</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                activeTab === 'dashboard' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="hidden lg:block text-sm font-medium">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                activeTab === 'projects' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <Layers className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:block text-sm font-medium">Projects</span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                activeTab === 'favorites' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <Star className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:block text-sm font-medium">Favorites</span>
            </button>
          </div>

          {/* Recent Activity Section - Flex Grow & Scrollable */}
          <div className="hidden lg:flex flex-1 flex-col overflow-hidden pt-2 min-h-0">
            <div className="flex items-center justify-between px-3 mb-3 shrink-0">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Recent Activity</span>
              <Activity className="w-3 h-3 text-zinc-600" />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent px-3 space-y-3 pb-4">
              {projects.length > 0 ? (
                [...projects]
                  .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
                  .slice(0, 8)
                  .map(project => (
                    <div key={project.id} className="flex items-start gap-3 group/activity transition-all hover:translate-x-0.5">
                      <div className="w-1 h-8 bg-zinc-800 group-hover/activity:bg-emerald-500 rounded-full mt-1 transition-colors shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] text-zinc-300 truncate font-medium group-hover/activity:text-emerald-400 transition-colors">Updated {project.name}</span>
                        <span className="text-[9px] text-zinc-600">
                          {project.updatedAt?.toDate ? project.updatedAt.toDate().toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-[10px] text-zinc-600 italic">No recent activity</p>
              )}
            </div>
          </div>
        </nav>

        {/* Footer - High-Density Minimalist */}
        <div className="p-2 pb-3 border-t border-white/5 space-y-0.5 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group",
              activeTab === 'settings' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            <span className="hidden lg:block text-xs font-medium">Settings</span>
          </button>
          <button
            onClick={() => {
              logOut();
              if (user?.uid === 'local-desktop-user') {
                useStore.getState().setUser(null);
                window.location.reload();
              }
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all group text-zinc-500 hover:text-red-400 hover:bg-red-500/5 active:scale-95"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden lg:block text-xs font-medium">Logout</span>
          </button>
          {user?.uid === 'local-desktop-user' ? (
            <button
              onClick={() => signIn(false)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-all group mt-1.5 active:scale-95 shadow-sm"
            >
              <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">Sign Up</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white/[0.02] rounded-lg border border-white/5 mt-1.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </div>
              <div className="hidden lg:flex flex-col min-w-0 pr-2">
                <span className="text-[11px] font-bold text-white truncate">{user?.displayName || 'User'}</span>
                <span className="text-[9px] text-zinc-600 truncate">{user?.email || 'user@example.com'}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content - Modern Bento Grid Layout */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-8 z-10 shrink-0",
          theme === 'dark' ? "bg-[#080808] border-white/5" : "bg-white border-zinc-100 shadow-sm"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "bg-white/5 text-zinc-400 group-hover:text-emerald-500" : "bg-zinc-50 text-zinc-500 border border-zinc-200/50"
            )}>
              {activeTab === 'home' && <LayoutDashboard className="w-4 h-4" />}
              {activeTab === 'dashboard' && <Cpu className="w-4 h-4" />}
              {activeTab === 'projects' && <FolderOpen className="w-4 h-4" />}
              {activeTab === 'favorites' && <Sparkles className="w-4 h-4" />}
              {activeTab === 'settings' && <Settings className="w-4 h-4" />}
            </div>
            <div className="flex flex-col">
              <h1 className={cn(
                "text-[15px] font-bold tracking-tight leading-none mb-1",
                theme === 'dark' ? "text-white" : "text-zinc-900"
              )}>
                {activeTab === 'home' && 'Workspace Home'}
                {activeTab === 'dashboard' && 'Active Environments'}
                {activeTab === 'projects' && 'Source Explorer'}
                {activeTab === 'favorites' && 'Pinned Projects'}
                {activeTab === 'settings' && 'System Preferences'}
              </h1>
              <p className={cn(
                "text-[11px] font-medium opacity-80",
                theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}>
                {activeTab === 'home' && 'Central Control'}
                {activeTab === 'dashboard' && 'Manage your local playgrounds'}
                {activeTab === 'projects' && 'Browse repositories'}
                {activeTab === 'favorites' && 'Quick access'}
                {activeTab === 'settings' && 'Configure workspace'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center rounded-lg px-4 py-2 transition-all w-48 md:w-64",
              theme === 'dark' ? "bg-white/5" : "bg-zinc-100"
            )}>
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Find a playground..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] ml-2 w-full placeholder:text-zinc-500 dark:text-white text-zinc-900"
              />
            </div>

            <div className={cn("w-px h-4 mx-1", theme === 'dark' ? "bg-white/10" : "bg-zinc-200")} />

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' 
                  ? "hover:bg-white/5 text-zinc-400 hover:text-white" 
                  : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
              )}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-[11px] font-bold",
                theme === 'dark' 
                  ? "bg-white text-black hover:bg-zinc-200" 
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              New Playground
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'home' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading && projects.length === 0
                  ? [1, 2, 3, 4].map((i) => <StatSkeleton key={i} theme={theme} />)
                  : [
                    { title: 'Recent Projects', icon: Clock, count: projects.length, color: 'emerald' },
                    { title: 'Starred', icon: Star, count: projects.filter(p => p.isStarred).length, color: 'yellow' },
                    { title: 'Collaborators', icon: User, count: 0, color: 'emerald' },
                    { title: 'Storage Used', icon: Layers, count: storageUsed, color: 'emerald' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.1 }}
                      className={cn(
                        "border rounded-xl p-5 transition-all text-left",
                        theme === 'dark' ? "bg-[#111] border-white/5 hover:border-white/10" : "bg-white border-zinc-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                        stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"
                      )}>
                        <stat.icon className="w-4.5 h-4.5" />
                      </div>
                      <h4 className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{stat.title}</h4>
                      <p className={cn(
                        "mt-1",
                        typeof stat.count === 'string' && stat.count.length > 10 ? "text-sm font-semibold opacity-70 mt-2" : "text-xl font-bold",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>{stat.count}</p>
                    </motion.div>
                  ))
                }
              </div>

              <div className={cn(
                "p-8 rounded-2xl border",
                theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"
              )}>
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>
                  {user?.uid === 'local-desktop-user' ? 'Welcome to Leara Desktop!' : `Welcome back, ${user?.displayName?.split(' ')[0] || 'Developer'}!`}
                </h2>
                <p className="text-zinc-500 mt-2">
                  {user?.uid === 'local-desktop-user'
                    ? 'Working offline with your local files and local AI.'
                    : `You have ${projects.length} active projects and 2 pending invitations.`}
                </p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="mt-6 px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {(activeTab === 'dashboard' || activeTab === 'projects' || activeTab === 'favorites') && (
            <>
              {/* Bento Grid Actions - Only show on Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    whileHover={{ y: -2 }}
                    onClick={() => setIsCreateDialogOpen(true)}
                    className={cn(
                      "lg:col-span-2 border rounded-2xl p-8 flex flex-col lg:flex-row justify-between group cursor-pointer relative overflow-hidden transition-all duration-300",
                      theme === 'dark' 
                        ? "bg-[#0a0a0a] border-white/5" 
                        : "bg-white border-zinc-100 shadow-sm"
                    )}
                  >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#10b981_0.5px,transparent_0.5px)] [background-size:16px_16px]" />

                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:rotate-6 group-hover:scale-110">
                      <Code2 className="w-56 h-56" />
                    </div>

                    <div className="flex-1 space-y-6 relative z-10">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                        theme === 'dark' ? "bg-white/5 text-emerald-500 border border-white/10" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      )}>
                        <Plus className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h2 className={cn(
                          "text-2xl font-bold tracking-tight",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>
                          Create New <span className="text-emerald-500">Playground</span>
                        </h2>
                        <p className="text-zinc-500 max-w-sm font-medium leading-relaxed text-[13px]">
                          Launch high-performance environments for your favorite tech stack in seconds.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className={cn(
                          "px-5 py-2 font-bold rounded-lg transition-all flex items-center gap-2 text-[11px] uppercase tracking-widest border shadow-sm",
                          theme === 'dark' 
                            ? "bg-white text-black border-white hover:bg-zinc-200" 
                            : "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 shadow-zinc-950/20"
                        )}>
                          Get Started <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 gap-6">
                    <motion.div
                      whileHover={{ y: -4 }}
                      onClick={() => setIsImportDialogOpen(true)}
                      className={cn(
                        "border rounded-2xl p-6 flex flex-col justify-between group cursor-pointer transition-all",
                        theme === 'dark' ? "bg-[#111] border-white/5 hover:border-white/10" : "bg-white border-zinc-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                          theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                        )}>
                          <Github className="w-5 h-5" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="mt-4">
                        <h3 className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>Import Repo</h3>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">Connect GitHub account</p>
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ y: -4 }}
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className={cn(
                        "border rounded-2xl p-6 flex flex-col justify-between group cursor-pointer transition-all",
                        theme === 'dark' ? "bg-[#111] border-white/5 hover:border-white/10" : "bg-white border-zinc-100 shadow-sm hover:shadow-md"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                          theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-emerald-50 border-emerald-100 text-emerald-500"
                        )}>
                          <Settings className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500">+12%</span>
                      </div>
                      <div className="mt-4">
                        <h3 className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>AI Settings</h3>
                        <p className="text-xs text-zinc-500 mt-1 font-medium">Configure Gemini API</p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Project List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className={cn(
                      "text-lg font-bold",
                      theme === 'dark' ? "text-white" : "text-zinc-900"
                    )}>
                      {activeTab === 'favorites' ? 'Favorite Projects' : 'Your Projects'}
                    </h3>
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-full">
                      {filteredProjects.length} {activeTab === 'favorites' ? 'STARRED' : 'TOTAL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProjectSubFilter('all')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all rounded-lg",
                        projectSubFilter === 'all' ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-500 hover:text-white"
                      )}
                    >All</button>
                    <button
                      onClick={() => setProjectSubFilter('archived')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all rounded-lg",
                        projectSubFilter === 'archived' ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-500 hover:text-white"
                      )}
                    >Archived</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {isLoading && projects.length === 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {[1, 2, 3, 4, 5].map(i => <ProjectSkeleton key={i} theme={theme} />)}
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className={cn(
                      "text-center py-12 rounded-2xl border border-dashed",
                      theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-zinc-200"
                    )}>
                      <FolderOpen className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                      <p className="text-zinc-500 font-medium">
                        {projects.length === 0 ? "No projects yet. Create one to get started!" : "No projects found matching your search."}
                      </p>
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <motion.div
                        key={project.id}
                        role="button"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleProjectClick(project)}
                        className={cn(
                          "group border rounded-xl p-3 flex items-center gap-4 cursor-pointer transition-all active:scale-[0.98]",
                          theme === 'dark' ? "bg-[#0f0f0f] border-white/5 hover:border-emerald-500/30" : "bg-white border-zinc-100 hover:border-emerald-500/30 hover:shadow-md"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                          theme === 'dark' ? "bg-zinc-900 border-white/5" : "bg-zinc-50 border-zinc-100"
                        )}>
                          <Code2 className="w-6 h-6 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h4 className={cn(
                              "font-bold transition-colors",
                              theme === 'dark' ? "text-white group-hover:text-emerald-400" : "text-zinc-900 group-hover:text-emerald-600"
                            )}>{project.name}</h4>
                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-bold rounded uppercase tracking-wider">
                              {project.template}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 truncate max-w-xl font-medium">{project.description}</p>
                        </div>

                        <div className="hidden md:flex flex-col items-end gap-1 px-6 border-l border-zinc-100 dark:border-white/5">
                          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Last Modified</span>
                          <span className="text-xs text-zinc-400 font-medium">
                            {project.updatedAt?.toDate ? project.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                          </span>
                        </div>

                        <div className="hidden lg:flex items-center gap-3 px-6 border-l border-zinc-100 dark:border-white/5">
                          <img src={project.user?.avatar} alt={project.user?.name} className="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                          <span className="text-xs text-zinc-500 font-medium">{project.user?.name?.split(' ')[0]}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(project.id, project.isStarred);
                            }}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              project.isStarred ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-600 hover:text-white hover:bg-white/5"
                            )}
                          >
                            <Star className={cn("w-4 h-4", project.isStarred && "fill-current")} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleArchive(project.id, project.status);
                            }}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              project.status === 'Archived' ? "text-amber-500 bg-amber-500/10" : "text-zinc-600 hover:text-white hover:bg-white/5"
                            )}
                            title={project.status === 'Archived' ? "Restore project" : "Archive project"}
                          >
                            {project.status === 'Archived' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete({ id: project.id, folderName: project.folderName });
                              setIsDeleteDialogOpen(true);
                            }}
                            className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
                            title="Delete project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          {activeTab === 'settings' && (
            <div className={cn(
              "flex flex-1 -m-8 h-[calc(100vh-80px)]",
              theme === 'dark' ? "bg-[#0a0a0a]" : "bg-white"
            )}>
              {/* Settings Sidebar */}
              <aside className="w-64 border-r border-white/5 flex flex-col shrink-0">
                <nav className="p-4 space-y-1">
                  {[
                    { id: 'general', label: 'General', icon: Home },
                    { id: 'appearance', label: 'Appearance', icon: Monitor },
                    { id: 'editor', label: 'Editor', icon: Code2 },
                    { id: 'ai', label: 'AI & Intelligence', icon: Sparkles },
                    { id: 'account', label: 'Account & Security', icon: ShieldCheck },
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setSettingsSubTab(subTab.id as any)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
                        settingsSubTab === subTab.id
                          ? "bg-emerald-500/10 text-emerald-400 font-bold"
                          : "text-zinc-500 hover:bg-white/5 hover:text-white font-medium"
                      )}
                    >
                      <subTab.icon className={cn("w-4 h-4", settingsSubTab === subTab.id ? "text-emerald-400" : "text-zinc-600")} />
                      <span className="text-xs">{subTab.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="mt-auto p-4 border-t border-white/5">
                  <button
                    onClick={() => logOut()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all group"
                  >
                    <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Logout</span>
                  </button>
                </div>
              </aside>

              {/* Settings Content Area */}
              <div className="flex-1 flex flex-col min-w-0 bg-white/[0.01]">

                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                  {settingsSubTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Workspace Management</h4>
                        <div className="space-y-1">
                          {[
                            { label: 'Auto-save changes', desc: 'Automatically commit changes to the local filesystem', enabled: true },
                            { label: 'Telemetry', desc: 'Share anonymous usage data to help improve Leara', enabled: false },
                            { label: 'Sync to Cloud', desc: 'Real-time backup of your workspace to secure cloud storage', enabled: user?.uid !== 'local-desktop-user' },
                          ].map((pref, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.02] transition-all group">
                              <div className="space-y-0.5">
                                <p className={cn(
                                  "text-sm font-bold",
                                  theme === 'dark' ? "text-zinc-200" : "text-zinc-900"
                                )}>{pref.label}</p>
                                <p className="text-xs text-zinc-500 font-medium">{pref.desc}</p>
                              </div>
                              <div className={cn(
                                "w-10 h-5 rounded-full p-1 transition-all cursor-pointer relative",
                                pref.enabled ? 'bg-emerald-500' : 'bg-zinc-800'
                              )}>
                                <div className={cn(
                                  "w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                  pref.enabled ? 'translate-x-5' : 'translate-x-0'
                                )} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Storage Information</h4>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                              <Archive className="w-5 h-5" />
                            </div>
                            <div>
                              <p className={cn(
                                "text-sm font-bold",
                                theme === 'dark' ? "text-white" : "text-zinc-900"
                              )}>Local Workspace Storage</p>
                              <p className="text-xs text-zinc-500 font-medium">Used: {storageUsed} / Unlimited</p>
                            </div>
                          </div>
                          <button className="text-xs font-bold text-emerald-500 hover:underline">Clear Cache</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'appearance' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "flex flex-col items-start p-6 rounded-2xl border transition-all relative overflow-hidden group",
                            theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/50" : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all",
                            theme === 'dark' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "bg-zinc-800 text-zinc-400 group-hover:text-white"
                          )}>
                            <Moon className="w-5 h-5" />
                          </div>
                          <span className={cn("font-black uppercase tracking-widest text-xs", theme === 'dark' ? "text-white" : "text-zinc-500")}>Shadow Theme</span>
                          <p className="text-[10px] text-zinc-500 mt-1 font-bold">Recommended for Night Engineering</p>
                          {theme === 'dark' && <Check className="absolute top-4 right-4 w-4 h-4 text-emerald-500" />}
                        </button>

                        <button
                          onClick={() => setTheme('light')}
                          className={cn(
                            "flex flex-col items-start p-6 rounded-2xl border transition-all relative overflow-hidden group",
                            theme === 'light' ? "bg-emerald-500/10 border-emerald-500/50" : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all",
                            theme === 'light' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "bg-white text-zinc-500 group-hover:text-zinc-900"
                          )}>
                            <Sun className="w-5 h-5" />
                          </div>
                          <span className={cn("font-black uppercase tracking-widest text-xs", theme === 'light' ? "text-white" : "text-zinc-500")}>Daylight Theme</span>
                          <p className="text-[10px] text-zinc-500 mt-1 font-bold">Optimized for Maximum Contrast</p>
                          {theme === 'light' && <Check className="absolute top-4 right-4 w-4 h-4 text-emerald-500" />}
                        </button>
                      </div>

                      <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white/50">Interface Polish</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-zinc-300">Glassmorphism Effects</span>
                            <div className="w-10 h-5 bg-emerald-500 rounded-full p-1"><div className="w-3 h-3 bg-white rounded-full translate-x-5" /></div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-zinc-300">High-Density Explorer</span>
                            <div className="w-10 h-5 bg-emerald-500 rounded-full p-1"><div className="w-3 h-3 bg-white rounded-full translate-x-5" /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'editor' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Font Family</label>
                          <select className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none">
                            <option>JetBrains Mono</option>
                            <option>Cascadia Code</option>
                            <option>Fira Code</option>
                            <option>Roboto Mono</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Font Size</label>
                          <div className="flex items-center gap-4">
                            <input type="range" className="flex-1 accent-emerald-500" defaultValue={14} />
                            <span className="w-10 text-center font-bold text-sm text-white">14px</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Editor Features</h4>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                          {[
                            'Minimap Enabled', 'Bracket Pair Colorization', 'Smooth Caret Animation',
                            'Format on Save', 'AI Code Completion', 'Inlay Hints'
                          ].map((feat) => (
                            <div key={feat} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-all">
                              <span className="text-xs font-bold text-zinc-300">{feat}</span>
                              <div className="w-8 h-4 bg-emerald-500 rounded-full p-0.5"><div className="w-3 h-3 bg-white rounded-full translate-x-4" /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'ai' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-black shrink-0">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black uppercase tracking-tight text-white line-clamp-1">Intelligent Workspace</h4>
                          <p className="text-xs text-zinc-400 font-medium leading-relaxed mt-1">Configure your AI providers to enable code explanation, generation, and automated fixes across your codebase.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Connected Providers</h4>
                        <div className="space-y-3">
                          {[
                            { id: 'gemini', name: 'Google Gemini 1.5 Pro', status: useStore.getState().providerKeys.gemini ? 'Connected' : 'Missing Key', icon: Globe },
                            { id: 'openai', name: 'OpenAI GPT-4o', status: useStore.getState().providerKeys.openai ? 'Connected' : 'Missing Key', icon: Cpu },
                            { id: 'ollama', name: 'Ollama (Local LLM)', status: 'System Default', icon: Monitor },
                          ].map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors">
                                  <p.icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white">{p.name}</p>
                                  <p className={cn("text-[9px] font-black uppercase tracking-widest", p.status === 'Connected' ? "text-emerald-500" : "text-amber-500/50")}>{p.status}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setIsApiKeyModalOpen(true)}
                                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all shadow-sm"
                              >Configure</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === 'account' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="p-8 rounded-2xl bg-[#111] border border-white/5 flex flex-col items-center text-center space-y-4">
                        <div className="relative group">
                          <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-emerald-500/20 overflow-hidden group-hover:border-emerald-500/50 transition-all">
                            {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-12 h-12 text-zinc-600 m-6" />}
                          </div>
                          <button className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">{user?.displayName}</h3>
                          <p className="text-sm text-zinc-500 font-medium">{user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">Pro Member</span>
                          <span className="px-3 py-1 bg-white/5 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/5">Local Sync</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Security Actions</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <button className="p-4 rounded-xl bg-white/5 border border-white/5 text-left hover:bg-white/10 transition-all group">
                            <h5 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Setup Two-Factor Auth</h5>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Add an extra layer of security</p>
                          </button>
                          <button className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-left hover:bg-red-500/10 transition-all group">
                            <h5 className="text-sm font-bold text-red-400">Delete Account</h5>
                            <p className="text-xs text-zinc-500 font-medium mt-1">Permanently remove your data</p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* Create Project Dialog */}
      <Dialog.Root open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
          <Dialog.Content className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200 p-8",
            theme === 'dark' ? "bg-[#0c0c0c] border-white/10 rounded-2xl" : "bg-white border-zinc-200 rounded-2xl"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-emerald-500",
                  theme === 'dark' ? "bg-emerald-500/10" : "bg-emerald-50"
                )}>
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className={cn(
                    "text-lg font-bold tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>New Project</Dialog.Title>
                  <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                    Start a fresh workspace
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className={cn(
                "p-2 rounded-lg transition-all hover:bg-zinc-100 dark:hover:bg-white/5",
                theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}>
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="project-name" className="text-xs font-semibold text-zinc-500 ml-1">Project Name</label>
                <input
                  id="project-name"
                  name="projectName"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. My Website"
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all",
                    theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                  )}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="project-desc" className="text-xs font-semibold text-zinc-500 ml-1">Description (Optional)</label>
                <textarea
                  id="project-desc"
                  name="projectDesc"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Short brief..."
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all h-24 resize-none",
                    theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                  )}
                />
              </div>

              <button
                onClick={createNewProject}
                disabled={isSubmitting || !newProjectName.trim()}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-lg",
                  "bg-emerald-500 text-black shadow-emerald-500/10"
                )}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Project'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Import Repo Dialog */}
      <Dialog.Root open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
          <Dialog.Content className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200 p-8",
            theme === 'dark' ? "bg-[#0c0c0c] border-white/10 rounded-2xl" : "bg-white border-zinc-200 rounded-2xl"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  theme === 'dark' ? "bg-white text-black" : "bg-zinc-900 text-white"
                )}>
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className={cn(
                    "text-lg font-bold tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>Import Repository</Dialog.Title>
                  <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                    Connect your GitHub project
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className={cn(
                "p-2 rounded-lg transition-all hover:bg-zinc-100 dark:hover:bg-white/5",
                theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}>
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="github-url" className="text-xs font-semibold text-zinc-500 ml-1">GitHub URL</label>
                <div className="relative group">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    id="github-url"
                    name="githubUrl"
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className={cn(
                      "w-full border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all",
                      theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                    )}
                    autoFocus
                  />
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-xl flex items-start gap-3 border",
                theme === 'dark' ? "bg-emerald-500/[0.03] border-emerald-500/10" : "bg-emerald-50 border-emerald-100"
              )}>
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                  We'll clone the repository into your workspace and prepare the development environment.
                </p>
              </div>

              <button
                onClick={importRepo}
                disabled={isSubmitting || !githubUrl.trim()}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center relative overflow-hidden",
                  "bg-emerald-500 text-black shadow-lg shadow-emerald-500/10"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div
                      className="absolute inset-0 bg-white/20 transition-all duration-300 pointer-events-none"
                      style={{ width: `${importProgress}%` }}
                    />
                    <span className="relative z-10 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing... {importProgress}%
                    </span>
                  </>
                ) : 'Import Repository'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
          <Dialog.Content className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-2xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-[#0c0c0c] border-white/10" : "bg-white border-zinc-200"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className={cn(
                    "text-lg font-semibold tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>Delete Project</Dialog.Title>
                  <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                    This action cannot be undone
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className={cn(
                "p-2 rounded-lg transition-all hover:bg-zinc-100 dark:hover:bg-white/5",
                theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}>
                <X className="w-5 h-5" />
              </Dialog.Close>
            </div>

            <div className="space-y-6">
              <div className={cn(
                "p-4 rounded-xl flex items-start gap-3 border",
                theme === 'dark' ? "bg-red-500/[0.02] border-red-500/10" : "bg-red-50 border-red-100"
              )}>
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Are you sure you want to delete this project? All files will be permanently removed from your workspace.
                </p>
              </div>

              <div className="flex gap-3">
                <Dialog.Close className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-zinc-100 dark:hover:bg-white/5 border",
                  theme === 'dark' ? "text-white border-white/10" : "text-zinc-900 border-zinc-200"
                )}>
                  Cancel
                </Dialog.Close>
                <button
                  onClick={deleteProject}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.98]"
                >
                  Delete
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
