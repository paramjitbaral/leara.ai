import React, { useState, useEffect, useCallback } from 'react';
import { useStore, FileNode } from '../store';
import { Folder, FolderOpen, File, ChevronRight, ChevronDown, Plus, FolderPlus, Trash2, Edit2, MoreVertical, Github, Loader2, Search, LayoutDashboard, RefreshCw, X } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '../lib/utils';
import axios from 'axios';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { localStore } from '../lib/storage';
import { storageService } from '../lib/storageService';

export function FileExplorer() {
  const { 
    userId, files, setFiles, addOpenFile, removeOpenFile, setActiveFile, activeFile, 
    setCurrentView, activeProject, theme, setEditorHighlightQuery, setSidebarTab, modifiedFiles 
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [creating, setCreating] = useState<{ type: 'file' | 'directory', parent: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const pathParam = activeProject?.folderName ? `&path=${activeProject.folderName}` : '';
      const res = await axios.get(`/api/files?userId=${userId}${pathParam}`);
      
      // If server returns empty but we have an active project, try to restore
      if (res.data.length === 0 && activeProject?.id) {
        console.log('Server workspace empty, attempting restore...');
        
        // 1. Try Local Storage first (Free and Fast)
        const localFiles = await localStore.getProjectFiles(activeProject.id);
        if (localFiles.length > 0) {
          console.log('Restoring from Local Storage (IndexedDB)...');
          await axios.post('/api/files/sync', { 
            userId, 
            files: localFiles.map(f => ({ path: f.path, content: f.content, type: f.type })) 
          });
          const retryRes = await axios.get(`/api/files?userId=${userId}${pathParam}`);
          setFiles(retryRes.data);
          return;
        }

        // 2. Fallback to Firestore (Cloud Backup)
        if (db) {
          console.log('Local storage empty, attempting restore from Firestore...');
          const filesRef = collection(db, 'projects', activeProject.id, 'files');
          const snapshot = await getDocs(filesRef);
          
          if (!snapshot.empty) {
            const backupFiles = snapshot.docs.map(doc => doc.data());
            await axios.post('/api/files/sync', { 
              userId, 
              files: backupFiles.map(f => ({ path: f.path, content: f.content, type: f.type })) 
            });
            
            // Also save to local storage for next time
            for (const f of backupFiles) {
              await localStore.saveFile(activeProject.id, {
                path: f.path,
                content: f.content,
                type: f.type,
                updatedAt: Date.now()
              });
            }

            const retryRes = await axios.get(`/api/files?userId=${userId}${pathParam}`);
            setFiles(retryRes.data);
            return;
          }
        }
      }
      
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, setFiles, activeProject]);

  useEffect(() => {
    if (userId) fetchFiles();
  }, [fetchFiles, userId, activeProject]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpanded(newExpanded);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !creating || !activeProject) return;
    try {
      await storageService.createNode(userId, activeProject.id, creating.parent, newName, creating.type);
      setCreating(null);
      setNewName('');
      fetchFiles();
    } catch (err) {
      toast.error('Failed to create', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleDelete = async (path: string) => {
    if (!activeProject) return;
    try {
      await storageService.deleteNode(userId, activeProject.id, path);
      fetchFiles();
      removeOpenFile(path);
    } catch (err) {
      toast.error('Failed to delete', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleRename = async (oldPath: string) => {
    if (!renameValue.trim() || renameValue === oldPath.split('/').pop() || !activeProject) {
      setRenaming(null);
      return;
    }

    const pathParts = oldPath.split('/');
    pathParts.pop();
    const newPath = pathParts.length > 0 ? `${pathParts.join('/')}/${renameValue}` : renameValue;

    try {
      await storageService.renameNode(userId, activeProject.id, oldPath, newPath, renameValue);
      setRenaming(null);
      fetchFiles();
      if (activeFile?.id === oldPath) {
        setActiveFile({ ...activeFile, id: newPath, name: renameValue });
      }
    } catch (err) {
      toast.error('Failed to rename', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleImportGithub = async () => {
    if (!githubUrl.trim()) return;
    setIsImporting(true);
    try {
      await axios.post('/api/github/import', { userId, repoUrl: githubUrl });
      setGithubUrl('');
      fetchFiles();
    } catch (err) {
      toast.error('Failed to import', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const openFile = async (node: FileNode) => {
    try {
      const res = await axios.get(`/api/files/content?userId=${userId}&path=${node.id}`);
      const ext = node.name.split('.').pop()?.toLowerCase();
      const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'md': 'markdown',
        'cpp': 'cpp',
        'c': 'c',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'sql': 'sql',
      };
      const language = languageMap[ext || ''] || 'javascript';
      addOpenFile({ ...node, content: res.data.content, language });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getFlatMatches = (nodes: FileNode[]): { node: FileNode, path: string }[] => {
    let matches: { node: FileNode, path: string }[] = [];
    const walk = (items: FileNode[], currentPath = '') => {
      items.forEach(item => {
        const fullPath = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (item.type === 'file' && fullPath) {
          matches.push({ node: item, path: currentPath });
        }
        if (item.type === 'directory' && item.children) {
          walk(item.children, currentPath ? `${currentPath}/${item.name}` : item.name);
        }
      });
    };
    walk(nodes);
    return matches;
  };

  const searchResults = getFlatMatches(files);

  const renderTree = (nodes: FileNode[], depth = 0, parentId = '') => {
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === b.type) return (a.name || '').localeCompare(b.name || '');
      return a.type === 'directory' ? -1 : 1;
    });

    return (
      <div className={cn("relative", depth > 0 && "ml-[11px] border-l border-white/5 pl-2")}>
        {creating && creating.parent === parentId && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-4 flex justify-center">
              {creating.type === 'directory' ? <Folder className="w-4 h-4 text-emerald-400" /> : <File className="w-4 h-4 text-emerald-500" />}
            </div>
            <input 
              autoFocus
              id={`new-${creating.type}`}
              name="newName"
              aria-label={`New ${creating.type} name`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(null);
              }}
              onBlur={() => setCreating(null)}
              className="bg-[#1e1e1e] border border-emerald-500 rounded px-1.5 py-0.5 text-xs w-full outline-none text-white placeholder:text-zinc-600"
              placeholder={`New ${creating.type}...`}
            />
          </div>
        )}
        {sortedNodes.map((node) => {
          const isExpanded = expanded.has(node.id);
          const isActive = activeFile?.id === node.id;
          const isRenaming = renaming === node.id;

          return (
            <div key={node.id}>
              <ContextMenu.Root>
                <ContextMenu.Trigger>
                  <div 
                    role="button"
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 hover:bg-[#2a2d2e] cursor-pointer transition-all active:scale-[0.98] group rounded-md mx-1",
                      isActive ? "bg-[#37373d] text-white" : "text-zinc-400"
                    )}
                    onClick={() => node.type === 'directory' ? toggleExpand(node.id) : openFile(node)}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {node.type === 'directory' ? (
                        <>
                          <div className="w-4 flex justify-center">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                          </div>
                          {isExpanded ? (
                            <FolderOpen className="w-4 h-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Folder className="w-4 h-4 shrink-0 text-emerald-400" />
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-4" />
                          <File className="w-4 h-4 shrink-0 text-emerald-500" />
                        </>
                      )}
                      {isRenaming ? (
                        <input
                          autoFocus
                          id={`rename-${node.id}`}
                          name="renameValue"
                          aria-label={`Rename ${node.name}`}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(node.id);
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          onBlur={() => handleRename(node.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#1e1e1e] border border-emerald-500 rounded px-1.5 py-0.5 text-xs w-full outline-none text-white"
                        />
                      ) : (
                        <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                          <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis mr-2">{node.name || 'Unnamed'}</span>
                          {modifiedFiles.has(node.id) && (
                            <span className="text-[9px] font-black text-amber-500 shrink-0">M</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isRenaming && (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        {node.type === 'directory' && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCreating({ type: 'file', parent: node.id });
                              if (!expanded.has(node.id)) toggleExpand(node.id);
                            }} 
                            className="p-1 hover:bg-[#3c3c3c] rounded transition-colors" 
                            title="New File"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setRenaming(node.id); setRenameValue(node.name); }} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors" title="Rename"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }} className="p-1 hover:bg-[#3c3c3c] rounded text-red-400 hover:text-red-300 transition-colors" title="Delete"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content className="min-w-[160px] bg-[#252526] border border-[#454545] rounded-md p-1 shadow-xl z-50">
                    <ContextMenu.Item 
                      onClick={() => {
                        const targetId = node.type === 'directory' ? node.id : (parentId || '');
                        setCreating({ type: 'file', parent: targetId });
                        if (node.type === 'directory' && !expanded.has(node.id)) toggleExpand(node.id);
                      }} 
                      className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-emerald-600 hover:text-white rounded cursor-pointer outline-none"
                    >
                      <Plus className="w-3.5 h-3.5" /> New File
                    </ContextMenu.Item>
                    <ContextMenu.Item 
                      onClick={() => {
                        const targetId = node.type === 'directory' ? node.id : (parentId || '');
                        setCreating({ type: 'directory', parent: targetId });
                        if (node.type === 'directory' && !expanded.has(node.id)) toggleExpand(node.id);
                      }} 
                      className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-emerald-600 hover:text-white rounded cursor-pointer outline-none"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> New Folder
                    </ContextMenu.Item>
                    <ContextMenu.Separator className="h-px bg-[#454545] my-1" />
                    <ContextMenu.Item onClick={() => { setRenaming(node.id); setRenameValue(node.name); }} className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-emerald-600 hover:text-white rounded cursor-pointer outline-none">
                      <Edit2 className="w-3.5 h-3.5" /> Rename
                    </ContextMenu.Item>
                    <ContextMenu.Item onClick={() => handleDelete(node.id)} className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-600 hover:text-white rounded cursor-pointer outline-none">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </ContextMenu.Item>
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
              {node.type === 'directory' && isExpanded && node.children && (
                <div>{renderTree(node.children, depth + 1, node.id)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc] select-none">
      <div className="h-8 flex items-center justify-between px-4 border-b border-white/5 bg-[#111]">
        {isSearching ? (
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-3 h-3 text-emerald-500" />
            <input 
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSearching(false);
                  setSearchQuery('');
                }
              }}
              placeholder="Filter files..."
              className="bg-transparent border-none outline-none text-[10px] w-full font-bold uppercase tracking-wider text-white placeholder:text-zinc-700"
            />
            <button 
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="p-1 hover:bg-white/5 rounded text-zinc-600 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-2 group min-w-0 mr-2">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white shrink-0"
                title="Go to Dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold uppercase text-[10px] tracking-wider text-zinc-400 truncate">Explorer</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => setCreating({ type: 'file', parent: activeProject?.folderName || '' })} 
                className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white shrink-0" 
                title="New File"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setCreating({ type: 'directory', parent: activeProject?.folderName || '' })} 
                className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white shrink-0" 
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setSidebarTab('search')} 
                className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white shrink-0" 
                title="Search Workspace"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => fetchFiles()} 
                className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white shrink-0" 
                title="Refresh"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {searchQuery ? (
          <div className="space-y-0">
            {searchResults.length > 0 ? (
              searchResults.map((res, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    openFile(res.node);
                    setEditorHighlightQuery(searchQuery);
                    setIsSearching(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    "flex flex-col px-4 py-2 hover:bg-emerald-500/5 cursor-pointer transition-all border-l-2 border-transparent hover:border-emerald-500 group",
                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-zinc-100"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <File className={cn("w-3 h-3 shrink-0", theme === 'dark' ? "text-emerald-500/70" : "text-emerald-600")} />
                    <span className={cn(
                      "text-[11px] font-bold truncate group-hover:text-emerald-500 transition-colors tracking-tight",
                      theme === 'dark' ? "text-zinc-300" : "text-zinc-800"
                    )}>
                      {res.node.name}
                    </span>
                  </div>
                  {res.path && (
                    <div className="flex items-center gap-1 mt-0.5 ml-5.5 opacity-40">
                      <span className={cn(
                        "text-[8px] font-medium uppercase tracking-[0.15em] truncate",
                        theme === 'dark' ? "text-zinc-500" : "text-zinc-500"
                      )}>
                        {res.path.replace(/\//g, ' › ')}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em]">No matching files</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {activeProject ? (
              <div className="mx-1">
                <div 
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer transition-colors group rounded-md",
                    projectExpanded ? "text-white" : "text-zinc-500"
                  )}
                  onClick={() => setProjectExpanded(!projectExpanded)}
                >
                  <div className="w-4 flex justify-center">
                    {projectExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                  {projectExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 shrink-0 text-emerald-500/50" />
                  )}
                  <span className="truncate flex-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 group-hover:text-white">
                    {activeProject.name}
                  </span>
                </div>
                {projectExpanded && (
                  <div className="mt-0.5">
                    {renderTree(files, 1, activeProject.folderName)}
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-1">
                {renderTree(files)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
