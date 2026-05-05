import path from "path";
import fs from "fs-extra";

interface SessionMemory {
  tasks: Array<{ id: string; prompt: string; status: string; updatedAt: string }>;
  fixes: Array<{ error: string; fix: string; updatedAt: string }>;
}

function memoryPath(projectRoot: string): string {
  return path.join(projectRoot, ".leara", "memory.json");
}

async function load(projectRoot: string): Promise<SessionMemory> {
  const p = memoryPath(projectRoot);
  if (!(await fs.pathExists(p))) {
    return { tasks: [], fixes: [] };
  }
  return fs.readJson(p);
}

async function save(projectRoot: string, data: SessionMemory): Promise<void> {
  const p = memoryPath(projectRoot);
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, data, { spaces: 2 });
}

export async function rememberTask(projectRoot: string, id: string, prompt: string, status: string): Promise<void> {
  const data = await load(projectRoot);
  const idx = data.tasks.findIndex((t) => t.id === id);
  const entry = { id, prompt, status, updatedAt: new Date().toISOString() };
  if (idx >= 0) data.tasks[idx] = entry;
  else data.tasks.push(entry);
  data.tasks = data.tasks.slice(-200);
  await save(projectRoot, data);
}

export async function rememberFix(projectRoot: string, error: string, fix: string): Promise<void> {
  const data = await load(projectRoot);
  data.fixes.push({ error: error.slice(0, 400), fix: fix.slice(0, 400), updatedAt: new Date().toISOString() });
  data.fixes = data.fixes.slice(-300);
  await save(projectRoot, data);
}

export async function getMemory(projectRoot: string): Promise<SessionMemory> {
  return load(projectRoot);
}
