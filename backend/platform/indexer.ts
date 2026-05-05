import path from "path";
import fs from "fs-extra";

export interface SymbolEntry {
  file: string;
  line: number;
  symbol: string;
  kind: "function" | "class" | "variable" | "import";
}

interface IndexStore {
  symbols: SymbolEntry[];
  updatedAt: string;
}

const inMemory = new Map<string, IndexStore>();
const watchers = new Map<string, fs.FSWatcher[]>();

function shouldSkip(name: string): boolean {
  return ["node_modules", "dist", ".git", "build", "coverage", ".next"].includes(name);
}

function extractSymbols(fileRel: string, content: string): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const fn = line.match(/function\s+([A-Za-z0-9_]+)/);
    if (fn) entries.push({ file: fileRel, line: idx + 1, symbol: fn[1], kind: "function" });
    const cls = line.match(/class\s+([A-Za-z0-9_]+)/);
    if (cls) entries.push({ file: fileRel, line: idx + 1, symbol: cls[1], kind: "class" });
    const v = line.match(/(?:const|let|var)\s+([A-Za-z0-9_]+)/);
    if (v) entries.push({ file: fileRel, line: idx + 1, symbol: v[1], kind: "variable" });
    const im = line.match(/^\s*import\s+.*from\s+["']([^"']+)["']/);
    if (im) entries.push({ file: fileRel, line: idx + 1, symbol: im[1], kind: "import" });
  });
  return entries;
}

export async function buildIndex(projectRoot: string): Promise<IndexStore> {
  const symbols: SymbolEntry[] = [];

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldSkip(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.(ts|tsx|js|jsx|py|java|go|rs|md|json|html|css)$/i.test(entry.name)) {
        try {
          const content = await fs.readFile(full, "utf-8");
          const rel = path.relative(projectRoot, full).replace(/\\/g, "/");
          symbols.push(...extractSymbols(rel, content));
        } catch {
          // ignore
        }
      }
    }
  };

  await walk(projectRoot);
  const store = { symbols, updatedAt: new Date().toISOString() };
  inMemory.set(projectRoot, store);
  return store;
}

export function getIndex(projectRoot: string): IndexStore | null {
  return inMemory.get(projectRoot) || null;
}

export async function searchSymbols(projectRoot: string, query: string): Promise<SymbolEntry[]> {
  const idx = inMemory.get(projectRoot) || (await buildIndex(projectRoot));
  const q = query.toLowerCase();
  return idx.symbols.filter((s) => s.symbol.toLowerCase().includes(q)).slice(0, 200);
}

export async function startIndexWatcher(projectRoot: string): Promise<void> {
  if (watchers.has(projectRoot)) return;
  const current: fs.FSWatcher[] = [];

  const rootWatcher = fs.watch(projectRoot, { recursive: true }, async (_evt, filename) => {
    if (!filename) return;
    const first = filename.split(path.sep)[0];
    if (shouldSkip(first)) return;
    await buildIndex(projectRoot);
  });

  current.push(rootWatcher);
  watchers.set(projectRoot, current);
  await buildIndex(projectRoot);
}

export function stopIndexWatcher(projectRoot: string): void {
  const arr = watchers.get(projectRoot) || [];
  arr.forEach((w) => w.close());
  watchers.delete(projectRoot);
}
