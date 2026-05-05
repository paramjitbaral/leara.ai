import path from "path";
import fs from "fs-extra";

interface Checkpoint {
  id: string;
  createdAt: string;
  files: Array<{ path: string; content: string }>;
  note?: string;
}

function checkpointsDir(projectRoot: string): string {
  return path.join(projectRoot, ".leara", "checkpoints");
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createCheckpoint(projectRoot: string, filePaths: string[], note?: string): Promise<Checkpoint> {
  const files: Array<{ path: string; content: string }> = [];
  for (const rel of filePaths) {
    const full = path.join(projectRoot, rel);
    if (await fs.pathExists(full)) {
      const content = await fs.readFile(full, "utf-8");
      files.push({ path: rel.replace(/\\/g, "/"), content });
    }
  }

  const cp: Checkpoint = { id: randomId(), createdAt: new Date().toISOString(), files, note };
  const p = path.join(checkpointsDir(projectRoot), `${cp.id}.json`);
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, cp, { spaces: 2 });
  return cp;
}

export async function listCheckpoints(projectRoot: string): Promise<Checkpoint[]> {
  const dir = checkpointsDir(projectRoot);
  if (!(await fs.pathExists(dir))) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const out: Checkpoint[] = [];
  for (const f of files) {
    try {
      out.push(await fs.readJson(path.join(dir, f)));
    } catch {
      // ignore bad checkpoint
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreCheckpoint(projectRoot: string, id: string): Promise<{ restored: number }> {
  const p = path.join(checkpointsDir(projectRoot), `${id}.json`);
  const cp: Checkpoint = await fs.readJson(p);
  for (const file of cp.files) {
    const full = path.join(projectRoot, file.path);
    await fs.ensureDir(path.dirname(full));
    await fs.writeFile(full, file.content, "utf-8");
  }
  return { restored: cp.files.length };
}
