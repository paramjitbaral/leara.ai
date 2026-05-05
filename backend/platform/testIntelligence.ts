import fs from "fs-extra";
import path from "path";
import { runManagedCommand } from "./terminalOrchestrator";

export async function discoverTests(projectRoot: string): Promise<string[]> {
  const out: string[] = [];

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (["node_modules", "dist", ".git", "build", "coverage"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/i.test(entry.name)) {
        out.push(path.relative(projectRoot, full).replace(/\\/g, "/"));
      }
    }
  };

  await walk(projectRoot);
  return out;
}

export async function runAllTests(projectRoot: string) {
  return runManagedCommand("npm test", projectRoot, true);
}

export async function runSingleTest(projectRoot: string, testPath: string) {
  const command = `npm test -- ${testPath}`;
  return runManagedCommand(command, projectRoot, true);
}
