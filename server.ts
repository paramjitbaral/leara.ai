import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import axios from "axios";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import http from "http";
import os from "os";
import OpenAI from "openai";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import { randomUUID } from "crypto";
import { runAutonomousAgent } from "./backend/agent/controller";
import { executeToolCall } from "./backend/agent/tools";
import {
  gitStatus,
  gitDiff,
  gitStage,
  gitUnstage,
  gitCommit,
  gitPush,
  gitPull,
  gitBranches,
  gitCheckout,
  gitDiscard,
  gitStash,
  gitConflicts,
  gitRemotes,
  gitSetRemote,
} from "./backend/platform/gitService";
import { collectDiagnostics } from "./backend/platform/diagnostics";
import { getTaskConfig, saveTaskConfig, runTask } from "./backend/platform/taskRunner";
import { buildIndex, getIndex, searchSymbols, startIndexWatcher, stopIndexWatcher } from "./backend/platform/indexer";
import { symbolInfo, findReferences } from "./backend/platform/semantic";
import { discoverTests, runAllTests, runSingleTest } from "./backend/platform/testIntelligence";
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from "./backend/platform/checkpoints";
import { setSecret, getSecret, listSecrets, deleteSecret, hasSecret } from "./backend/platform/secrets";
import { rememberTask, rememberFix, getMemory } from "./backend/platform/memoryStore";
import { evaluateCommandPolicy } from "./backend/platform/policy";
import { logAction, readActionLog } from "./backend/platform/transparency";
import {
  validateGitHubToken,
  buildGitHubOAuthUrl,
  exchangeGitHubOAuthCode,
} from "./backend/platform/githubAuth";
import {
  runManagedCommand,
  getManagedCommand,
  listManagedCommands,
  stopManagedCommand,
} from "./backend/platform/terminalOrchestrator";
import { ensureProjectRoot } from "./backend/platform/workspace";

import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

interface PendingGitHubAuth {
  projectRoot: string;
  createdAt: number;
  completed: boolean;
  login?: string;
  error?: string;
}

const pendingGitHubAuth = new Map<string, PendingGitHubAuth>();

// Desktop-focused workspace: always use local directory
const WORKSPACE_ROOT = path.join(process.cwd(), "workspace");

// Ensure workspace exists
fs.ensureDirSync(WORKSPACE_ROOT);

app.use(express.json());

// API Request Logger
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// --- Terminal Execution Route ---
app.post("/api/terminal/run", async (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: "No command provided" });

  const workingDir = cwd || process.cwd();

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const isWin = process.platform === "win32";
  const shell = isWin ? "powershell.exe" : "sh";
  const args = isWin 
    ? ["-NoProfile", "-NonInteractive", "-Command", command] 
    : ["-c", command];

  const proc = spawn(shell, args, {
    cwd: workingDir,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: false,
  });

  proc.stdout.on("data", (chunk) => res.write(chunk));
  proc.stderr.on("data", (chunk) => res.write(chunk));
  proc.on("close", (code) => {
    res.write(`\n[Process exited with code ${code}]`);
    res.end();
  });
  proc.on("error", (err) => {
    res.write(`\n[Error: ${err.message}]`);
    res.end();
  });
});

// --- File System Routes ---


// List files recursively
app.get("/api/files", async (req, res) => {
  const { userId, path: subPath } = req.query;
  const uid = (userId as string) || "local-user";
  
  const userPath = path.join(WORKSPACE_ROOT, uid, (subPath as string) || "");
  
  // Create starter files if workspace is new
  const hasUserPath = await fs.pathExists(userPath);
  if (!hasUserPath) {
    try {
      await fs.ensureDir(userPath);
      if (!subPath) {
        await fs.writeFile(path.join(userPath, "welcome.md"), "# Welcome to Leara Desktop!\n\nThis is your local development workspace. Since you're running the desktop version, you have full access to your local file system via this workspace folder.\n\n### Local Features\n- **Real Terminal**: Use PowerShell, CMD, or Bash directly.\n- **Direct FS**: Fast file operations.\n- **Privacy**: Your code stays on your machine.");
        await fs.writeFile(path.join(userPath, "hello.js"), "console.log('Hello from Leara Desktop!');");
      }
    } catch (e) {
      console.warn(`[FS] Could not create starter files for ${userPath}:`, e);
    }
  }

  const getTree = async (dir: string): Promise<any[]> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const nodes = await Promise.all(entries.map(async (entry) => {
        // Essential exclusions for performance and noise reduction
        if (['.git', '.next', '.cache', '__pycache__'].includes(entry.name)) return null;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(path.join(WORKSPACE_ROOT, uid), fullPath);
        
        if (entry.isDirectory()) {
          // Don't recurse into heavy dependency folders to prevent performance degradation
          const isHeavy = ['node_modules', 'dist', 'build', 'venv', '.venv'].includes(entry.name);
          
          return {
            id: relativePath,
            name: entry.name,
            type: "directory",
            children: isHeavy ? [] : await getTree(fullPath)
          };
        }
        return {
          id: relativePath,
          name: entry.name,
          type: "file",
          path: relativePath
        };
      }));
      return nodes.filter(Boolean);
    } catch (err) {
      return [];
    }
  };

  try {
    const tree = await getTree(userPath);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get workspace storage stats
app.get("/api/workspace/stats", async (req, res) => {
  const { userId } = req.query;
  const uid = (userId as string) || "local-user";
  const userPath = path.join(WORKSPACE_ROOT, uid);

  let totalSize = 0;
  
  const calculateSize = async (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', 'my_env', '.venv', 'venv'].includes(entry.name)) {
        continue; // Skip heavy dependency/framework folders to show real code footprint
      }
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await calculateSize(fullPath);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        } catch (e) {}
      }
    }
  };

  try {
    await calculateSize(userPath);
    
    // Format byte footprint into human-readable industrial standard
    let formattedLog = "0 B";
    if (totalSize === 0) formattedLog = "0 B";
    else if (totalSize > 1073741824) formattedLog = (totalSize / 1073741824).toFixed(1) + " GB";
    else if (totalSize > 1048576) formattedLog = (totalSize / 1048576).toFixed(1) + " MB";
    else if (totalSize > 1024) formattedLog = (totalSize / 1024).toFixed(1) + " KB";
    else formattedLog = totalSize + " B";

    res.json({ bytes: totalSize, formatted: formattedLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file
app.get("/api/files/content", async (req, res) => {
  const { userId, path: filePath } = req.query;
  const uid = (userId as string) || "local-user";
  if (!filePath) return res.status(400).json({ error: "Path required" });

  const fullPath = path.join(WORKSPACE_ROOT, uid, filePath as string);
  try {
    const content = await fs.readFile(fullPath, "utf-8");
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create file/dir
app.post("/api/files/create", async (req, res) => {
  const { userId, path: targetPath, type, name } = req.body;
  const uid = userId || "local-user";
  const fullPath = path.join(WORKSPACE_ROOT, uid, targetPath || "", name);
  
  try {
    if (type === "directory") {
      await fs.ensureDir(fullPath);
    } else {
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, "");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save file
app.post("/api/files/save", async (req, res) => {
  const { userId, path: filePath, content } = req.body;
  const uid = userId || "local-user";
  const fullPath = path.join(WORKSPACE_ROOT, uid, filePath);
  
  try {
    await fs.writeFile(fullPath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
app.delete("/api/files/delete", async (req, res) => {
  const { userId, path: targetPath } = req.query;
  const uid = (userId as string) || "local-user";
  const fullPath = path.join(WORKSPACE_ROOT, uid, targetPath as string);
  
  try {
    await fs.remove(fullPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename
app.put("/api/files/rename", async (req, res) => {
  const { userId, oldPath, newPath } = req.body;
  const uid = userId || "local-user";
  const oldFullPath = path.join(WORKSPACE_ROOT, uid, oldPath);
  const newFullPath = path.join(WORKSPACE_ROOT, uid, newPath);
  try {
    await fs.move(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deep Content Search
app.post("/api/search/content", async (req, res) => {
  const { userId, query, options, path: subPath } = req.body;
  const uid = userId || "local-user";
  const userPath = path.join(WORKSPACE_ROOT, uid, subPath || "");
  const { caseSensitive, wholeWord, regex } = options || {};

  if (!query) return res.json([]);

  const results: any[] = [];
  const walk = async (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if ((entry.name.startsWith('.') && entry.name !== '.env') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__pycache__') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        // Skip common binary files and compiled items
        if (/\.(pyc|exe|dll|so|o|a|bin|obj|png|jpg|jpeg|gif|ico|pdf|zip|gz|7z)$/i.test(entry.name)) continue;

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          // Heuristic: check for null bytes to identify binary content
          if (content.includes('\0')) continue;

          const lines = content.split('\n');
          const fileMatches: any[] = [];
          
          let searchPattern: RegExp;
          try {
            if (regex) {
              searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
            } else {
              let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              if (wholeWord) escaped = `\\b${escaped}\\b`;
              searchPattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
            }
          } catch (reErr) {
            continue; // Invalid regex, skip
          }

          lines.forEach((line, index) => {
            // Reset regex state for each line if using global
            searchPattern.lastIndex = 0;
            if (searchPattern.test(line)) {
              fileMatches.push({
                line: index + 1,
                content: line.trim().substring(0, 500) // Truncate very long lines
              });
            }
          });

          if (fileMatches.length > 0) {
            results.push({
              file: path.relative(userPath, fullPath).replace(/\\/g, '/'),
              matches: fileMatches
            });
          }
        } catch (e) {}
      }
    }
  };

  try {
    await walk(userPath);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global Content Replace
app.post("/api/replace/content", async (req, res) => {
  const { userId, query, replace, options, files, path: subPath } = req.body;
  const uid = userId || "local-user";
  const userPath = path.join(WORKSPACE_ROOT, uid, subPath || "");
  const { caseSensitive, wholeWord, regex } = options || {};

  if (!query || !files || !Array.isArray(files)) return res.status(400).json({ error: "Invalid parameters" });

  try {
    for (const fileRelPath of files) {
      const fullPath = path.join(userPath, fileRelPath);
      if (!(await fs.pathExists(fullPath))) continue;

      let content = await fs.readFile(fullPath, "utf-8");
      let searchPattern: RegExp;
      
      if (regex) {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWord) escaped = `\\b${escaped}\\b`;
        searchPattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }

      const newContent = content.replace(searchPattern, replace || '');
      await fs.writeFile(fullPath, newContent);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GitHub Import ---
app.post("/api/github/import", async (req, res) => {
  const { userId, repoUrl } = req.body;
  const uid = userId || "local-user";
  
  if (!repoUrl) return res.status(400).json({ error: "repoUrl is required" });

  const cleanUrl = repoUrl.trim().replace(/\/$/, "");
  const repoName = cleanUrl.split("/").pop()?.replace(".git", "") || "repo";
  const userPath = path.join(WORKSPACE_ROOT, uid);
  const targetPath = path.join(userPath, repoName);

  try {
    await fs.ensureDir(userPath);
    if (await fs.pathExists(targetPath)) {
      await fs.remove(targetPath);
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    console.log(`[DESKTOP] Cloning: ${cleanUrl} -> ${targetPath}`);
    await execAsync(`git clone --depth 1 "${cleanUrl}" "${targetPath}"`, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      timeout: 60000 
    });
    
    res.json({ success: true, folder: repoName });
  } catch (err: any) {
    console.error("Github Import Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- AI Copilot Proxy ---
app.post("/api/ai/copilot", async (req, res) => {
  const { prompt, context, provider, apiKey, model, endpoint, systemInstruction } = req.body;
  
  console.log(`[AI] request via ${provider} (${model || 'default model'})`);

  try {
    if (provider === "ollama") {
      const response = await axios.post("http://localhost:11434/api/generate", {
        model: model || "codellama",
        prompt: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}`,
        system: systemInstruction,
        stream: false
      }, { timeout: 30000 });
      return res.json({ response: response.data.response });
    }

    if (provider === "openai" || provider === "custom") {
      const key = apiKey || (provider === "openai" ? process.env.OPENAI_API_KEY : '');
      if (!key && provider === "openai") throw new Error("OpenAI API Key is missing.");
      
      const baseUrl = endpoint || "https://api.openai.com/v1";

      if (provider === "openai") {
        const openai = new OpenAI({ apiKey: key, timeout: 30000 });
        const completion = await openai.chat.completions.create({
          model: model || "gpt-4-turbo-preview",
          messages: [
            { role: "system", content: systemInstruction || "You are a helpful coding assistant." },
            { role: "user", content: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}` }
          ],
        });
        return res.json({ response: completion.choices[0].message.content });
      }

      if (provider === "custom") {
        const attemptCustom = async (modelName: string) => {
          return await axios.post(`${baseUrl}/chat/completions`, {
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction || "You are a helpful coding assistant." },
              { role: "user", content: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}` }
            ]
          }, { 
            headers: { 
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000 
          });
        };

        const isOpenRouter = baseUrl.includes('openrouter.ai');
        const modelsToTry = [model];
        
        const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean))) as string[];
        let lastError: any = null;

        for (const targetModel of uniqueModels) {
          try {
            console.log(`[AI] Attempting Custom Model: ${targetModel}...`);
            const response = await attemptCustom(targetModel);
            if (response.data.choices?.[0]?.message?.content) {
              return res.json({ response: response.data.choices[0].message.content, modelUsed: targetModel });
            }
            
            // Handle OpenRouter-specific error responses that come as 200 OK
            const orError = response.data.error?.message;
            if (orError) throw new Error(orError);
            
            throw new Error("Invalid response structure from custom provider");
          } catch (err: any) {
            lastError = err;
            const status = err.response?.status;
            const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
            console.warn(`[AI] Custom ${targetModel} failed: ${msg}`);
            
            // Only break on permanent errors (auth, payment, rate limits)
            // These are account-wide, so retrying other models with the same key won't help
            if (status === 401 || status === 402 || status === 429) break;
          }
        }
        const finalMsg = lastError.response?.data?.error?.message || lastError.response?.data?.message || lastError.message;
        throw new Error(`Custom Provider Exhausted: ${finalMsg}`);
      }
    }

    if (provider === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Gemini API Key is missing.");
      
      const attemptGemini = async (modelName: string) => {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        return await axios.post(apiUrl, {
          contents: [{ 
            parts: [{ 
              text: `${systemInstruction || "You are a helpful coding assistant."}\n\nContext: ${JSON.stringify(context)}\n\nQuery: ${prompt}` 
            }] 
          }]
        }, { timeout: 15000 });
      };

      // Intelligent Fallback Chain: We try the requested model first, then fall back to the most stable tiers
      const modelsToTry = [model, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"].filter(Boolean) as string[];
      // Remove duplicates while preserving order
      const uniqueModels = Array.from(new Set(modelsToTry));
      
      let lastError: any = null;
      for (const targetModel of uniqueModels) {
        try {
          console.log(`[AI] Attempting ${targetModel}...`);
          const response = await attemptGemini(targetModel);
          
          if (response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.log(`[AI] Success with ${targetModel}`);
            return res.json({ response: response.data.candidates[0].content.parts[0].text, modelUsed: targetModel });
          }
          throw new Error("Invalid response structure from Gemini API");
        } catch (err: any) {
          lastError = err;
          const status = err.response?.status;
          const msg = err.response?.data?.error?.message || err.message;
          console.warn(`[AI] ${targetModel} failed: ${msg}`);
          
          // If it's an authentication error (401/403), don't bother retrying other models
          if (status === 401 || (status === 403 && !msg.toLowerCase().includes('quota'))) {
            break;
          }
        }
      }
      
      const finalMsg = lastError.response?.data?.error?.message || lastError.message;
      throw new Error(`Gemini Exhausted: ${finalMsg}`);
    }

    res.json({ response: `AI Provider '${provider}' not supported on backend.` });
  } catch (err: any) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    console.error(`[AI] Error (${provider}):`, errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/terminal/exec", async (req, res) => {
  const { command, userId, folder } = req.body;
  const userRoot = path.join(WORKSPACE_ROOT, userId || "local-user");
  const userPath = folder ? path.join(userRoot, folder) : userRoot;

  if (!fs.existsSync(userPath)) {
    return res.status(404).json({ error: "Working directory not found" });
  }

  console.log(`[AI-TOOL] Executing: ${command} in ${userPath}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: userPath,
      env: { ...process.env, HOME: userRoot, USERPROFILE: userRoot },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 // 1MB
    });
    res.json({ stdout, stderr, success: true });
  } catch (err: any) {
    res.json({ 
      stdout: err.stdout || "", 
      stderr: err.stderr || err.message, 
      success: false,
      exitCode: err.code
    });
  }
});

app.post("/api/agent/run", async (req, res) => {
  const {
    prompt,
    context,
    userId,
    folder,
    provider,
    apiKey,
    model,
    endpoint,
    systemInstruction,
    maxIterations,
    history,
    initialSteps,
    interactive,
  } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!provider || !["gemini", "openai", "ollama", "custom"].includes(provider)) {
    return res.status(400).json({ error: "provider must be gemini|openai|ollama|custom" });
  }

  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    await rememberTask(projectRoot, taskId, prompt, "running");
    const result = await runAutonomousAgent({
      task: prompt,
      context,
      workspaceRoot: WORKSPACE_ROOT,
      userId: userId || "local-user",
      folder,
      maxIterations,
      provider,
      apiKey,
      model,
      endpoint,
      systemInstruction,
      history,
      initialSteps,
      interactive,
    });

    const lastError = (result.logs || []).filter((l) => l.status === "error").slice(-1)[0];
    if (lastError?.output) {
      await rememberFix(projectRoot, lastError.output, result.summary);
    }
    await rememberTask(projectRoot, taskId, prompt, result.completed ? "completed" : "stopped");
    await logAction(projectRoot, {
      ts: new Date().toISOString(),
      scope: "agent",
      action: "run",
      status: result.completed ? "ok" : "error",
      details: {
        taskId,
        iterations: result.iterations,
        completed: result.completed,
        touchedFiles: result.touchedFiles,
      },
    });

    res.json(result);
  } catch (err: any) {
    console.error("[AGENT] run error:", err.message);
    const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
    await rememberTask(projectRoot, taskId, prompt, "error");
    await rememberFix(projectRoot, err.message || "agent error", "agent route exception");
    res.status(500).json({ error: err.message || "Agent execution failed" });
  }
});

app.post("/api/agent/execute", async (req, res) => {
  const { tool, userId, folder } = req.body || {};
  if (!tool) return res.status(400).json({ error: "tool is required" });

  try {
    const result = await executeToolCall(tool, {
      workspaceRoot: WORKSPACE_ROOT,
      userId: userId || "local-user",
      folder,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Source Control APIs ---
app.post("/api/github/auth/oauth/start", async (req, res) => {
  const { userId, folder } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET in .env",
    });
  }

  const state = randomUUID();
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers.host;
  const redirectUri =
    process.env.GITHUB_OAUTH_REDIRECT_URI || `${proto}://${host}/api/github/auth/oauth/callback`;

  pendingGitHubAuth.set(state, {
    projectRoot,
    createdAt: Date.now(),
    completed: false,
  });

  const authUrl = buildGitHubOAuthUrl({
    clientId,
    state,
    redirectUri,
    scope: "repo read:user",
  });

  res.json({ state, authUrl });
});

app.get("/api/github/auth/oauth/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const pending = pendingGitHubAuth.get(state);

  if (!pending) {
    return res.status(400).send("Invalid or expired OAuth state.");
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers.host;
  const redirectUri =
    process.env.GITHUB_OAUTH_REDIRECT_URI || `${proto}://${host}/api/github/auth/oauth/callback`;

  if (!clientId || !clientSecret) {
    pending.completed = true;
    pending.error = "GitHub OAuth env is not configured";
    return res.status(500).send("GitHub OAuth server config missing.");
  }

  try {
    const token = await exchangeGitHubOAuthCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const user = await validateGitHubToken(token);

    await setSecret(pending.projectRoot, "GITHUB_TOKEN", token);
    await setSecret(pending.projectRoot, "GITHUB_LOGIN", user.login);
    await logAction(pending.projectRoot, {
      ts: new Date().toISOString(),
      scope: "github-auth",
      action: "oauth-connect",
      status: "ok",
      details: { login: user.login },
    });

    pending.completed = true;
    pending.login = user.login;

    return res.send(`<!doctype html>
<html><body style="font-family:sans-serif;background:#111;color:#ddd;display:flex;align-items:center;justify-content:center;height:100vh;">
  <div>
    <h3>GitHub connected</h3>
    <p>You can close this window.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'leara-github-auth', state: '${state}', success: true, login: '${user.login}' }, window.location.origin);
      }
    } catch (e) {}
    setTimeout(() => window.close(), 300);
  </script>
</body></html>`);
  } catch (err: any) {
    pending.completed = true;
    pending.error = err.message || "OAuth callback failed";
    return res.send(`<!doctype html>
<html><body style="font-family:sans-serif;background:#111;color:#ddd;display:flex;align-items:center;justify-content:center;height:100vh;">
  <div>
    <h3>GitHub connection failed</h3>
    <p>${String(err.message || "Unknown error")}</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'leara-github-auth', state: '${state}', success: false, error: '${String(err.message || "Unknown error").replace(/'/g, "")}' }, window.location.origin);
      }
    } catch (e) {}
  </script>
</body></html>`);
  }
});

app.get("/api/github/auth/oauth/result", async (req, res) => {
  const state = String(req.query.state || "");
  const pending = pendingGitHubAuth.get(state);
  if (!pending) return res.status(404).json({ error: "OAuth state not found" });

  // Auto-expire old state entries.
  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    pendingGitHubAuth.delete(state);
    return res.status(410).json({ error: "OAuth state expired" });
  }

  res.json({
    completed: pending.completed,
    success: pending.completed && !pending.error,
    login: pending.login || null,
    error: pending.error || null,
  });
});

app.get("/api/github/auth/status", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const connected = await hasSecret(projectRoot, "GITHUB_TOKEN");
    const login = await getSecret(projectRoot, "GITHUB_LOGIN");
    res.json({ connected, login: login || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/github/auth/connect", async (req, res) => {
  const { userId, folder, token } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const user = await validateGitHubToken(token);
    await setSecret(projectRoot, "GITHUB_TOKEN", token);
    await setSecret(projectRoot, "GITHUB_LOGIN", user.login);
    await logAction(projectRoot, {
      ts: new Date().toISOString(),
      scope: "github-auth",
      action: "connect",
      status: "ok",
      details: { login: user.login },
    });
    res.json({ connected: true, login: user.login });
  } catch (err: any) {
    res.status(400).json({ error: err.response?.data?.message || err.message || "GitHub connection failed" });
  }
});

app.post("/api/github/auth/disconnect", async (req, res) => {
  const { userId, folder } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await deleteSecret(projectRoot, "GITHUB_TOKEN");
    await deleteSecret(projectRoot, "GITHUB_LOGIN");
    await logAction(projectRoot, {
      ts: new Date().toISOString(),
      scope: "github-auth",
      action: "disconnect",
      status: "ok",
    });
    res.json({ connected: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scm/status", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const status = await gitStatus(projectRoot);
    await logAction(projectRoot, { ts: new Date().toISOString(), scope: "scm", action: "status", status: "ok" });
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scm/diff", async (req, res) => {
  const { userId, folder, file } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const diff = await gitDiff(projectRoot, file as string | undefined);
    res.json({ diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/stage", async (req, res) => {
  const { userId, folder, paths = [] } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const status = await gitStage(projectRoot, paths);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/unstage", async (req, res) => {
  const { userId, folder, paths = [] } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const status = await gitUnstage(projectRoot, paths);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/discard", async (req, res) => {
  const { userId, folder, paths = [] } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const status = await gitDiscard(projectRoot, paths);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/commit", async (req, res) => {
  const { userId, folder, message } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const result = await gitCommit(projectRoot, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/push", async (req, res) => {
  const { userId, folder, remote, branch, approved = false } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const policy = evaluateCommandPolicy(`git push ${remote || "origin"} ${branch || ""}`.trim(), approved);
    if (!policy.allowed) return res.status(403).json({ error: policy.reason, requiresApproval: policy.requiresApproval });
    const ghToken = await getSecret(projectRoot, "GITHUB_TOKEN");
    const result = await gitPush(projectRoot, remote, branch, ghToken || undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/pull", async (req, res) => {
  const { userId, folder, remote, branch } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const ghToken = await getSecret(projectRoot, "GITHUB_TOKEN");
    const result = await gitPull(projectRoot, remote, branch, ghToken || undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scm/remotes", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const remotes = await gitRemotes(projectRoot);
    res.json({ remotes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/remotes/set", async (req, res) => {
  const { userId, folder, name, url } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await gitSetRemote(projectRoot, name || "origin", url);
    const remotes = await gitRemotes(projectRoot);
    res.json({ success: true, remotes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scm/branches", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const branches = await gitBranches(projectRoot);
    res.json(branches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/checkout", async (req, res) => {
  const { userId, folder, branch, create } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const result = await gitCheckout(projectRoot, branch, create);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/scm/stash", async (req, res) => {
  const { userId, folder, message } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const result = await gitStash(projectRoot, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/scm/conflicts", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const conflicts = await gitConflicts(projectRoot);
    res.json({ conflicts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Problems / Diagnostics ---
app.get("/api/problems", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const diagnostics = await collectDiagnostics(projectRoot);
    res.json({ diagnostics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Task Runner ---
app.get("/api/tasks", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const config = await getTaskConfig(projectRoot);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { userId, folder, config } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await saveTaskConfig(projectRoot, config);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks/run", async (req, res) => {
  const { userId, folder, taskName, approved = true } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const job = await runTask(projectRoot, taskName, approved);
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Index / Symbol / Semantic ---
app.post("/api/index/build", async (req, res) => {
  const { userId, folder } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const index = await buildIndex(projectRoot);
    res.json(index);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/index", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const index = getIndex(projectRoot);
    res.json(index || { symbols: [], updatedAt: null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/index/watch/start", async (req, res) => {
  const { userId, folder } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await startIndexWatcher(projectRoot);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/index/watch/stop", async (req, res) => {
  const { userId, folder } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    stopIndexWatcher(projectRoot);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/symbols/search", async (req, res) => {
  const { userId, folder, query } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const results = await searchSymbols(projectRoot, String(query || ""));
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/symbols/info", async (req, res) => {
  const { userId, folder, symbol } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const info = await symbolInfo(projectRoot, String(symbol || ""));
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/symbols/references", async (req, res) => {
  const { userId, folder, symbol } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const refs = await findReferences(projectRoot, String(symbol || ""));
    res.json({ references: refs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tests Intelligence ---
app.get("/api/tests/discover", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const tests = await discoverTests(projectRoot);
    res.json({ tests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tests/run", async (req, res) => {
  const { userId, folder, testPath } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const job = testPath ? await runSingleTest(projectRoot, testPath) : await runAllTests(projectRoot);
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Checkpoints / Rollback ---
app.post("/api/checkpoints/create", async (req, res) => {
  const { userId, folder, files = [], note } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const checkpoint = await createCheckpoint(projectRoot, files, note);
    res.json(checkpoint);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checkpoints", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const checkpoints = await listCheckpoints(projectRoot);
    res.json({ checkpoints });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkpoints/restore", async (req, res) => {
  const { userId, folder, id } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const result = await restoreCheckpoint(projectRoot, id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Secrets ---
app.get("/api/secrets", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const keys = await listSecrets(projectRoot);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/secrets/set", async (req, res) => {
  const { userId, folder, key, value } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await setSecret(projectRoot, key, value);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/secrets/get", async (req, res) => {
  const { userId, folder, key } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const value = await getSecret(projectRoot, key);
    res.json({ value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Session Memory ---
app.get("/api/memory", async (req, res) => {
  const { userId, folder } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const memory = await getMemory(projectRoot);
    res.json(memory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/memory/task", async (req, res) => {
  const { userId, folder, id, prompt, status } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await rememberTask(projectRoot, id, prompt, status);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/memory/fix", async (req, res) => {
  const { userId, folder, error, fix } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    await rememberFix(projectRoot, error, fix);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Managed Terminals ---
app.post("/api/terminals/run", async (req, res) => {
  const { userId, folder, command, approved = false } = req.body || {};
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId, folder);
  try {
    const job = await runManagedCommand(command, projectRoot, approved);
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/terminals", async (_req, res) => {
  try {
    const jobs = listManagedCommands();
    res.json({ jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/terminals/:id", async (req, res) => {
  try {
    const job = getManagedCommand(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/terminals/:id/stop", async (req, res) => {
  try {
    const result = stopManagedCommand(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Transparency Logs ---
app.get("/api/actions/logs", async (req, res) => {
  const { userId, folder, limit } = req.query;
  const projectRoot = await ensureProjectRoot(WORKSPACE_ROOT, userId as string, folder as string);
  try {
    const logs = await readActionLog(projectRoot, Number(limit || 200));
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Terminal Integration ---
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const userId = url.searchParams.get("userId") || "local-user";
    const folder = url.searchParams.get("folder");
    const userRoot = path.join(WORKSPACE_ROOT, userId);
    const userPath = folder ? path.join(userRoot, folder) : userRoot;
    
    try {
      if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true });
      }
    } catch (e) {
      console.warn(`[TERMINAL] mkdir failed (expected if path exists): ${e}`);
    }

    const isWindows = process.platform === "win32";
    const shell = isWindows ? "powershell.exe" : (process.env.SHELL || "bash");
    
    // Create actual PTY session
    const ptyProcess = pty.spawn(shell, isWindows ? [] : ["-i"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: userPath,
      env: { 
        ...process.env, 
        HOME: userRoot,
        USERPROFILE: userRoot,
        TERM: "xterm-256color" 
      }
    });

    console.log(`[PTY] Session started: ${shell} in ${userPath}`);

    ptyProcess.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ws.on("message", (message) => {
      const data = message.toString();
      
      // Control Signal Trap: Intercept PTY resizes before they touch stdin
      if (data.startsWith("__resize__:")) {
        try {
          const json = JSON.parse(data.split("__resize__:")[1]);
          if (json.cols && json.rows) {
            ptyProcess.resize(json.cols, json.rows);
            return; // EXIT: Do not pass this to the shell
          }
        } catch (e) {
          console.error("[PTY] Resize trap failed:", e);
        }
      }

      // User Data: Pass regular keystrokes/commands to the active pty
      ptyProcess.write(data);
    });

    ws.on("close", () => {
      console.log(`[PTY] Session closed`);
      ptyProcess.kill();
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/terminal") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`
🚀 Leara Desktop Server Running
🏠 Workspace: ${WORKSPACE_ROOT}
🔗 URL: http://localhost:${PORT}
🆔 Mode: ${process.env.NODE_ENV || 'development'}
Vite Middleware: ACTIVE
    `);
  });
}

startServer();
