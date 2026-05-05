import fs from "fs-extra";
import path from "path";
import { searchSymbols } from "./indexer";

export async function findReferences(projectRoot: string, symbol: string) {
  const matches: Array<{ file: string; line: number; content: string }> = [];
  const q = symbol.trim();
  if (!q) return matches;

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (["node_modules", "dist", ".git", "build", "coverage"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.(ts|tsx|js|jsx|py|java|go|rs)$/i.test(entry.name)) {
        try {
          const content = await fs.readFile(full, "utf-8");
          const lines = content.split(/\r?\n/);
          lines.forEach((line, i) => {
            if (line.includes(q)) {
              matches.push({
                file: path.relative(projectRoot, full).replace(/\\/g, "/"),
                line: i + 1,
                content: line.trim().slice(0, 220),
              });
            }
          });
        } catch {
          // ignore
        }
      }
      if (matches.length >= 500) return;
    }
  };

  await walk(projectRoot);
  return matches.slice(0, 500);
}

export async function symbolInfo(projectRoot: string, symbol: string) {
  const symbols = await searchSymbols(projectRoot, symbol);
  const refs = await findReferences(projectRoot, symbol);
  return {
    symbol,
    declarations: symbols,
    references: refs,
  };
}
