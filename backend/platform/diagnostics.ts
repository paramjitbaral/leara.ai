import path from "path";
import { runManagedCommand, getManagedCommand } from "./terminalOrchestrator";

export interface DiagnosticItem {
  source: string;
  severity: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

const DIAG_RE = /([^\s:][^:\n]*):(\d+):(\d+)\s*-?\s*(error|warning)?\s*(.*)/i;

function parseOutput(source: string, output: string): DiagnosticItem[] {
  const lines = output.split(/\r?\n/);
  const items: DiagnosticItem[] = [];
  for (const line of lines) {
    const m = line.match(DIAG_RE);
    if (m) {
      items.push({
        source,
        severity: (m[4]?.toLowerCase() === "warning" ? "warning" : "error") as "error" | "warning",
        file: m[1],
        line: Number(m[2]),
        column: Number(m[3]),
        message: m[5] || line,
      });
    }
  }
  if (!items.length && output.trim()) {
    items.push({ source, severity: "error" as const, message: output.trim().slice(0, 500) });
  }
  return items;
}

async function runAndCollect(projectRoot: string, source: string, command: string): Promise<DiagnosticItem[]> {
  const job = await runManagedCommand(command, projectRoot, true);
  // Busy wait with short polling in-process for completion, capped by attempts.
  for (let i = 0; i < 120; i += 1) {
    const current = getManagedCommand(job.id);
    if (current && current.status !== "running") {
      const merged = `${current.stdout || ""}\n${current.stderr || ""}`;
      return parseOutput(source, merged);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return [{ source, severity: "error" as const, message: `${source} timed out` }];
}

export async function collectDiagnostics(projectRoot: string) {
  const all: DiagnosticItem[] = [];
  const ts = await runAndCollect(projectRoot, "tsc", "npx tsc --noEmit");
  all.push(...ts);
  const eslint = await runAndCollect(projectRoot, "eslint", "npx eslint .");
  all.push(...eslint);
  const tests = await runAndCollect(projectRoot, "tests", "npm test -- --runInBand");
  all.push(...tests);

  return all.map((d) => {
    if (d.file) {
      d.file = path.normalize(d.file).replace(/\\/g, "/");
    }
    return d;
  });
}
