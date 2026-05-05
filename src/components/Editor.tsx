import React, { useEffect, useRef, useCallback } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { useStore, FileNode } from '../store';
import { Project } from '../types';
import { Loader2, Save, Cloud, Zap } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { storageService } from '../lib/storageService';
import { EditorTabs } from './EditorTabs';
import { editor } from 'monaco-editor';
import { LearaLogo } from './LearaLogo';
import { cn } from '../lib/utils';

export function Editor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    activeFile, setActiveFile, userId, theme, activeProject, 
    editorHighlightQuery, setEditorHighlightQuery, 
    editorScrollLine, setEditorScrollLine,
    setSidebarTab, setIsAIPanelOpen, setModified, originalContents
  } = useStore();

  useEffect(() => {
    if (!editorRef.current || !editorHighlightQuery) {
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    const ed = editorRef.current;
    const model = ed.getModel();
    if (!model) return;

    const matches = model.findMatches(editorHighlightQuery, false, false, false, null, true);
    const newDecorations: editor.IModelDeltaDecoration[] = matches.map(match => ({
      range: match.range,
      options: {
        inlineClassName: 'search-highlight',
        isWholeLine: false,
        className: 'search-highlight-bg'
      }
    }));

    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, newDecorations);

    if (editorScrollLine) {
      // Find the specific match on this line, otherwise just scroll to the line
      const specificMatch = matches.find(m => m.range.startLineNumber === editorScrollLine);
      if (specificMatch) {
         ed.revealRangeInCenter(specificMatch.range, editor.ScrollType.Smooth);
         ed.setPosition({ lineNumber: editorScrollLine, column: specificMatch.range.startColumn });
      } else {
         ed.revealLineInCenter(editorScrollLine, editor.ScrollType.Smooth);
         ed.setPosition({ lineNumber: editorScrollLine, column: 1 });
      }
      ed.focus();
    } else if (matches.length > 0) {
      ed.revealRangeInCenterIfOutsideViewport(matches[0].range, editor.ScrollType.Smooth);
    }
  }, [editorHighlightQuery, activeFile?.id, editorScrollLine]);

  const clearHighlight = () => {
    if (editorHighlightQuery) setEditorHighlightQuery('');
    if (editorScrollLine) setEditorScrollLine(null);
  };

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
      // Trigger SCM and other panel updates
      useStore.getState().triggerStatusUpdate();
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
    
    // Compare with original content to decide if modified
    const original = originalContents[activeFile.id] || '';
    setModified(activeFile.id, newContent !== original);
    
    clearHighlight();
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onMouseDown(() => clearHighlight());
    editor.onKeyDown(() => clearHighlight());

    // Manual Save Keybinding (Ctrl + S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const content = editor.getValue();
      handleSave(content);
      toast.success('File saved manually', {
        icon: <Save className="w-4 h-4 text-emerald-500" />
      });
    });

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeFile) return;

      // Ctrl + Shift + F (Global Search)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSidebarTab('search');
        toast.info('Opening Global Search');
      }
      
      // Ctrl + P (Quick Open / Explorer)
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setSidebarTab('explorer');
        toast.info('Quick Open Explorer');
      }

      // Ctrl + L (AI Assistant)
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsAIPanelOpen(true);
        toast.info('Invoking AI Assistant');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, setSidebarTab, setIsAIPanelOpen]);

  if (!activeFile) {
    return (
      <div className={cn(
        "h-full w-full flex flex-col items-center justify-center transition-colors duration-300 px-6 overflow-hidden",
        theme === 'dark' ? "bg-[#1e1e1e]" : "bg-[#f5f5f5]"
      )}>
        
        {/* Branding Area */}
        <div className="flex flex-col items-center justify-center shrink-0 py-12">
          <div className="flex flex-col items-center opacity-[0.25] hover:opacity-45 transition-all duration-700 pointer-events-none group/logo select-none">
            <div className="mb-6 grayscale scale-[1.6] group-hover/logo:scale-[1.7] transition-all duration-1000">
              <LearaLogo size="lg" showText={false} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.6em] font-black opacity-40 text-center ml-[0.6em]">Desktop Workspace</p>
          </div>
        </div>

        {/* Shortcuts Area - Centered and spaced properly */}
        <div className="w-full max-w-[240px] shrink-0">
          <div className="w-full border-t border-black/5 dark:border-white/5 pt-6 space-y-3">
            {[
              { label: 'File Search', keys: ['Ctrl', 'P'] },
              { label: 'Global Search', keys: ['Ctrl', 'Shift', 'F'] },
              { label: 'AI Assistant', keys: ['Ctrl', 'L'] },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between opacity-[0.25] hover:opacity-75 transition-opacity cursor-default group/key">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em]">{item.label}</span>
                <div className="flex items-center gap-1.5 opacity-80">
                  {item.keys.map((key, ki) => (
                    <React.Fragment key={ki}>
                      <span className="text-[8px] font-mono font-bold leading-none">{key}</span>
                      {ki < item.keys.length - 1 && <span className="text-[7px] opacity-40">+</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
      <EditorTabs />
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={activeFile.language || 'javascript'}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={activeFile.content}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
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
