import React, { useEffect, useRef, useCallback } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { useStore, FileNode } from '../store';
import { Project } from '../types';
import { Loader2, Save, Cloud } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { storageService } from '../lib/storageService';
import { editor } from 'monaco-editor';

export function Editor() {
  const { activeFile, setActiveFile, userId, theme, activeProject } = useStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSave = useCallback(async (content: string) => {
    if (!activeFile || !userId || !activeProject) return;
    try {
      await storageService.saveFile(
        userId,
        activeProject.id,
        activeFile.id,
        activeFile.name,
        content,
        activeFile.language
      );
      console.log('File saved across all layers');
    } catch (err) {
      console.error('Failed to save file:', err);
      toast.error('Failed to save changes');
    }
  }, [activeFile, userId, activeProject]);

  // Cleanup on unmount or file change
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeFile?.id]);

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile) return;
    const newContent = value || '';
    
    // Update local state immediately
    setActiveFile({ ...activeFile, content: newContent });

    // Debounced auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newContent);
    }, 1000);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add Context Menu Actions
    editor.addAction({
      id: 'ai-explain',
      label: 'AI: Explain Code',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: (ed: any) => {
        const selection = ed.getSelection();
        const text = ed.getModel().getValueInRange(selection);
        toast.info('AI Explaining', {
          description: `Analyzing: ${text.substring(0, 50)}...`,
        });
      }
    });

    editor.addAction({
      id: 'ai-fix',
      label: 'AI: Fix Selection',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2,
      run: (ed: any) => {
        const selection = ed.getSelection();
        const text = ed.getModel().getValueInRange(selection);
        toast.info('AI Fixing', {
          description: `Fixing: ${text.substring(0, 50)}...`,
        });
      }
    });

    editor.layout();
  };

  if (!activeFile) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#1e1e1e] text-zinc-500 space-y-4">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 opacity-20" />
        </div>
        <p className="text-sm">Select a file from the explorer to start coding</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
      <div className="h-10 bg-[#1e1e1e] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="font-bold uppercase text-[10px] tracking-wider text-zinc-400">{activeFile.name}</span>
          <div className="flex items-center gap-1.5 ml-2">
            <Cloud className="w-3 h-3 text-emerald-500/50" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Local & Cloud Sync Active</span>
          </div>
        </div>
        <button 
          onClick={() => handleSave(activeFile.content || '')} 
          className="p-1 hover:bg-white/5 rounded transition-colors text-zinc-500 hover:text-white"
          title="Save File"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={activeFile.language || 'javascript'}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={activeFile.content}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            lineNumbers: 'on',
            renderWhitespace: 'none',
            tabSize: 2,
            wordWrap: 'on',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            contextmenu: true,
          }}
        />
      </div>
    </div>
  );
}
