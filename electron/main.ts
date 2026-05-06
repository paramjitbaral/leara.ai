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

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let localAppServer: http.Server | null = null;
let localAppServerUrl: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function startLocalAppServer() {
  const isDev = !app.isPackaged;
  if (isDev) return 'http://127.0.0.1:3000';

  if (localAppServerUrl) return localAppServerUrl;

  return new Promise<string>((resolve) => {
    localAppServer = http.createServer((req, res) => {
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
      };

      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
    });

    localAppServer.listen(0, 'localhost', () => {
      const address = localAppServer!.address() as any;
      localAppServerUrl = `http://localhost:${address.port}`;
      resolve(localAppServerUrl);
    });
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
    const port = process.env.PORT || 5001;
    const serverPath = path.join(process.resourcesPath, 'app.asar.unpacked/server.js');

    console.log(`[Electron] Starting production server at ${serverPath}`);
    
    serverProcess = fork(serverPath, [], {
      env: { 
        ...process.env, 
        NODE_ENV: 'production',
        PORT: port.toString(),
        ELECTRON_RUN_AS_NODE: '1',
        RESOURCES_PATH: process.resourcesPath
      }
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Server failed to start:', err);
    });
  }

  // 2. Load Content
  if (isDev) {
    await waitForUrl('http://127.0.0.1:3000');
  }
  mainWindow.loadURL(startUrl);
  if (isDev) mainWindow.webContents.openDevTools();

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

// Google Login IPC - Open External Browser
ipcMain.on('login-with-google', async () => {
  console.log('[Electron] Received login-with-google IPC');
  // We need to know the startUrl. In dev it's 5173. In prod it's the local server port.
  // Since we might not have it yet if window hasn't opened, let's use a reliable way.
  let authUrl = 'http://127.0.0.1:3000/?view=auth-bridge';
  
  if (app.isPackaged && localAppServer) {
    const address = localAppServer.address() as any;
    authUrl = `http://127.0.0.1:${address.port}/?view=auth-bridge`;
  }
  
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

