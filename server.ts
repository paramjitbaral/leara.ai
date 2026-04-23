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

dotenv.config();

const app = express();
const PORT = 3000;

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
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') return null;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(path.join(WORKSPACE_ROOT, uid), fullPath);
        
        if (entry.isDirectory()) {
          return {
            id: relativePath,
            name: entry.name,
            type: "directory",
            children: await getTree(fullPath)
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
      });
      return res.json({ response: response.data.response });
    }

    if (provider === "openai" || provider === "custom") {
      const key = apiKey || (provider === "openai" ? process.env.OPENAI_API_KEY : '');
      if (!key && provider === "openai") throw new Error("OpenAI API Key is missing.");
      
      const openaiConfig: any = { 
        apiKey: key || 'no-key-required'
      };
      
      if (provider === "custom" && endpoint) {
        openaiConfig.baseURL = endpoint;
      }
      
      const openai = new OpenAI(openaiConfig);
      const completion = await openai.chat.completions.create({
        model: model || (provider === "openai" ? "gpt-4-turbo-preview" : "gpt-3.5-turbo"),
        messages: [
          { role: "system", content: systemInstruction || "You are a helpful coding assistant." },
          { role: "user", content: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}` }
        ],
      });
      return res.json({ response: completion.choices[0].message.content });
    }

    if (provider === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Gemini API Key is missing.");
      
      const geminiModel = model || "gemini-1.5-flash";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`;
      
      const response = await axios.post(apiUrl, {
        contents: [{ 
          parts: [{ 
            text: `${systemInstruction || "You are a helpful coding assistant."}\n\nContext: ${JSON.stringify(context)}\n\nQuery: ${prompt}` 
          }] 
        }]
      });
      
      if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("[AI] Gemini error response:", response.data);
        throw new Error("Invalid response structure from Gemini API");
      }

      return res.json({ response: response.data.candidates[0].content.parts[0].text });
    }

    res.json({ response: `AI Provider '${provider}' not supported on backend.` });
  } catch (err: any) {
    const errorMessage = err.response?.data?.error?.message || err.message;
    console.error(`[AI] Error (${provider}):`, errorMessage);
    res.status(500).json({ error: errorMessage });
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
    const args = isWindows ? ["-NoLogo", "-ExecutionPolicy", "Bypass"] : ["-i"];

    console.log(`[TERMINAL] Spawning ${shell} in ${userPath}`);
    
    const shellProcess = spawn(shell, args, {
      cwd: userPath,
      env: { 
        ...process.env, 
        HOME: userRoot,
        USERPROFILE: userRoot,
        TERM: "xterm-256color" 
      },
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    shellProcess.stdout.on("data", (data) => ws.send(data.toString()));
    shellProcess.stderr.on("data", (data) => ws.send(data.toString()));

    ws.on("message", (message) => {
      shellProcess.stdin.write(message.toString());
    });

    ws.on("close", () => shellProcess.kill());
    shellProcess.on("exit", () => ws.close());
    shellProcess.on("error", (err) => {
      ws.send(`\r\n\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
      ws.close();
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
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
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
