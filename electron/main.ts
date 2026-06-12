import { app, BrowserWindow, shell, ipcMain } from 'electron';
// In dev we intentionally suppress Electron's security warning banner
if (!app) {
  // noop fallback for type check
} 
if (!app?.isPackaged) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}
import path from 'path';
import { fileURLToPath } from 'url';
import { fork, ChildProcess } from 'child_process';
import { dirname } from 'path';
import http from 'http';
import fs from 'fs';
import net from 'net';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let localAppServer: http.Server | null = null;
let localAppServerUrl: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveShellEnv(): Promise<Record<string, string>> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (process.platform === 'win32') {
      const { stdout } = await execAsync('powershell -NoProfile -Command "Get-ChildItem Env: | ForEach-Object { $_.Key + \'=\' + $_.Value }"');
      const env: Record<string, string> = { ...process.env as Record<string, string> };
      stdout.split('\n').forEach((line: string) => {
        const idx = line.indexOf('=');
        if (idx > 0) env[line.substring(0, idx)] = line.substring(idx + 1).trim();
      });
      return env;
    } else {
      const shell = process.env.SHELL || '/bin/bash';
      const { stdout } = await execAsync(`"${shell}" -ilc env`);
      const env: Record<string, string> = { ...process.env as Record<string, string> };
      stdout.split('\n').forEach((line: string) => {
        const idx = line.indexOf('=');
        if (idx > 0) env[line.substring(0, idx)] = line.substring(idx + 1).trim();
      });
      return env;
    }
  } catch (err) {
    console.error('[Electron] Failed to resolve shell env:', err);
    return process.env as Record<string, string>;
  }
}

async function waitForUrl(url: string, attempts = 40, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode ? res.statusCode < 500 : true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ok) return true;
    await sleep(delayMs);
  }
  return false;
}

// Register the custom protocol for deep linking
const PROTOCOL = 'leara-auth';
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // For Windows/Linux: handle deep link from command line
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
      if (url) {
        mainWindow.webContents.send('auth-callback', url);
      }
    }
  });
}

function getBackendPort(): number {
  return Number(process.env.PORT) || 5001;
}

function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const backendPort = getBackendPort();
  const headers = { ...req.headers };
  delete headers['host'];
  headers['connection'] = 'keep-alive';

  const proxyReq = http.request({
    host: '127.0.0.1',
    port: backendPort,
    path: req.url,
    method: req.method,
    headers: headers,
    timeout: 360000 // 6 minutes for long operations like git clone
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Electron] API Proxy Error for ${req.url}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`Bad Gateway: ${err.message}`);
    }
  });

  proxyReq.on('timeout', () => {
    console.error(`[Electron] API Proxy Timeout for ${req.url}`);
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504);
      res.end('Gateway Timeout');
    }
  });

  req.pipe(proxyReq);
}

async function startLocalAppServer() {
  const isDev = !app.isPackaged;
  if (isDev) return 'http://127.0.0.1:3000';

  if (localAppServerUrl) return localAppServerUrl;

  return new Promise<string>((resolve, reject) => {
    localAppServer = http.createServer((req, res) => {
      // Proxy API requests to the backend server
      if (req.url?.startsWith('/api/')) {
        proxyRequest(req, res);
        return;
      }

      let filePath = path.join(__dirname, '../dist', req.url === '/' ? 'index.html' : req.url!);
      
      // Handle SPA routing
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '../dist/index.html');
      }

      const ext = path.extname(filePath);
      const contentTypes: any = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ico': 'image/x-icon',
      };

      try {
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(filePath));
      } catch (e) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Proxy WebSocket upgrades (for terminal) to backend
    localAppServer.on('upgrade', (req, socket, head) => {
      const backendPort = getBackendPort();
      console.log(`[Electron] WS Upgrade request: ${req.url} -> 127.0.0.1:${backendPort}`);
      
      const proxySocket = net.connect(backendPort, '127.0.0.1', () => {
        // Reconstruct the HTTP upgrade request to send to backend
        const reqHeaders = Object.entries(req.headers)
          .filter(([key]) => key.toLowerCase() !== 'host')
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n');
        
        proxySocket.write(
          `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
          `Host: 127.0.0.1:${backendPort}\r\n` +
          `${reqHeaders}\r\n` +
          `\r\n`
        );
        if (head && head.length > 0) proxySocket.write(head);

        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });

      proxySocket.on('error', (err) => {
        console.error('[Electron] WS proxy error:', err.message);
        socket.destroy();
      });

      socket.on('error', (err) => {
        console.error('[Electron] WS socket error:', err.message);
        proxySocket.destroy();
      });
    });

    let port = 5005;
    const tryListen = () => {
      localAppServer!.listen(port, '127.0.0.1', () => {
        localAppServerUrl = `http://127.0.0.1:${port}`;
        console.log(`[Electron] UI Server started on ${localAppServerUrl}`);
        resolve(localAppServerUrl);
      });
    };

    localAppServer!.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Electron] Port ${port} busy, trying ${port + 1}...`);
        port++;
        tryListen();
      } else {
        reject(err);
      }
    });

    tryListen();
  });
}

async function createWindow() {
  const isDev = !app.isPackaged;
  const startUrl = await startLocalAppServer();

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: isDev 
        ? path.join(__dirname, 'preload.cjs') 
        : path.join(__dirname, 'preload.cjs')
    },
  });

  // Remove native menu bar
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  
  // 1. Start Backend Server (Only in production, in dev we use npm run dev)
  if (!isDev) {
    const port = getBackendPort();
    const serverPath = path.join(process.resourcesPath, 'server', 'server.cjs');
    // Use Electron's userData directory for the workspace so it persists across updates
    const userDataPath = app.getPath('userData');

    // The app's node_modules are inside the asar archive.
    // Native modules (like node-pty) are in app.asar.unpacked.
    // We must set NODE_PATH so the forked server can find both.
    const appPath = app.getAppPath(); // e.g. .../resources/app.asar
    const nodeModulesPath = path.join(appPath, 'node_modules');
    const unpackedModulesPath = path.join(appPath + '.unpacked', 'node_modules');
    const combinedNodePath = `${unpackedModulesPath}${path.delimiter}${nodeModulesPath}`;
    
    console.log(`[Electron] Starting production server at ${serverPath}`);
    console.log(`[Electron] User data path: ${userDataPath}`);
    console.log(`[Electron] Backend port: ${port}`);
    console.log(`[Electron] App path: ${appPath}`);
    console.log(`[Electron] NODE_PATH: ${combinedNodePath}`);
    
    // Resolve the user's real shell environment (like VS Code does)
    const resolvedEnv = await resolveShellEnv();
    
    serverProcess = fork(serverPath, [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { 
        ...resolvedEnv,
        NODE_ENV: 'production',
        PORT: port.toString(),
        ELECTRON_RUN_AS_NODE: '1',
        RESOURCES_PATH: process.resourcesPath,
        LEARA_USER_DATA: userDataPath,
        NODE_PATH: combinedNodePath,
        LEARA_SYSTEM_PATH: resolvedEnv.PATH || process.env.PATH || '',
      }
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Backend ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Server failed to start:', err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[Electron] Backend server exited with code ${code}`);
    });

    // Wait for the backend to become available before loading the page
    console.log(`[Electron] Waiting for backend on port ${port}...`);
    const backendReady = await waitForUrl(`http://127.0.0.1:${port}/api/config`, 60, 500);
    if (backendReady) {
      console.log('[Electron] Backend is ready!');
    } else {
      console.error('[Electron] Backend failed to start in time!');
    }
  }

  // 2. Load Content
  if (isDev) {
    await waitForUrl('http://127.0.0.1:3000');
  }
  mainWindow.loadURL(startUrl);
  if (isDev) mainWindow.webContents.openDevTools();
  
  // Handle protocol deep links on Windows/Linux for the first instance
  const deepLinkUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
  if (deepLinkUrl) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('auth-callback', deepLinkUrl);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
    if (localAppServer) localAppServer.close();
  });
}

// Window Controls IPC
const getTargetWindow = () => BrowserWindow.getFocusedWindow() || mainWindow;

ipcMain.on('window-minimize', () => getTargetWindow()?.minimize());
ipcMain.on('window-maximize', () => {
  const target = getTargetWindow();
  if (!target) return;
  if (target.isMaximized()) {
    target.unmaximize();
  } else {
    target.maximize();
  }
});
ipcMain.on('window-close', () => getTargetWindow()?.close());
ipcMain.on('window-new', () => {
  createWindow();
});

// Store resolved env for the server to use in PTY sessions
ipcMain.handle('get-system-env', async () => await resolveShellEnv());

// Google Login IPC - Open External Browser
ipcMain.on('login-with-google', async () => {
  console.log('[Electron] Received login-with-google IPC');
  
  let baseUrl = 'http://127.0.0.1:3000';
  if (mainWindow) {
    try {
      const currentUrl = new URL(mainWindow.webContents.getURL());
      baseUrl = `${currentUrl.protocol}//${currentUrl.host}`;
    } catch (e) {
      if (app.isPackaged && localAppServer) {
        const address = localAppServer.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
    }
  }
  
  const authUrl = `${baseUrl}/?view=auth-bridge`;
  console.log('[Electron] Opening external browser for auth:', authUrl);
  shell.openExternal(authUrl);
});

// macOS handle open-url
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('auth-callback', url);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

