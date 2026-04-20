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
  AlertCircle
} from 'lucide-react';
import { useStore } from '../store';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db, logOut, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { localStore } from '../lib/storage';
import { storageService } from '../lib/storageService';
import * as Dialog from '@radix-ui/react-dialog';
import { ApiKeyModal } from './ApiKeyModal';
import axios from 'axios';
import { toast } from 'sonner';

const ProjectSkeleton: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => (
  <div className={cn(
    "border rounded-2xl p-4 flex items-center gap-6 animate-pulse",
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
    "border rounded-3xl p-6 animate-pulse",
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

  const handleProjectClick = (project: any) => {
    setActiveProject(project);
    setCurrentView('editor');
  };

  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  const backupFilesToFirestore = async (projectId: string, files: any[]) => {
    try {
      await storageService.batchBackup(projectId, files);
    } catch (error) {
      console.error('Failed to backup files:', error);
      toast.error('Cloud backup failed, but project is available locally.');
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

      // 3. Add to Firestore
      let projectId = '';
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
        handleFirestoreError(err, OperationType.CREATE, 'projects');
      }

      toast.success('Project created successfully!');
      setIsCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
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
          toast.info('Backing up files to cloud...', { duration: 5000 });
          await backupFilesToFirestore(projectId, fileTree);
        }

      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'projects');
      }

      setImportProgress(100);
      setTimeout(() => {
        toast.success('Repository imported successfully!');
        setIsImportDialogOpen(false);
        setGithubUrl('');
        setImportProgress(0);
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
      toast.success('Project deleted');
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error('Failed to delete project');
    }
  };

  const toggleStar = async (projectId: string, currentStarred: boolean) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        isStarred: !currentStarred
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'favorites') return matchesSearch && p.isStarred;
    if (activeTab === 'projects') return matchesSearch;
    return matchesSearch;
  });

  return (
    <div className={cn(
      "flex h-screen w-screen font-sans overflow-hidden transition-colors duration-300",
      theme === 'dark' ? "bg-[#080808] text-[#e1e1e1]" : "bg-[#f8f9fa] text-zinc-900"
    )}>
      {/* Sidebar - Minimalist & Sleek */}
      <aside className={cn(
        "w-20 lg:w-64 border-r flex flex-col shrink-0 transition-all duration-300 h-full overflow-hidden",
        theme === 'dark' ? "bg-[#0a0a0a] border-white/5" : "bg-white border-zinc-100"
      )}>
        {/* Header - Fixed */}
        <div className="p-6 flex items-center gap-3 shrink-0">
          <img src="/logo.png" alt="Leara.ai" className="w-10 h-10 object-contain" />
          <h1 className={cn(
            "hidden lg:block text-xl font-bold tracking-tighter",
            theme === 'dark' ? "text-white" : "text-zinc-900"
          )}>
            <span className="text-sky-500">Leara</span><span className="text-emerald-500">.ai</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-4 mt-4 flex flex-col min-h-0 overflow-hidden">
          {/* Sidebar Nav Buttons */}
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab('home')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                activeTab === 'home' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:block text-sm font-medium">Home</span>
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
                projects.map(project => (
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

        {/* Footer - Pinned to bottom */}
        <div className="p-4 pb-4 border-t border-white/5 space-y-2 shrink-0">
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group",
              activeTab === 'settings' ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
            <span className="hidden lg:block text-sm font-medium">Settings</span>
          </button>
          <button 
            onClick={logOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group text-zinc-500 hover:text-red-400 hover:bg-red-500/5"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:block text-sm font-medium">Logout</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-2xl border border-white/5 mt-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-4 h-4 text-zinc-500" />
              )}
            </div>
            <div className="hidden lg:flex flex-col min-w-0 pr-4">
              <span className="text-xs font-bold text-white truncate">{user?.displayName || 'User'}</span>
              <span className="text-[10px] text-zinc-500 truncate">{user?.email || 'user@example.com'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Modern Bento Grid Layout */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={cn(
          "h-20 border-b flex items-center justify-between px-8 backdrop-blur-xl z-10",
          theme === 'dark' ? "bg-[#080808]/80 border-white/5" : "bg-white/80 border-zinc-100"
        )}>
          <div className="flex flex-col">
            <h1 className={cn(
              "text-xl font-bold tracking-tight",
              theme === 'dark' ? "text-white" : "text-zinc-900"
            )}>
              {activeTab === 'home' && 'Welcome Home'}
              {activeTab === 'dashboard' && 'Workspace Dashboard'}
              {activeTab === 'projects' && 'All Projects'}
              {activeTab === 'favorites' && 'Favorite Projects'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p className="text-xs text-zinc-500">
              {activeTab === 'home' && 'Your personalized coding space'}
              {activeTab === 'dashboard' && 'Manage your cloud-powered development environments'}
              {activeTab === 'projects' && 'Browse and organize your entire codebase'}
              {activeTab === 'favorites' && 'Quick access to your most important work'}
              {activeTab === 'settings' && 'Manage your account and preferences'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "p-2.5 border rounded-full transition-all",
                theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm"
              )}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative group">
              <label htmlFor="search-projects" className="sr-only">Search projects</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                id="search-projects"
                name="search"
                type="text" 
                placeholder="Search projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "border rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 w-64 transition-all",
                  theme === 'dark' 
                    ? "bg-white/5 border-white/10 text-white focus:border-emerald-500/50 focus:ring-emerald-500/20" 
                    : "bg-zinc-100 border-transparent text-zinc-900 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                )}
              />
            </div>
            <button 
              onClick={() => setIsCreateDialogOpen(true)}
              className={cn(
                "p-2.5 border rounded-full transition-all",
                theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white" : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm"
              )}
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {activeTab === 'home' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading && projects.length === 0 
                  ? [1, 2, 3, 4].map((i) => <StatSkeleton key={i} theme={theme} />)
                  : [
                      { title: 'Recent Projects', icon: Clock, count: projects.length, color: 'emerald' },
                      { title: 'Starred', icon: Star, count: projects.filter(p => p.isStarred).length, color: 'yellow' },
                      { title: 'Collaborators', icon: User, count: 0, color: 'emerald' },
                      { title: 'Storage Used', icon: Layers, count: '1.2GB', color: 'emerald' },
                    ].map((stat, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                          "border rounded-3xl p-6 transition-all",
                          theme === 'dark' ? "bg-[#111] border-white/5 hover:border-white/10" : "bg-white border-zinc-100 shadow-sm hover:shadow-md"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                          stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"
                        )}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                        <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{stat.title}</h4>
                        <p className={cn(
                          "text-2xl font-bold mt-1",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>{stat.count}</p>
                      </motion.div>
                    ))
                }
              </div>
              
              <div className={cn(
                "p-8 rounded-3xl border",
                theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"
              )}>
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>Welcome back, {user?.displayName?.split(' ')[0] || 'Developer'}!</h2>
                <p className="text-zinc-500 mt-2">You have {projects.length} active projects and 2 pending invitations.</p>
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
                    whileHover={{ y: -4 }}
                    onClick={() => setIsCreateDialogOpen(true)}
                    className={cn(
                      "lg:col-span-2 border rounded-3xl p-8 flex flex-col justify-between group cursor-pointer relative overflow-hidden transition-all",
                      theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#e8fbf3] border-emerald-100"
                    )}
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Code2 className="w-48 h-48 rotate-12" />
                    </div>
                    <div className="space-y-4 relative z-10">
                      <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/30">
                        <Plus className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className={cn(
                          "text-3xl font-bold tracking-tight",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>Create New Playground</h2>
                        <p className="text-zinc-500 mt-2 max-w-md font-medium leading-relaxed">Launch a fresh environment with your favorite tech stack in seconds.</p>
                      </div>
                    </div>
                    <div className="mt-8 flex items-center gap-4 relative z-10">
                      <button className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all flex items-center gap-2">
                        Get Started <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                            <img src={`https://picsum.photos/seed/tech${i}/32/32`} className="w-full h-full object-cover" alt="stack" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 gap-6">
                    <motion.div 
                      whileHover={{ y: -4 }}
                      onClick={() => setIsImportDialogOpen(true)}
                      className={cn(
                        "border rounded-3xl p-6 flex flex-col justify-between group cursor-pointer transition-all",
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
                        "border rounded-3xl p-6 flex flex-col justify-between group cursor-pointer transition-all",
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
                    <button className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors">All</button>
                    <button className="px-3 py-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 rounded-lg">Recent</button>
                    <button className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors">Archived</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {isLoading && projects.length === 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {[1, 2, 3, 4, 5].map(i => <ProjectSkeleton key={i} theme={theme} />)}
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className={cn(
                      "text-center py-12 rounded-3xl border border-dashed",
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
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ x: 4 }}
                        onClick={() => handleProjectClick(project)}
                        className={cn(
                          "group border rounded-2xl p-4 flex items-center gap-6 cursor-pointer transition-all",
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
                              setProjectToDelete({ id: project.id, folderName: project.folderName });
                              setIsDeleteDialogOpen(true);
                            }}
                            className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
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
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className={cn(
                  "text-3xl font-bold tracking-tight",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>Settings</h2>
                <button 
                  onClick={() => logOut()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>Account Settings</h3>
                  <div className={cn(
                    "border rounded-3xl p-6 space-y-6",
                    theme === 'dark' ? "bg-[#111] border-white/5" : "bg-white border-zinc-100 shadow-sm"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{user?.displayName}</p>
                          <p className="text-xs text-zinc-500 font-medium">{user?.email}</p>
                        </div>
                      </div>
                      <button className={cn(
                        "px-4 py-2 border rounded-xl text-xs font-bold transition-all",
                        theme === 'dark' ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                      )}>Edit Profile</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>Preferences</h3>
                  <div className={cn(
                    "border rounded-3xl p-6 space-y-4",
                    theme === 'dark' ? "bg-[#111] border-white/5" : "bg-white border-zinc-100 shadow-sm"
                  )}>
                    {[
                      { label: 'Email Notifications', desc: 'Receive updates about your projects', enabled: true },
                      { label: 'Auto-save', desc: 'Automatically save your changes in the editor', enabled: true },
                      { label: 'Public Profile', desc: 'Allow others to see your projects', enabled: false },
                    ].map((pref, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-white/5 last:border-0">
                        <div>
                          <p className="text-sm font-bold">{pref.label}</p>
                          <p className="text-xs text-zinc-500 font-medium">{pref.desc}</p>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full p-1 transition-all cursor-pointer",
                          pref.enabled ? 'bg-emerald-500' : 'bg-zinc-800'
                        )}>
                          <div className={cn(
                            "w-3 h-3 bg-white rounded-full transition-all",
                            pref.enabled ? 'translate-x-5' : 'translate-x-0'
                          )} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>Theme & Appearance</h3>
                <div className={cn(
                  "border rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4",
                  theme === 'dark' ? "bg-[#111] border-white/5" : "bg-white border-zinc-100 shadow-sm"
                )}>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Moon className="w-5 h-5" />
                      <span className="font-bold">Dark Mode</span>
                    </div>
                    {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />}
                  </button>
                  <button 
                    onClick={() => setTheme('light')}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      theme === 'light' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Sun className="w-5 h-5" />
                      <span className="font-bold">Light Mode</span>
                    </div>
                    {theme === 'light' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />}
                  </button>
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
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
          <Dialog.Content className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-3xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-[#0c0c0c] border-white/10" : "bg-white border-zinc-200"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className={cn(
                    "text-lg font-semibold tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>New Project</Dialog.Title>
                  <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                    Start building something amazing today
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
                <label htmlFor="project-name" className="text-xs font-medium text-zinc-500 ml-1">Project Name</label>
                <input 
                  id="project-name"
                  name="projectName"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. My Awesome App"
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all",
                    theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                  )}
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="project-desc" className="text-xs font-medium text-zinc-500 ml-1">Description (Optional)</label>
                <textarea 
                  id="project-desc"
                  name="projectDesc"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="What are you building?"
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all h-24 resize-none",
                    theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                  )}
                />
              </div>

              <button 
                onClick={createNewProject}
                disabled={isSubmitting || !newProjectName.trim()}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100",
                  "bg-emerald-500 text-black"
                )}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Project'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Import Repo Dialog */}
      <Dialog.Root open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" />
          <Dialog.Content className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-3xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-[#0c0c0c] border-white/10" : "bg-white border-zinc-200"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <Dialog.Title className={cn(
                    "text-lg font-semibold tracking-tight",
                    theme === 'dark' ? "text-white" : "text-zinc-900"
                  )}>Import Repository</Dialog.Title>
                  <Dialog.Description className="text-zinc-500 text-xs mt-0.5">
                    Connect your GitHub account
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
                <label htmlFor="github-url" className="text-xs font-medium text-zinc-500 ml-1">GitHub Repository URL</label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    id="github-url"
                    name="githubUrl"
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className={cn(
                      "w-full border rounded-xl pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all",
                      theme === 'dark' ? "bg-white/[0.03] border-white/10 text-white placeholder:text-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-300"
                    )}
                    autoFocus
                  />
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-xl flex items-start gap-3 border",
                theme === 'dark' ? "bg-emerald-500/[0.02] border-emerald-500/10" : "bg-emerald-50 border-emerald-100"
              )}>
                <Github className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  We'll clone the repository into your workspace and set up a new project environment for you.
                </p>
              </div>

              <button 
                onClick={importRepo}
                disabled={isSubmitting || !githubUrl.trim()}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center relative overflow-hidden",
                  "bg-emerald-500 text-black"
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
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border rounded-3xl p-8 shadow-2xl z-[101] outline-none animate-in zoom-in-95 duration-200",
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
                  Are you sure you want to delete this project? All files and data will be permanently removed from our servers.
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
