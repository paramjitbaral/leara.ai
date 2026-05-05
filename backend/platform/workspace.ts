import path from "path";
import fs from "fs-extra";

export function getProjectRoot(workspaceRoot: string, userId?: string, folder?: string): string {
  const uid = userId || "local-user";
  const base = path.join(workspaceRoot, uid);
  return folder ? path.join(base, folder) : base;
}

export async function ensureProjectRoot(workspaceRoot: string, userId?: string, folder?: string): Promise<string> {
  const root = getProjectRoot(workspaceRoot, userId, folder);
  await fs.ensureDir(root);
  return root;
}

export function resolveProjectPath(projectRoot: string, relPath: string): string {
  const full = path.resolve(projectRoot, relPath || ".");
  const rel = path.relative(projectRoot, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes project root");
  }
  return full;
}
