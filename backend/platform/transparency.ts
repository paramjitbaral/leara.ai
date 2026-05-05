import path from "path";
import fs from "fs-extra";

export interface TransparencyEvent {
  ts: string;
  scope: string;
  action: string;
  status: "ok" | "error";
  details?: Record<string, any>;
}

function logFile(projectRoot: string): string {
  return path.join(projectRoot, ".leara", "action-log.jsonl");
}

export async function logAction(projectRoot: string, evt: TransparencyEvent): Promise<void> {
  const p = logFile(projectRoot);
  await fs.ensureDir(path.dirname(p));
  await fs.appendFile(p, `${JSON.stringify(evt)}\n`, "utf-8");
}

export async function readActionLog(projectRoot: string, limit = 200): Promise<TransparencyEvent[]> {
  const p = logFile(projectRoot);
  if (!(await fs.pathExists(p))) return [];
  const raw = await fs.readFile(p, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line) as TransparencyEvent;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as TransparencyEvent[];
}
