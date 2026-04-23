import React from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';
import { X, MoreVertical, FileText, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function EditorTabs() {
  const { 
    openFiles, activeFile, setActiveFile, removeOpenFile, 
    closeAllFiles, saveAllFiles, theme, modifiedFiles 
  } = useStore();

  const handleSaveAllAndClose = async () => {
    await saveAllFiles();
    closeAllFiles();
  };

  if (openFiles.length === 0) return null;

  return (
    <div className={cn(
      "h-8 flex items-center border-b border-white/5 bg-[#111] overflow-hidden select-none",
      theme === 'light' && "bg-[#f3f3f3] border-black/5"
    )}>
      <div className="flex-1 flex overflow-x-auto no-scrollbar scroll-smooth h-full">
        {openFiles.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFile(file)}
            className={cn(
              "group flex items-center gap-2 px-3 h-full border-r border-white/5 cursor-pointer transition-all min-w-[120px] max-w-[200px] text-[10px] font-bold uppercase tracking-wider relative",
              activeFile?.id === file.id 
                ? (theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-white text-black") 
                : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400",
              theme === 'light' && "border-black/5"
            )}
          >
            {/* Active Indicator Line */}
            {activeFile?.id === file.id && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
            )}
            
            <FileText className={cn(
              "w-3 h-3",
              activeFile?.id === file.id ? "text-emerald-500" : "text-zinc-600"
            )} />
            
            <span className="truncate flex-1 font-black">{file.name}</span>
            
            {modifiedFiles.has(file.id) && (
              <span className="text-[9px] font-black text-amber-500 shrink-0">M</span>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeOpenFile(file.id);
              }}
              className={cn(
                "p-0.5 rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100",
                activeFile?.id === file.id && "opacity-100",
                modifiedFiles.has(file.id) && "group-hover:opacity-100"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className="shrink-0 flex items-center px-1 border-l border-white/5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 hover:text-white transition-colors outline-none">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className={cn(
                "min-w-[160px] p-1 bg-[#1e1e1e] border border-white/5 rounded-lg shadow-2xl z-50",
                "animate-in fade-in zoom-in duration-150"
              )}
              align="end"
              sideOffset={5}
            >
              <DropdownMenu.Item 
                onClick={saveAllFiles}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors"
              >
                <span>Save All Files</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item 
                onClick={handleSaveAllAndClose}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors"
              >
                <span>Save All & Close</span>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-white/5 my-1" />
              <DropdownMenu.Item 
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors"
              >
                <span>Close Saved Tabs</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item 
                onClick={closeAllFiles}
// ...
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md cursor-pointer outline-none transition-colors"
              >
                <span>Close All Tabs</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
