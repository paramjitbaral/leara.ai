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

  if (!activeFile && openFiles.length === 0) return null;

  return (
    <div className={cn(
      "h-9 flex items-center border-b select-none shrink-0",
      theme === 'dark' ? "bg-[#1e1e1e] border-white/5" : "bg-zinc-50 border-zinc-200"
    )}>
      <div className="flex-1 flex overflow-x-auto no-scrollbar scroll-smooth h-full">
        {openFiles.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFile(file)}
            className={cn(
              "group flex items-center gap-1.5 px-2.5 h-full border-r cursor-pointer transition-all min-w-[100px] max-w-[180px] text-[9px] font-bold uppercase tracking-wider relative",
              activeFile?.id === file.id
                ? (theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-white text-emerald-600")
                : (theme === 'dark' ? "text-zinc-500 hover:bg-white/5" : "text-zinc-500 hover:bg-black/5"),
              theme === 'dark' ? "border-white/5" : "border-zinc-200"
            )}
          >
            {/* Active Indicator Line */}
            {activeFile?.id === file.id && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
            )}

            <FileText className={cn(
              "w-2.5 h-2.5",
              activeFile?.id === file.id ? "text-emerald-500" : "text-zinc-600"
            )} />

            <span className="truncate flex-1 font-black">{file.name}</span>

            {modifiedFiles.has(file.id) && (
              <span className="text-[8px] font-black text-amber-500 shrink-0">M</span>
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
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {/* Fallback if active file is not in openFiles for some reason */}
        {activeFile && !openFiles.find(f => f.id === activeFile.id) && (
          <div className={cn(
            "group flex items-center gap-2 px-3 h-full border-r cursor-pointer transition-all min-w-[120px] max-w-[200px] text-[10px] font-bold uppercase tracking-wider relative",
            theme === 'dark' ? "bg-[#1e1e1e] text-white" : "bg-white text-emerald-600"
          )}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />
            <FileText className="w-3 h-3 text-emerald-500" />
            <span className="truncate flex-1 font-black">{activeFile.name}</span>
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div className={cn("shrink-0 flex items-center px-1 border-l", theme === 'dark' ? "border-white/5" : "border-zinc-200")}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={cn(
              "p-1.5 rounded-md transition-colors outline-none",
              theme === 'dark' ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "hover:bg-black/5 text-zinc-500 hover:text-zinc-900"
            )}>
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
