import path from "path";
import fs from "fs-extra";
import { runManagedCommand } from "../platform/terminalOrchestrator";
import { validateTerminalCommand } from "./safety";
import { AgentToolCall } from "./types";

interface ToolContext {
  workspaceRoot: string;
  userId: string;
  folder?: string;
}

interface ToolResult {
  ok: boolean;
  output: string;
  touchedFile?: string;
}

function getProjectRoot(ctx: ToolContext): string {
  const base = path.join(ctx.workspaceRoot, ctx.userId || "local-user");
  return ctx.folder ? path.join(base, ctx.folder) : base;
}

function assertInsideRoot(root: string, target: string) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes project root.");
  }
}

function resolveSafePath(ctx: ToolContext, relPath: string): string {
  const projectRoot = getProjectRoot(ctx);
  const fullPath = path.resolve(projectRoot, relPath || ".");
  assertInsideRoot(projectRoot, fullPath);
  return fullPath;
}

async function readTextSafe(fullPath: string): Promise<string> {
  const exists = await fs.pathExists(fullPath);
  if (!exists) throw new Error("File not found.");
  return fs.readFile(fullPath, "utf-8");
}

async function searchFiles(root: string, query: string): Promise<string> {
  const results: string[] = [];
  const lowerQ = query.toLowerCase();

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (["node_modules", "dist", ".git", "build", "coverage"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      if (results.length >= 80) return;
      if (/\.(png|jpg|jpeg|gif|ico|zip|gz|7z|exe|dll|bin|pdf)$/i.test(entry.name)) continue;

      try {
        const content = await fs.readFile(full, "utf-8");
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].toLowerCase().includes(lowerQ)) {
            const rel = path.relative(root, full).replace(/\\/g, "/");
            results.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (results.length >= 80) return;
          }
        }
      } catch {
        // Ignore unreadable files.
      }
    }
  };

  await walk(root);
  return results.length ? results.join("\n") : "No matches found.";
}

// runCommand is now handled by runManagedCommand in platform/terminalOrchestrator.ts
// but we'll add a helper to adapt its output to our ToolResult format.
async function runCommandAdapted(command: string, cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  // We use the platform orchestrator which handles PTY-like behavior and policy
  const result = await runManagedCommand(command, cwd, true);
  
  // Wait for it to finish or timeout
  let iterations = 0;
  while (result.status === "running" && iterations < 120) {
    await new Promise(r => setTimeout(r, 1000));
    iterations++;
    
    // Early exit if success signals found (Integrated Observation)
    const combined = (result.stdout + result.stderr).toLowerCase();
    if (combined.includes("localhost") || combined.includes("listening on") || combined.includes("compiled successfully")) {
      break;
    }
  }

  return {
    code: result.exitCode ?? (result.status === "completed" ? 0 : -1),
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export async function executeToolCall(toolCall: AgentToolCall, ctx: ToolContext): Promise<ToolResult> {
  const projectRoot = getProjectRoot(ctx);
  await fs.ensureDir(projectRoot);

  const { name, args } = toolCall;

  if (name === "file_read") {
    const relPath = String(args.path || "");
    const fullPath = resolveSafePath(ctx, relPath);
    const content = await readTextSafe(fullPath);
    return { ok: true, output: content.slice(0, 24000), touchedFile: relPath };
  }

  if (name === "file_write") {
    const relPath = String(args.path || "");
    const content = String(args.content ?? "");
    const fullPath = resolveSafePath(ctx, relPath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, "utf-8");
    return { ok: true, output: `Wrote ${content.length} bytes to ${relPath}.`, touchedFile: relPath };
  }

  if (name === "file_edit") {
    const relPath = String(args.path || "");
    const oldText = String(args.oldText ?? "");
    const newText = String(args.newText ?? "");
    const fullPath = resolveSafePath(ctx, relPath);
    const existing = await readTextSafe(fullPath);

    if (!oldText) {
      const appended = `${existing}\n${newText}`;
      await fs.writeFile(fullPath, appended, "utf-8");
      return { ok: true, output: `Appended content in ${relPath}.`, touchedFile: relPath };
    }

    if (!existing.includes(oldText)) {
      throw new Error("file_edit failed: oldText not found in file.");
    }

    const updated = existing.replace(oldText, newText);
    await fs.writeFile(fullPath, updated, "utf-8");
    return { ok: true, output: `Updated content in ${relPath}.`, touchedFile: relPath };
  }

  if (name === "terminal_execute") {
    const command = String(args.command || "");
    const validated = validateTerminalCommand(command);
    if (!validated.ok) {
      return { ok: false, output: validated.reason || "Blocked by safety policy." };
    }

    const cwd = args.cwd ? resolveSafePath(ctx, String(args.cwd)) : projectRoot;
    const result = await runCommandAdapted(command, cwd);
    
    // Pattern Matcher Adaptation (Inspired by VS Code Problem Matchers)
    const output = [
      `exitCode: ${result.code}`,
      result.stdout ? `stdout:\n${result.stdout}` : "",
      result.stderr ? `stderr:\n${result.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 30000);

    return { ok: result.code === 0, output };
  }

  if (name === "search_codebase") {
    const q = String(args.query || "");
    if (!q.trim()) return { ok: false, output: "Missing query for search_codebase." };
    const results = await searchFiles(projectRoot, q.trim());
    return { ok: true, output: results };
  }

  if (name === "list_files") {
    const relPath = String(args.path || ".");
    const fullPath = resolveSafePath(ctx, relPath);
    const exists = await fs.pathExists(fullPath);
    if (!exists) throw new Error("Directory not found.");
    
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) throw new Error("Path is not a directory.");

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const output = entries
      .map(e => `${e.name}${e.isDirectory() ? '/' : ''}`)
      .join("\n");
    return { ok: true, output };
  }

  return { ok: false, output: `Unknown tool: ${name}` };
}

export const AGENT_TOOLS_METADATA = [
  {
    name: "file_read",
    description: "Read the contents of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file relative to project root." }
      },
      required: ["path"]
    }
  },
  {
    name: "file_write",
    description: "Write content to a new file or overwrite an existing one.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file relative to project root." },
        content: { type: "string", description: "Full content of the file." }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "file_edit",
    description: "Edit an existing file by replacing a string with another.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file relative to project root." },
        oldText: { type: "string", description: "The exact text to be replaced. Use empty string for append if file exists." },
        newText: { type: "string", description: "The replacement text." }
      },
      required: ["path", "newText"]
    }
  },
  {
    name: "terminal_execute",
    description: "Run a command in the terminal.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run." },
        cwd: { type: "string", description: "Optional working directory relative to project root." }
      },
      required: ["command"]
    }
  },
  {
    name: "search_codebase",
    description: "Search for a query string within all project files.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The text to search for." }
      },
      required: ["query"]
    }
  },
  {
    name: "list_files",
    description: "List files and directories in a given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to project root. Defaults to root." }
      }
    }
  }
];
