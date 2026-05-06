import React from 'react';
import { X, FileText, Dot, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function TabBar() {
  const { 
    openTabs, activeFile, setActiveFile, closeTab, modifiedFiles,
    saveAllFiles, closeAllFiles
  } = useStore();

  if (!openTabs || openTabs.length === 0) {
    return null;
  }

  const handleCloseTab = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    closeTab(fileId);
  };

  return (
    <div className="flex items-center bg-[#1e1e1e] border-b border-white/5 h-10 overflow-x-auto scrollbar-hide">
      <div className="flex-1 flex overflow-x-auto no-scrollbar">
        <AnimatePresence mode="popLayout">
          {openTabs.map((file) => {
          const isActive = activeFile?.id === file.id;
          const isModified = modifiedFiles?.has(file.id) ?? false;

          return (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              role="button"
              tabIndex={0}
              onClick={() => setActiveFile(file)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveFile(file);
                }
              }}
              className={cn(
                "group flex items-center gap-2 px-3 h-10 whitespace-nowrap border-r border-white/5 transition-all",
                "hover:bg-white/5",
                isActive && "bg-[#252526] border-b-2 border-emerald-500",
              )}
            >
              <FileText className="w-3 h-3 flex-shrink-0 text-zinc-400" />
              <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-white" : "text-zinc-400 group-hover:text-white"
              )}>
                {file.name}
              </span>
              {isModified && (
                <Dot className="w-2 h-2 fill-white text-white flex-shrink-0" />
              )}
              <span
                onClick={(e) => handleCloseTab(e, file.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    closeTab(file.id);
                  }
                }}
                className={cn(
                  "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                  "hover:bg-white/10"
                )}
              >
                <X className="w-3 h-3" />
              </span>
            </motion.div>
          );
          })}
        </AnimatePresence>
      </div>
      {/* Tabs Menu (three-dot) */}
      <div className="shrink-0 flex items-center px-1 border-l">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={cn(
              "p-1.5 rounded-md transition-colors outline-none",
              "hover:bg-white/5 text-zinc-500 hover:text-white"
            )}>
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content className="min-w-[160px] p-1 bg-[#1e1e1e] border border-white/5 rounded-lg shadow-2xl z-50 animate-in fade-in zoom-in duration-150" align="end" sideOffset={5}>
              <DropdownMenu.Item onClick={saveAllFiles} className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors">Save All Files</DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => { saveAllFiles(); closeAllFiles(); }} className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors">Save All &amp; Close</DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
              <DropdownMenu.Item onClick={closeAllFiles} className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors">Close All Tabs</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
