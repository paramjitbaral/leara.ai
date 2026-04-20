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

dotenv.config();
import os from "os";

const app = express();
const PORT = 3000;

// On Vercel, we must use /tmp for any write operations
const WORKSPACE_ROOT = process.env.VERCEL 
  ? path.join(os.tmpdir(), "workspace")
  : path.join(process.cwd(), "workspace");

// Ensure workspace exists
fs.ensureDirSync(WORKSPACE_ROOT);

app.use(express.json());

// Logger for debugging Vercel routing
app.use((req, res, next) => {
  console.log(`[API REQUEST] ${req.method} ${req.url}`);
  next();
});

// --- File System Routes ---

// List files recursively
app.get("/api/files", async (req, res) => {
  const { userId, path: subPath } = req.query;
  if (!userId) return res.status(400).json({ error: "User ID required" });
  
  const userPath = path.join(WORKSPACE_ROOT, userId as string, (subPath as string) || "");
  
  // Create starter files if workspace is new
  if (!(await fs.pathExists(userPath))) {
    await fs.ensureDir(userPath);
    if (!subPath) {
      await fs.writeFile(path.join(userPath, "welcome.md"), "# Welcome to AI Code Mentor!\n\nThis is your personal learning workspace. Use the **Copilot** on the right to explain code, fix bugs, or build new features.\n\n### Getting Started\n1. Select a file from the explorer.\n2. Ask the AI to explain it.\n3. Try the **Practice** mode to test your knowledge.");
      await fs.writeFile(path.join(userPath, "hello_world.js"), "console.log('Hello, AI Learner!');\n\n// Try asking the AI to 'Explain this code' in the Copilot panel.");
    }
  }

  const getTree = async (dir: string): Promise<any[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes = await Promise.all(entries.map(async (entry) => {
      // Ignore hidden files and system trash
      if (entry.name.startsWith('.') || entry.name === 'node_modules') return null;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(userPath, fullPath);
      
      console.log(`[FILE DISCOVERY] Found: ${entry.name}, Type: ${entry.isDirectory() ? 'Dir' : 'File'}, Path: ${relativePath}`);

      if (entry.isDirectory()) {
        return {
          id: subPath ? path.join(subPath as string, relativePath) : relativePath,
          name: entry.name,
          type: "directory",
          children: await getTree(fullPath)
        };
      }
      return {
        id: subPath ? path.join(subPath as string, relativePath) : relativePath,
        name: entry.name,
        type: "file",
        path: subPath ? path.join(subPath as string, relativePath) : relativePath
      };
    }));
    return nodes;
  };

  try {
    const tree = await getTree(userPath);
    res.json(tree.filter(Boolean));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Read file
app.get("/api/files/content", async (req, res) => {
  const { userId, path: filePath } = req.query;
  if (!userId || !filePath) return res.status(400).json({ error: "User ID and Path required" });

  const fullPath = path.join(WORKSPACE_ROOT, userId as string, filePath as string);
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
  const fullPath = path.join(WORKSPACE_ROOT, userId, targetPath || "", name);
  
  try {
    if (type === "directory") {
      await fs.ensureDir(fullPath);
    } else {
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
  const fullPath = path.join(WORKSPACE_ROOT, userId, filePath);
  
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
  const fullPath = path.join(WORKSPACE_ROOT, userId as string, targetPath as string);
  
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
  const oldFullPath = path.join(WORKSPACE_ROOT, userId, oldPath);
  const newFullPath = path.join(WORKSPACE_ROOT, userId, newPath);
  
  try {
    await fs.move(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync (Restore)
app.post("/api/files/sync", async (req, res) => {
  const { userId, files } = req.body; // files is an array of { path: string, content: string, type: 'file' | 'directory' }
  if (!userId || !Array.isArray(files)) return res.status(400).json({ error: "userId and files array required" });

  try {
    for (const file of files) {
      const fullPath = path.join(WORKSPACE_ROOT, userId, file.path);
      if (file.type === "directory") {
        await fs.ensureDir(fullPath);
      } else {
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, file.content || "");
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- GitHub Import ---
app.post("/api/github/import", async (req, res) => {
  const { userId, repoUrl } = req.body;
  
  if (!userId || !repoUrl) {
    return res.status(400).json({ error: "userId and repoUrl are required" });
  }

  // Clean up repoUrl and extract repoName
  const cleanUrl = repoUrl.trim().replace(/\/$/, "");
  const repoName = cleanUrl.split("/").pop()?.replace(".git", "") || "repo";
  
  const userPath = path.join(WORKSPACE_ROOT, userId);
  const targetPath = path.join(userPath, repoName);

  console.log(`Importing repo: ${cleanUrl} for user: ${userId} into ${targetPath}`);

  try {
    await fs.ensureDir(userPath);
    
    // If directory exists, remove it first to allow a clean clone
    if (await fs.pathExists(targetPath)) {
      console.log(`Directory ${targetPath} already exists, removing for clean clone...`);
      await fs.remove(targetPath);
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Use --depth 1 for faster clones
      // GIT_TERMINAL_PROMPT=0 prevents hanging on private repos
      console.log(`Executing: git clone --depth 1 "${cleanUrl}" "${targetPath}"`);
      const { stdout, stderr } = await execAsync(`git clone --depth 1 "${cleanUrl}" "${targetPath}"`, {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        cwd: userPath,
        timeout: 60000 // 1 minute timeout
      });
      
      console.log(`Successfully imported ${cleanUrl}`);

      // Fetch the file tree for the newly imported repo
      const getFileTree = async (dir: string, base: string = ""): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const nodes = await Promise.all(entries.map(async (entry) => {
          const relativePath = path.join(base, entry.name);
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (entry.name === ".git" || entry.name === "node_modules") return null;
            return {
              id: relativePath,
              name: entry.name,
              type: "directory",
              children: await getFileTree(fullPath, relativePath)
            };
          } else {
            // Do not read file content during import to avoid massive JSON payloads
            // and memory out-of-bounds errors on large repositories. The editor fetching
            // the file content will load it from disk locally instead.
            return {
              id: relativePath,
              name: entry.name,
              type: "file",
              content: ""
            };
          }
        }));
        return nodes.filter(Boolean);
      };

      const fileTree = await getFileTree(targetPath, repoName);
      res.json({ success: true, folder: repoName, fileTree });
    } catch (cloneErr: any) {
      console.error('Git clone failed:', cloneErr.message);
      console.error('Git stderr:', cloneErr.stderr);
      
      let userFriendlyError = "Failed to clone repository";
      const stderr = cloneErr.stderr || "";
      
      if (stderr.includes("Authentication failed") || stderr.includes("could not read from remote repository")) {
        userFriendlyError = "Authentication failed. Please ensure the repository is public.";
      } else if (stderr.includes("not found")) {
        userFriendlyError = "Repository not found. Please check the URL.";
      } else if (cloneErr.code === 'ETIMEDOUT') {
        userFriendlyError = "Clone timed out. The repository might be too large.";
      }

      res.status(500).json({ 
        error: userFriendlyError,
        details: stderr || cloneErr.message
      });
    }
  } catch (err: any) {
    console.error("GitHub Import Error Details:", err);
    res.status(500).json({ 
      error: "Internal server error during import",
      details: err.message
    });
  }
});

import OpenAI from "openai";

// --- AI Copilot Proxy ---
app.post("/api/ai/copilot", async (req, res) => {
  const { prompt, context, provider, apiKey, systemInstruction } = req.body;
  
  try {
    if (provider === "ollama") {
      const response = await axios.post("http://localhost:11434/api/generate", {
        model: "codellama",
        prompt: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}`,
        system: systemInstruction,
        stream: false
      }).catch(() => {
        throw new Error("Ollama not running locally. Please ensure Ollama is active on port 11434.");
      });
      return res.json({ response: response.data.response });
    }

    if (provider === "openai") {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) {
        throw new Error("OpenAI API Key is missing.");
      }
      const openai = new OpenAI({ apiKey: key });
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemInstruction || "You are a helpful coding assistant." },
          { role: "user", content: `Context: ${JSON.stringify(context)}\n\nQuery: ${prompt}` }
        ],
      });
      return res.json({ response: completion.choices[0].message.content });
    }

    // Default fallback or Gemini (though Gemini is usually called from frontend)
    res.json({ response: "AI Provider not supported or configured on backend." });
  } catch (err: any) {
    console.error("AI Proxy Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Vite Integration ---
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const userId = url.searchParams.get("userId") || "default-user";
    const folder = url.searchParams.get("folder");
    const userRoot = path.join(WORKSPACE_ROOT, userId);
    const userPath = folder ? path.join(userRoot, folder) : userRoot;
    
    fs.ensureDirSync(userRoot);
    if (folder) fs.ensureDirSync(userPath);

    // Create a custom .bashrc for the user in their root workspace
    const bashrcPath = path.join(userRoot, ".bashrc");
    const bashrcContent = `
export PS1='\\[\\e[32m\\]${userId}@mentor\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ '
alias ls='ls --color=auto'
alias ll='ls -alF'
alias grep='grep --color=auto'
echo -e "\\e[32mWelcome to AI Code Mentor Terminal!\\e[0m"
echo -e "\\e[33mNote: Port 3000 is reserved for this app. To test servers, use other ports.\\e[0m"
`;
    fs.writeFileSync(bashrcPath, bashrcContent);

    // Try to use python3 to spawn a PTY for a better experience, fallback to bash, then sh
    const tryPTY = () => {
      const shellEnv = { 
        ...process.env, 
        HOME: userRoot,
        TERM: "xterm-256color",
      };

      const ptyShell = spawn("python3", ["-c", `import pty; pty.spawn(["/bin/bash", "--rcfile", "${bashrcPath}"])`], {
        cwd: userPath,
        env: shellEnv,
        stdio: ["pipe", "pipe", "pipe"]
      });

      ptyShell.on("error", (err) => {
        console.error("Failed to start python3 pty, falling back to bash:", err);
        const bashShell = spawn("bash", ["-i"], {
          cwd: userPath,
          env: shellEnv,
          stdio: ["pipe", "pipe", "pipe"]
        });
        
        bashShell.on("error", (err) => {
          console.error("Failed to start bash, falling back to sh:", err);
          const fallbackShell = spawn("sh", ["-i"], {
            cwd: userPath,
            env: shellEnv,
            stdio: ["pipe", "pipe", "pipe"]
          });
          setupShell(fallbackShell);
        });

        if (bashShell.pid) {
          setupShell(bashShell);
        }
      });

      if (ptyShell.pid) {
        setupShell(ptyShell);
      }
    };

    const setupShell = (s: any) => {
      s.stdout.on("data", (data: any) => {
        ws.send(data.toString());
      });

      s.stderr.on("data", (data: any) => {
        ws.send(data.toString());
      });

      ws.on("message", (message) => {
        s.stdin.write(message.toString());
      });

      ws.on("close", () => {
        s.kill();
      });

      s.on("exit", () => {
        ws.close();
      });
    };

    tryPTY();
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
