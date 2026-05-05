import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { evaluateCommandPolicy } from "./policy";

export interface ManagedTerminalResult {
  id: string;
  command: string;
  cwd: string;
  status: "running" | "completed" | "error";
  exitCode?: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  endedAt?: string;
}

const jobs = new Map<string, ManagedTerminalResult>();
const processes = new Map<string, ReturnType<typeof spawn>>();

export async function runManagedCommand(command: string, cwd: string, approved = false): Promise<ManagedTerminalResult> {
  const policy = evaluateCommandPolicy(command, approved);
  if (!policy.allowed) {
    return {
      id: randomUUID(),
      command,
      cwd,
      status: "error",
      stdout: "",
      stderr: policy.reason || "Blocked by policy",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    };
  }

  const id = randomUUID();
  const result: ManagedTerminalResult = {
    id,
    command,
    cwd,
    status: "running",
    stdout: "",
    stderr: "",
    startedAt: new Date().toISOString(),
  };

  jobs.set(id, result);

  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "cmd" : "sh", [isWin ? "/c" : "-c", command], {
    cwd,
    env: process.env,
    shell: false,
  });

  processes.set(id, child);

  child.stdout.on("data", (d) => {
    const j = jobs.get(id);
    if (j) j.stdout += d.toString();
  });

  child.stderr.on("data", (d) => {
    const j = jobs.get(id);
    if (j) j.stderr += d.toString();
  });

  child.on("close", (code) => {
    const j = jobs.get(id);
    if (!j) return;
    j.exitCode = code ?? 0;
    j.status = code === 0 ? "completed" : "error";
    j.endedAt = new Date().toISOString();
    processes.delete(id);
  });

  child.on("error", (err) => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = "error";
    j.stderr += `\n${err.message}`;
    j.endedAt = new Date().toISOString();
    processes.delete(id);
  });

  return result;
}

export function getManagedCommand(id: string): ManagedTerminalResult | null {
  return jobs.get(id) || null;
}

export function listManagedCommands(limit = 100): ManagedTerminalResult[] {
  return Array.from(jobs.values()).slice(-limit);
}

export function stopManagedCommand(id: string): { ok: boolean; message: string } {
  const proc = processes.get(id);
  if (!proc) return { ok: false, message: "Job not running" };
  proc.kill();
  return { ok: true, message: "Stop signal sent" };
}
